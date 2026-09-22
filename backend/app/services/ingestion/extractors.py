"""Phase 1 (issue #269): artifact normalizers / extractors.

Each kind produces an ``ExtractionResult``:
* ``metadata``       -> small, DB-friendly description of the artifact
* ``normalized_payload`` -> structured, searchable representation (capped)
* ``record_count``   -> number of logical records (rows / pages / entities)
* ``ai_eligible``    -> whether a Phase 2 AI pass (OCR/NER/VISION) is meaningful

Extraction is deliberately deterministic and dependency-light (PyPDF2,
python-docx, Pillow, pymediainfo). Nothing here is "AI" — the honest rule-based
pass that feeds Phase 2.
"""
import csv
import hashlib
import io
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MAX_TEXT_CHARS = 2_000_000
MAX_CSV_SAMPLE_ROWS = 200
MAX_JSON_BYTES = 2_000_000


@dataclass
class ExtractionResult:
    metadata: dict[str, Any] = field(default_factory=dict)
    normalized_payload: dict[str, Any] = field(default_factory=dict)
    record_count: int = 0
    ai_eligible: bool = False


def _cap_text(text: str) -> str:
    if len(text) <= MAX_TEXT_CHARS:
        return text
    return text[:MAX_TEXT_CHARS] + "\n[... truncated ...]"


def _extract_document(path: Path, filename: str) -> ExtractionResult:
    ext = path.suffix.lower()
    lower_name = filename.lower()
    if ext == ".pdf" or lower_name.endswith(".pdf"):
        return _extract_pdf(path)
    if ext == ".docx" or lower_name.endswith(".docx"):
        return _extract_docx(path)
    return _extract_plain_text(path)


def _extract_pdf(path: Path) -> ExtractionResult:
    from PyPDF2 import PdfReader

    reader = PdfReader(str(path))
    pages: list[str] = []
    total_chars = 0
    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
        except Exception:  # noqa: BLE001 — a bad page must not kill the job
            page_text = ""
        remaining = MAX_TEXT_CHARS - total_chars
        if remaining > 0:
            pages.append(page_text[:remaining])
            total_chars += min(len(page_text), remaining)
        # Skip further pages once the cap is hit to keep payloads bounded.
        if total_chars >= MAX_TEXT_CHARS:
            break
    joined = "\n".join(pages)
    return ExtractionResult(
        metadata={"format": "pdf", "page_count": len(reader.pages), "extraction": "PyPDF2"},
        normalized_payload={"pages": pages, "text": _cap_text(joined)},
        record_count=len(pages),
        ai_eligible=True,
    )


def _extract_docx(path: Path) -> ExtractionResult:
    from docx import Document

    doc = Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    joined = "\n".join(paragraphs)
    return ExtractionResult(
        metadata={
            "format": "docx",
            "paragraph_count": len(paragraphs),
            "extraction": "python-docx",
        },
        normalized_payload={"text": _cap_text(joined)},
        record_count=len(paragraphs),
        ai_eligible=True,
    )


def _extract_plain_text(path: Path) -> ExtractionResult:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return ExtractionResult(
        metadata={"format": "text", "chars": len(text), "line_count": len(lines), "extraction": "plain"},
        normalized_payload={"text": _cap_text(text)},
        record_count=len(lines),
        ai_eligible=True,
    )


def _extract_image(path: Path) -> ExtractionResult:
    from PIL import Image

    with Image.open(str(path)) as img:
        fmt = (img.format or "unknown").lower()
        width, height = img.size
        mode = img.mode
    return ExtractionResult(
        metadata={"format": fmt, "width": width, "height": height, "mode": mode, "extraction": "PIL"},
        normalized_payload={"dimensions": {"width": width, "height": height}, "mode": mode},
        record_count=1,
        ai_eligible=True,  # Phase 2 VISION/face scene pass
    )


def _extract_video(path: Path) -> ExtractionResult:
    metadata: dict[str, Any] = {"extraction": "pymediainfo"}
    duration_seconds: float | None = None
    try:
        from pymediainfo import MediaInfo

        media = MediaInfo.parse(str(path))
        for track in media.tracks:
            if track.track_type == "General":
                if getattr(track, "duration", None):
                    try:
                        duration_seconds = float(track.duration) / 1000.0
                    except (TypeError, ValueError):
                        duration_seconds = None
                metadata["container"] = getattr(track, "format", None) or "unknown"
            elif track.track_type == "Video" and "video_codec" not in metadata:
                metadata["video_codec"] = getattr(track, "format", None) or None
                metadata["width"] = getattr(track, "width", None)
                metadata["height"] = getattr(track, "height", None)
    except Exception as exc:  # noqa: BLE001 — libmediainfo may be absent
        logger.warning("pymediainfo unavailable for %s: %s", path, exc)
        metadata["extraction"] = "pymediainfo-unavailable"

    payload: dict[str, Any] = {}
    if duration_seconds is not None:
        payload["duration_seconds"] = round(duration_seconds, 2)
    return ExtractionResult(
        metadata=metadata,
        normalized_payload=payload,
        record_count=1,
        ai_eligible=True,  # Phase 2 VISION scene-analysis pass
    )


def _extract_csv(path: Path) -> ExtractionResult:
    sample_rows: list[dict[str, str]] = []
    headers: list[str] = []
    total_rows = 0
    with open(path, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        for row in reader:
            if any(cell.strip() for cell in row):
                if not headers:
                    headers = [c.strip() or f"col{i}" for i, c in enumerate(row)]
                else:
                    total_rows += 1
                    if len(sample_rows) < MAX_CSV_SAMPLE_ROWS:
                        sample_rows.append(dict(zip(headers, row)))
    return ExtractionResult(
        metadata={"format": "csv", "headers": headers, "row_count": total_rows, "extraction": "csv"},
        normalized_payload={"headers": headers, "rows": sample_rows},
        record_count=total_rows,
        ai_eligible=False,  # structured rows are already normalized
    )


def _extract_json(path: Path) -> ExtractionResult:
    raw = path.read_bytes()
    if len(raw) > MAX_JSON_BYTES:
        raw = raw[:MAX_JSON_BYTES]
    payload: Any
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        text = raw.decode("utf-8", errors="replace")
        payload = {"_note": "invalid JSON", "raw_prefix": _cap_text(text[:5000])}
    count = len(payload) if isinstance(payload, list) else (1 if isinstance(payload, dict) else 0)
    return ExtractionResult(
        metadata={"format": "json", "top_level": type(payload).__name__, "extraction": "json"},
        normalized_payload=payload if isinstance(payload, (dict, list)) else {"value": payload},
        record_count=count,
        ai_eligible=False,
    )


def compute_content_hash(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        while chunk := fh.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def extract_for_kind(kind: str, path: Path, filename: str) -> ExtractionResult:
    """Dispatch to the normalizer matching the artifact kind."""
    if kind == "document":
        return _extract_document(path, filename)
    if kind == "image":
        return _extract_image(path)
    if kind == "video":
        return _extract_video(path)
    if kind == "csv":
        return _extract_csv(path)
    if kind == "json":
        return _extract_json(path)
    return ExtractionResult()  # DATABASE/API/MANUAL have no file payload


__all__ = [
    "ExtractionResult",
    "compute_content_hash",
    "extract_for_kind",
]