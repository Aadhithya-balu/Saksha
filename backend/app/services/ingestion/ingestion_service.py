"""Phase 1 (issue #269): universal data ingestion service.

Owns the ingestion lifecycle:

    RECEIVED -> VALIDATING -> NORMALIZING -> STORED -> READY_FOR_AI -> COMPLETED

Background processing runs against the *worker* pool (``get_worker_session``)
so heavy normalisation never starves the request path. Storage paths are kept
opaque (``storage_ref``) and are never surfaced in API responses.
"""
import logging
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.postgres import get_worker_session
from app.models.ingestion import DataSource
from app.services.evidence_service import UPLOAD_DIR, sniff_content_type
from app.services.ingestion.extractors import ExtractionResult, compute_content_hash, extract_for_kind

logger = logging.getLogger(__name__)

MAX_INGESTION_SIZE_MB = 50
INGESTION_MAX_BYTES = MAX_INGESTION_SIZE_MB * 1024 * 1024

INGESTION_ARTIFACT_KINDS = {"document", "image", "video", "csv", "json", "database", "api", "manual"}

# Extension -> normalized artifact kind (browser MIME is untrusted).
_EXT_KIND = {
    ".pdf": "document", ".txt": "document", ".md": "document",
    ".doc": "document", ".docx": "document",
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image",
    ".webp": "image", ".bmp": "image",
    ".mp4": "video", ".mkv": "video", ".mov": "video", ".avi": "video", ".webm": "video",
    ".csv": "csv",
    ".json": "json",
}

# Kind -> Phase 2 job type proposed to the orchestrator (none = structured only).
_AI_JOB_TYPE = {
    "document": "OCR",
    "image": "VISION",
    "video": "VISION",
    "csv": None,
    "json": None,
    "database": None,
    "api": None,
    "manual": None,
}


def _utc_now_naive() -> datetime:
    return datetime.utcnow()


def _verify_content(kind: str, file_path: Path, ext: str) -> None:
    """Best-effort magic-byte verification; raises HTTPException(400) on mismatch."""
    with open(file_path, "rb") as fh:
        head = fh.read(64)
    if not head:
        raise HTTPException(status_code=400, detail="Empty file")
    if kind in ("document", "csv", "json"):
        if b"\x00" in head:
            raise HTTPException(status_code=400, detail="Binary content in a text artifact")
        lower = head.lower()
        if lower.startswith(b"<html") or lower.startswith(b"<!doctype"):
            raise HTTPException(status_code=400, detail="HTML payload masquerading as a data file")
        if kind == "json" and not head.lstrip().startswith((b"{", b"[")):
            raise HTTPException(status_code=400, detail="File content does not start with JSON")
        return
    if kind == "image":
        detected = sniff_content_type(head)
        if detected and not detected.startswith("image/"):
            raise HTTPException(status_code=400, detail="File content does not match an image type")
    elif kind == "video":
        if ext in (".mp4", ".mov") and head[4:8] != b"ftyp":
            raise HTTPException(status_code=400, detail="File content is not a valid video container")
        if ext == ".mkv" and not head.startswith(b"\x1a\x45\xdf\xa3"):
            raise HTTPException(status_code=400, detail="File content is not a valid Matroska container")


def _store_artifact(upload_file: UploadFile, job_id: uuid.UUID) -> tuple[Path, str, int]:
    """Persist the upload locally under a UUID name, verifying content + size.

    Returns ``(file_path, storage_ref, size_bytes)``. ``storage_ref`` is an
    opaque logical reference (never a server path) consumed only by the
    orchestrator's storage accessor.
    """
    if not upload_file.filename or "/" in upload_file.filename or "\\" in upload_file.filename or ".." in upload_file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    ext = Path(upload_file.filename).suffix.lower()
    if ext not in _EXT_KIND:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext or '(none)'}")

    ingest_dir = (UPLOAD_DIR / "ingestion").resolve()
    ingest_dir.mkdir(parents=True, exist_ok=True)
    # Path traversal is impossible by construction: UUID name + allow-listed ext.
    file_path = (ingest_dir / f"{job_id}{ext}").resolve()
    if not str(file_path).startswith(str(ingest_dir)):
        raise HTTPException(status_code=400, detail="Invalid storage path")

    size = 0
    with open(file_path, "wb") as buffer:
        while chunk := upload_file.file.read(1024 * 1024):
            size += len(chunk)
            if size > INGESTION_MAX_BYTES:
                buffer.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_INGESTION_SIZE_MB}MB.")
            buffer.write(chunk)

    kind = _EXT_KIND[ext]
    try:
        _verify_content(kind, file_path, ext)
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise

    return file_path, f"ingestion/{job_id}{ext}", size


