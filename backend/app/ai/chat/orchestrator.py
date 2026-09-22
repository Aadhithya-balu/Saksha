"""AI Orchestrator — ties intent routing, entity extraction, backend fetching, context building, and LLM generation together.

Issue #189 hardening:
- Safe DB session handling: callers must pass a request-scoped session; the
  orchestrator never creates or commits sessions.
- Empty retrieval: when zero backend sources return usable data (and the
  question is not platform-general), the streaming path emits a refusal
  status chunk *before* generation so the client can display the refusal
  immediately rather than waiting for the LLM to produce it.
- Provider failure safety: the sync wrapper catches all exceptions from the
  generation phase and returns a bounded safe response instead of crashing.
"""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from sqlalchemy.orm import Session

from app.ai.chat.backend_fetcher import BackendFetcher, user_may_view_pii
from app.ai.chat.context_builder import ContextBuilder
from app.ai.chat.entity_extractor import EntityExtractor
from app.ai.chat.intent_router import IntentRouter
from app.ai.chat.llm_generator import LLMGenerator
from app.ai.chat.memory import memory
from app.ai.chat.query_planner import QueryPlanner
from app.ai.chat.rag_retriever import RagRetriever
from app.ai.chat.response_validator import ResponseValidator

logger = logging.getLogger(__name__)

_REFUSAL_ANSWER = (
    "I could not find matching records in the Saksha database for that query. "
    "No verified data sources were available to ground an answer, so I will not "
    "speculate. Please try rephrasing your question or check the case/FIR number."
)

_PROVIDER_FAILURE_ANSWER = (
    "The AI language model is temporarily unavailable. "
    "Please try again in a few moments or contact your system administrator."
)

# Sentinel district for district-bound accounts with no resolvable district:
# matches no record's district, so every scoped query returns empty and chat
# fails closed (no cross-district leakage) instead of answering broadly.
_NO_DISTRICT_SENTINEL = "__NO_DISTRICT_ACCESS__"


