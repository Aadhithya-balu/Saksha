"""Vector retrieval augmentation for the AI chat pipeline (issue #122).

Bridges the database-grounded RAG stack (`build_rag_documents` + in-memory
vector store) into `ChatOrchestrator`, so free-text questions recall relevant
FIRs, criminals, evidence, and cases even when intent routing has no exact
structured match. Stateless by design: the index is rebuilt per query from
live database rows, so results never go stale and tests stay isolated.
"""
from __future__ import annotations

import re
import threading
import time
from typing import Any

from sqlalchemy.orm import Session

from app.ai.chat.backend_fetcher import BackendResult
from app.ai.vectorstore.memory import InMemoryVectorStore, VectorDocument

_TOP_K = 5
# Cheap first-pass floor; real filtering happens via the shared-stem rule
# below, which kills SHA-256 hashing-trick collision noise.
_MIN_SCORE = 0.1
_SNIPPET_LIMIT = 280
_MIN_SHARED_STEMS = 2
# Validator-known identifier keys so IDs cited from retrieved documents are
# treated as grounded by ResponseValidator.
_ID_METADATA_KEYS = ("id", "fir_number", "case_number", "name")
# Issue #246: building the RAG index scans + re-embeds every FIR/criminal/
# evidence/case row from the database on EVERY chat message. Caching the
# built, already-embedded index for a short TTL makes repeated queries
# near-instant while bounding staleness, with NO change to answer logic.
_INDEX_TTL_SECONDS = 120.0


class RagRetriever:
    """Retrieves database records relevant to a free-text question.

    Issue #246: the RAG index (DB scan + SHA-256 embedding) was rebuilt from
    scratch on every message, which is the primary source of the multi-minute
    loading delay when the database is remote (Supabase).  The built vector
    store is now cached for _INDEX_TTL_SECONDS so repeated chat queries are
    near-instant.  The cache lives on the instance, so tests creating fresh
    RagRetriever objects are unaffected.
    """

    def __init__(self) -> None:
        self._index_cache: InMemoryVectorStore | None = None
        self._index_cache_ts: float = 0.0
        self._index_cache_lock = threading.Lock()

    def fetch(self, db: Session, message: str, *, top_k: int = _TOP_K,
              district: str | None = None) -> BackendResult | None:
        try:
            store = self._get_indexed_store(db)
            if store is None:
                return None

            # Over-fetch: cosine on hash embeddings is noisy, so genuine
            # matches must be filtered/ranked AFTER retrieval, not truncated
            # away by top_k beforehand.
            query_stems = self._word_stems(message)
            overlaps: list[tuple[int, float, Any]] = []
            for hit in store.search(self._normalize(message), top_k=max(top_k * 8, 40)):
                if hit.score < _MIN_SCORE:
                    continue
                shared = query_stems & self._word_stems(self._display_text(hit))
                if len(shared) >= _MIN_SHARED_STEMS:
                    overlaps.append((len(shared), hit.score, hit))
            if not overlaps:
                return None
            overlaps.sort(key=lambda item: (-item[0], -item[1]))
            hits = [item[2] for item in overlaps[:top_k]]

            # District scoping: bound users only ever receive documents tagged
            # with their district. Untagged (e.g. analytics) documents are
            # excluded so the caller's scope is never widened.
            district = (district or "").strip() or None
            if district:
                hits = [h for h in hits if self._in_district(h, district)]
            if not hits:
                return None

            lines = [self._display_text(hit)[:_SNIPPET_LIMIT] for hit in hits]
            known_ids = []
            for hit in hits:
                entry = {key: str(hit.metadata[key]) for key in _ID_METADATA_KEYS if hit.metadata.get(key)}
                if entry:
                    known_ids.append(entry)

            return BackendResult(
                source="postgres",
                data_type="vector_retrieval",
                content="\n".join(lines),
                raw_data=known_ids or None,
            )
        except Exception:
            # Retrieval augmentation must never break the chat pipeline.
            return None

    @staticmethod
    def _in_district(hit, district: str) -> bool:
        doc_districts = (hit.metadata.get("district") or "").strip()
        if not doc_districts:
            return False
        for tagged in doc_districts.split(","):
            if tagged.strip().lower() == district.strip().lower():
                return True
        return False

    def _get_indexed_store(self, db: Session) -> InMemoryVectorStore | None:
        """Returns the cached vector store, rebuilding it on cache miss.

        Issue #246: the index is rebuilt once every _INDEX_TTL_SECONDS.
        The lock prevents concurrent rebuilds from redundant requests while
        keeping per-request latency identical to the uncached path when the
        cache is warm.
        """
        now = time.monotonic()
        with self._index_cache_lock:
            if self._index_cache is not None and (now - self._index_cache_ts) < _INDEX_TTL_SECONDS:
                return self._index_cache

        # Cache miss or expired — rebuild outside the lock so other requests
        # don't block while the slow SQL scan runs.  At worst we do one
        # redundant rebuild when two concurrent cold requests race.
        try:
            from app.services.rag.rag_service import build_rag_documents
            documents = build_rag_documents(db)
            if not documents:
                return None
            store = InMemoryVectorStore()
            store.index(self._to_vector_documents(documents))
        except Exception:
            return None

        with self._index_cache_lock:
            self._index_cache = store
            self._index_cache_ts = time.monotonic()
        return store

    @staticmethod
    def _to_vector_documents(documents: list[dict]) -> list[VectorDocument]:
        records: list[VectorDocument] = []
        for index, doc in enumerate(documents):
            original_text = str(doc.get("content") or "")
            if not original_text.strip():
                continue
            records.append(
                VectorDocument(
                    id=str(doc.get("id") or f"doc-{index}"),
                    # Hyphens/slashes become spaces so IDs like FIR-2026-001
                    # and queries like "FIR 2026/001" share real tokens.
                    text=RagRetriever._normalize(original_text),
                    title=str(doc.get("title") or f"Document {index + 1}"),
                    metadata={
                        **{k: v for k, v in doc.items() if k not in {"id", "content"}},
                        "_display": original_text,
                    },
                )
            )
        return records

    @staticmethod
    def _display_text(hit) -> str:
        return str(hit.metadata.get("_display", hit.content))

    @staticmethod
    def _normalize(text: str) -> str:
        return re.sub(r"[-/]+", " ", text.lower())

    @staticmethod
    def _word_stems(text: str) -> set[str]:
        words = re.findall(r"[a-z0-9]{3,}", RagRetriever._normalize(text))
        return {
            word[:-1] if len(word) > 3 and word.endswith("s") else word
            for word in words
        }