class IngestionService:
    # ------------------------------------------------------------------ sources
    @staticmethod
    def list_sources(db: Session, active_only: bool = False) -> list[Any]:
        query = db.query(DataSource).order_by(DataSource.name.asc())
        if active_only:
            query = query.filter(DataSource.is_active.is_(True))
        return query.all()

    @staticmethod
    def create_source(db: Session, data: dict, user_id: uuid.UUID) -> Any:
        source = DataSource(**data, created_by_id=user_id)
        db.add(source)
        db.commit()
        db.refresh(source)
        return source

    @staticmethod
    def update_source(db: Session, source_id: uuid.UUID, data: dict) -> Optional[Any]:
        source = db.query(DataSource).filter(DataSource.id == source_id).first()
        if not source:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(source, key, value)
        db.commit()
        db.refresh(source)
        return source

    @staticmethod
    def delete_source(db: Session, source_id: uuid.UUID) -> bool:
        source = db.query(DataSource).filter(DataSource.id == source_id).first()
        if not source:
            return False
        db.delete(source)
        db.commit()
        return True

    # ------------------------------------------------------------------- upload
    @staticmethod
    def create_upload_job(
        db: Session,
        upload_file: UploadFile,
        current_user: Any,
        *,
        source_id: Optional[uuid.UUID] = None,
        jurisdiction: Optional[dict] = None,
        origin: Optional[str] = None,
    ) -> Any:
        """Persist a file and register an ingestion job (RECEIVED)."""
        from app.models.ingestion import IngestionJob

        job_id = uuid.uuid4()
        file_path, storage_ref, size = _store_artifact(upload_file, job_id)
        content_hash = compute_content_hash(file_path)
        ext = Path(upload_file.filename).suffix.lower()

        job = IngestionJob(
            id=job_id,
            source_id=source_id,
            status="RECEIVED",
            artifact_kind=_EXT_KIND[ext],
            original_filename=Path(upload_file.filename).name,
            storage_ref=storage_ref,
            mime_type=upload_file.content_type,
            size_bytes=size,
            content_hash=content_hash,
            provenance={
                "origin": origin or "upload",
                "channel": "api_upload",
                "submitted_by_id": str(current_user.id),
                "submitted_by_name": getattr(current_user, "name", None) or getattr(current_user, "full_name", None),
                "submitted_at": _utc_now_naive().isoformat() + "Z",
                "jurisdiction": jurisdiction or None,
            },
            created_by_id=current_user.id,
            received_at=_utc_now_naive(),
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        threading.Thread(target=process_ingestion_job, args=(job.id,), daemon=True).start()
        return job

    @staticmethod
    def create_manual_job(
        db: Session,
        current_user: Any,
        *,
        artifact_kind: str,
        manifest: dict,
        jurisdiction: Optional[dict] = None,
        origin: Optional[str] = None,
        source_id: Optional[uuid.UUID] = None,
    ) -> Any:
        """Register a structured, non-file job (DATABASE/API/MANUAL).

        There is no file to validate — the manifest *is* the normalized payload
        and the job is marked COMPLETED immediately.
        """
        from app.models.ingestion import IngestionJob

        if artifact_kind not in INGESTION_ARTIFACT_KINDS:
            raise HTTPException(status_code=400, detail=f"Unknown artifact kind: {artifact_kind}")
        if artifact_kind in ("database", "api", "manual"):
            status = "COMPLETED"
        else:
            raise HTTPException(status_code=400, detail="Manual jobs only for database/api/manual kinds")

        now = _utc_now_naive()
        job = IngestionJob(
            source_id=source_id,
            status=status,
            artifact_kind=artifact_kind,
            original_filename=None,
            storage_ref=None,
            mime_type=None,
            size_bytes=0,
            content_hash=None,
            provenance={
                "origin": origin or f"manual_{artifact_kind}",
                "channel": f"manual_{artifact_kind}",
                "submitted_by_id": str(current_user.id),
                "submitted_by_name": getattr(current_user, "name", None) or getattr(current_user, "full_name", None),
                "submitted_at": now.isoformat() + "Z",
                "jurisdiction": jurisdiction or None,
            },
            parsed_metadata={"channel": f"manual_{artifact_kind}"},
            normalized_payload=manifest,
            created_by_id=current_user.id,
            received_at=now,
            validated_at=now,
            normalized_at=now,
            stored_at=now,
            completed_at=now,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    # ------------------------------------------------------------------ reads
    @staticmethod
    def list_jobs(db: Session, *, status: Optional[str] = None, kind: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[Any]:
        from app.models.ingestion import IngestionJob

        query = db.query(IngestionJob)
        if status:
            query = query.filter(IngestionJob.status == status.upper())
        if kind:
            query = query.filter(IngestionJob.artifact_kind == kind)
        return query.order_by(IngestionJob.received_at.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def get_job(db: Session, job_id: uuid.UUID) -> Optional[Any]:
        from app.models.ingestion import IngestionJob

        return db.query(IngestionJob).filter(IngestionJob.id == job_id).first()

    @staticmethod
    def aggregate_status(db: Session) -> dict:
        from app.models.ingestion import IngestionJob

        statuses = ["RECEIVED", "VALIDATING", "NORMALIZING", "STORED", "READY_FOR_AI", "COMPLETED", "REQUIRES_REVIEW", "FAILED"]
        counts = {s: 0 for s in statuses}
        by_kind: dict[str, int] = {}
        for row in db.query(IngestionJob.status).all():
            status = (row[0] or "RECEIVED").upper()
            counts[status] = counts.get(status, 0) + 1
        for row in db.query(IngestionJob.artifact_kind, IngestionJob.status).all():
            kind = row[0] or "manual"
            by_kind[kind] = by_kind.get(kind, 0) + 1
        return {
            "total": sum(counts.values()),
            "received": counts["RECEIVED"],
            "validating": counts["VALIDATING"],
            "normalizing": counts["NORMALIZING"],
            "stored": counts["STORED"],
            "ready_for_ai": counts["READY_FOR_AI"],
            "completed": counts["COMPLETED"],
            "requires_review": counts["REQUIRES_REVIEW"],
            "failed": counts["FAILED"],
            "by_kind": by_kind,
        }

    # ----------------------------------------------------------------- retry
    @staticmethod
    def retry_job(db: Session, job_id: uuid.UUID) -> Optional[Any]:
        from app.models.ingestion import IngestionJob

        job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
        if not job or job.status not in ("FAILED", "RECEIVED", "VALIDATING", "NORMALIZING"):
            return None
        job.status = "RECEIVED"
        job.error_details = None
        db.commit()
        db.refresh(job)
        threading.Thread(target=process_ingestion_job, args=(job.id,), daemon=True).start()
        return job


def process_ingestion_job(job_id: uuid.UUID, *, session: Optional[Session] = None) -> None:
    """Run the RECEIVED -> ... lifecycle for one job.

    ``session`` may be passed for deterministic in-process processing (tests);
    otherwise a worker-pool session is opened and released. All milestones are
    authoritative in the DB — nothing here is assumed.
    """
    def _run(session_: Session) -> None:
        from app.models.ingestion import IngestionJob

        job = session_.query(IngestionJob).filter(IngestionJob.id == job_id).first()
        if not job:
            logger.error("[ingestion] job %s not found", job_id)
            return
        if job.status not in ("RECEIVED", "VALIDATING", "NORMALIZING"):
            logger.info("[ingestion] job %s in status %s; skipping", job_id, job.status)
            return

        job.status = "VALIDATING"
        job.validated_at = _utc_now_naive()
        session_.commit()

        file_path: Path | None = None
        if job.storage_ref:
            # storage_ref is opaque and internal ("ingestion/<uuid>.<ext>").
            candidate = (UPLOAD_DIR / job.storage_ref).resolve()
            if str(candidate).startswith(str((UPLOAD_DIR / "ingestion").resolve())):
                file_path = candidate

        try:
            job.status = "NORMALIZING"
            job.normalized_at = _utc_now_naive()
            session_.commit()

            if file_path and file_path.exists():
                result: ExtractionResult = extract_for_kind(job.artifact_kind, file_path, job.original_filename or "")
                job.parsed_metadata = result.metadata
                job.normalized_payload = result.normalized_payload
                job.record_count = result.record_count
            else:
                result = ExtractionResult()

            job.status = "STORED"
            job.stored_at = _utc_now_naive()
            session_.commit()

            ai_type = _AI_JOB_TYPE.get(job.artifact_kind)
            if result.ai_eligible and ai_type:
                job.status = "READY_FOR_AI"
                job.completed_at = None
                session_.commit()
                # Phase 2 handoff: queue the AI job and run it against the same
                # session (the orchestrator owns AI-job lifecycle + flips the
                # ingestion job to COMPLETED on success).
                import asyncio
                from app.ai.orchestrator import AIOrchestrator
                from app.services.ai_processing_service import AIProcessingService

                try:
                    ai_job = AIProcessingService.spawn_job(
                        session_, "ingestion_job", job.id, ai_type, background=False
                    )
                    job.ai_job_id = ai_job.id
                    job.ai_job_spawned = True
                    session_.commit()
                    asyncio.run(AIOrchestrator().process_job_async(ai_job.id, db=session_))
                except Exception as exc:  # noqa: BLE001
                    # Artifact is stored and ready; only the AI pass failed.
                    logger.exception("[ingestion] AI handoff failed for job %s", job_id)
            else:
                job.status = "COMPLETED"
                job.completed_at = _utc_now_naive()
                session_.commit()
            logger.info("[ingestion] job %s -> %s", job_id, job.status)
        except Exception as exc:  # noqa: BLE001
            logger.exception("[ingestion] job %s failed", job_id)
            job.status = "FAILED"
            job.error_details = str(exc)[:2000]
            job.completed_at = _utc_now_naive()
            session_.commit()

    if session is not None:
        _run(session)
        return

    db = get_worker_session()
    try:
        try:
            _run(db)
        except Exception as exc:  # noqa: BLE001 — background thread must never crash
            logger.warning("[ingestion] worker pass for job %s skipped: %s", job_id, exc)
    finally:
        db.close()


__all__ = [
    "IngestionService",
    "INGESTION_ARTIFACT_KINDS",
    "MAX_INGESTION_SIZE_MB",
    "process_ingestion_job",
]