class ChatOrchestrator:
    """Main orchestrator for the Saksha AI Chat pipeline."""

    def __init__(self) -> None:
        self.intent_router = IntentRouter()
        self.entity_extractor = EntityExtractor()
        self.query_planner = QueryPlanner()
        self.backend_fetcher = BackendFetcher()
        self.rag_retriever = RagRetriever()
        self.context_builder = ContextBuilder()
        self.llm_generator = LLMGenerator()
        self.response_validator = ResponseValidator()

    def _retrieve(
        self,
        message: str,
        plan: Any,
        db: Session,
        is_platform_q: bool,
        current_user: Any,
    ) -> list:
        """Run backend fetches and RAG retrieval in a safe, session-scoped block.

        The caller owns the session lifecycle.  This method only *reads* via
        the session and never commits or rolls back.
        """
        if is_platform_q:
            return []

        # District scoping: bound users get their own district; multi-district /
        # system users get None (all); bound users without a district fail closed
        # (sentinel) so nothing outside their scope is ever surfaced.
        district = None
        fail_closed = False
        if current_user is not None:
            from app.auth.scope import enforce_district_scope
            try:
                district = enforce_district_scope(current_user, None, db)
            except Exception:
                district = _NO_DISTRICT_SENTINEL
                fail_closed = True

        results = self.backend_fetcher.execute(
            plan, db,
            redact_pii=not user_may_view_pii(current_user),
            district=district,
        )
        if fail_closed:
            # Aggregate stats are also recomputed outside the caller's scope;
            # drop them so a locked-down account gets only an honest refusal.
            results = [r for r in results if r.source != "analytics"]
        try:
            rag_result = self.rag_retriever.fetch(
                db, message, district=district,
            )
            if rag_result:
                results.append(rag_result)
        except Exception:
            # RAG retrieval is best-effort; a failure must not crash the
            # entire chat pipeline.
            logger.debug("RAG retrieval failed (non-fatal)", exc_info=True)

        return results

    async def process_message(
        self,
        message: str,
        session_id: str | None,
        db: Session,
        history: list[dict[str, str]] | None = None,
        current_user: Any = None,
    ) -> AsyncIterator[bytes]:
        sid = session_id or "default"
        external_history = history is not None
        hist = history if external_history else memory.get_history(sid)

        import asyncio
        yield self._ndjson({"type": "status", "content": "Analyzing query intent..."})
        await asyncio.sleep(0.01)

        intent_result = self.intent_router.detect(message)
        entities = self.entity_extractor.extract(message)

        yield self._ndjson({
            "type": "status",
            "content": f"Intent: {', '.join(i.value for i in intent_result.intents)}",
        })
        await asyncio.sleep(0.01)

        is_platform_q = any(
            i.value == "platform_general" for i in intent_result.intents
        )

        plan = self.query_planner.plan(intent_result.intents, entities)
        results = self._retrieve(message, plan, db, is_platform_q, current_user)

        successful = [r for r in results if r.success]
        failed = [r for r in results if not r.success]

        yield self._ndjson({
            "type": "status",
            "content": f"Retrieved data from {len(successful)} source(s)."
            + (f" {len(failed)} source(s) unavailable." if failed else ""),
        })
        await asyncio.sleep(0.01)

        # Issue #189: When zero usable sources exist (and not a platform
        # question), emit a refusal notice immediately so the client knows
        # the response will be bounded before generation starts.
        if not successful and not is_platform_q:
            yield self._ndjson({
                "type": "notice",
                "content": "No database records matched the query. Response will be a safe refusal.",
            })

        built_context = self.context_builder.build(results, entities, message, current_user=current_user)

        yield self._ndjson({"type": "status", "content": "Generating response..."})
        await asyncio.sleep(0.01)

        full_response = ""
        try:
            async for chunk in self.llm_generator.generate(
                message=message,
                context_block=built_context.context_block,
                system_prompt=built_context.system_prompt,
                history=hist,
            ):
                full_response += chunk
                yield self._ndjson({"type": "token", "content": chunk})
        except Exception:
            logger.warning("LLM generation failed in streaming path", exc_info=True)
            full_response = _PROVIDER_FAILURE_ANSWER
            yield self._ndjson({"type": "token", "content": _PROVIDER_FAILURE_ANSWER})

        validated_response = self.response_validator.validate(full_response, results, skip_grounding=is_platform_q)
        provenance = self.response_validator.get_provenance(full_response, results)

        if not external_history:
            memory.add(sid, message, validated_response)

        final_payload = {
            "type": "final",
            "content": {
                "answer": validated_response,
                "summary": built_context.summary,
                "entities": [str(v) for v in entities.to_dict().values() if v is not None],
                "classification": intent_result.intents[0].value if intent_result.intents else "general",
                "sources": built_context.sources,
                "chart_suggestion": self._suggest_chart(intent_result.intents),
                "citations": built_context.citations,
                "engine": self._engine_label(),
                "provenance": {
                    "source_records": provenance.source_records,
                    "verified_ids": provenance.verified_ids,
                    "unverified_ids": provenance.unverified_ids,
                    "verified_names": provenance.verified_names,
                    "unverified_names": provenance.unverified_names,
                    "grounding_score": provenance.grounding_score,
                    "has_fabricated_claims": provenance.has_fabricated_claims,
                    "refusal_issued": provenance.refusal_issued,
                },
            },
        }
        yield self._ndjson(final_payload)

    def process_message_sync(
        self,
        message: str,
        session_id: str | None,
        db: Session,
        history: list[dict[str, str]] | None = None,
        current_user: Any = None,
    ) -> dict[str, Any]:
        """Synchronous wrapper around the chat pipeline.

        Issue #189: catches provider/generation failures and returns a bounded
        safe response so callers never see an unhandled exception.
        """
        sid = session_id or "default"
        external_history = history is not None
        hist = history if external_history else memory.get_history(sid)

        intent_result = self.intent_router.detect(message)
        entities = self.entity_extractor.extract(message)
        plan = self.query_planner.plan(intent_result.intents, entities)

        is_platform_q = any(
            i.value == "platform_general" for i in intent_result.intents
        )

        results = self._retrieve(message, plan, db, is_platform_q, current_user)

        built_context = self.context_builder.build(results, entities, message, current_user=current_user)

        import asyncio

        async def _collect() -> str:
            chunks: list[str] = []
            async for chunk in self.llm_generator.generate(
                message=message,
                context_block=built_context.context_block,
                system_prompt=built_context.system_prompt,
                history=hist,
            ):
                chunks.append(chunk)
            return "".join(chunks)

        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None
            
            if loop is not None and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    full_response = pool.submit(asyncio.run, _collect()).result()
            else:
                full_response = asyncio.run(_collect())
        except Exception:
            logger.warning("LLM generation failed in sync path", exc_info=True)
            full_response = _PROVIDER_FAILURE_ANSWER

        validated_response = self.response_validator.validate(full_response, results, skip_grounding=is_platform_q)
        provenance = self.response_validator.get_provenance(full_response, results)
        if not external_history:
            memory.add(sid, message, validated_response)

        return {
            "answer": validated_response,
            "summary": built_context.summary,
            "entities": [str(v) for v in entities.to_dict().values() if v is not None],
            "classification": intent_result.intents[0].value if intent_result.intents else "general",
            "sources": built_context.sources,
            "chart_suggestion": self._suggest_chart(intent_result.intents),
            "citations": built_context.citations,
            "engine": self._engine_label(),
            "provenance": {
                "source_records": provenance.source_records,
                "verified_ids": provenance.verified_ids,
                "unverified_ids": provenance.unverified_ids,
                "verified_names": provenance.verified_names,
                "unverified_names": provenance.unverified_names,
                "grounding_score": provenance.grounding_score,
                "has_fabricated_claims": provenance.has_fabricated_claims,
                "refusal_issued": provenance.refusal_issued,
            },
        }

    def _engine_label(self) -> str:
        """Reports the engine that ACTUALLY produced the last answer.

        Falls back to configured provider only before any generation ran.
        """
        return getattr(self.llm_generator, "last_engine", None) or "local-template"

    @staticmethod
    def _ndjson(payload: dict[str, Any]) -> bytes:
        return (json.dumps(payload, default=str) + "\n").encode("utf-8")

    @staticmethod
    def _suggest_chart(intents: list) -> str | None:
        from app.ai.chat.intent_router import Intent
        for intent in intents:
            if intent in (Intent.CRIME_STATISTICS, Intent.DASHBOARD_ANALYTICS):
                return "bar"
            if intent == Intent.HOTSPOT_ANALYSIS:
                return "heatmap"
            if intent == Intent.PREDICTIONS:
                return "line"
            if intent == Intent.CRIMINAL_NETWORK:
                return "graph"
        return None

