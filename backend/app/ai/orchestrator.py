import uuid
import logging
import asyncio
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.ai_processing import AIProcessingJob, AIOcrResult, AIEntity, AIEvent
from app.models.evidence import Evidence
from app.models.ingestion import IngestionJob
from app.ai.providers.base import OCRProvider, LLMProvider, VisionProvider
from app.ai.providers.local_providers import (
    LocalTextOCRProvider,
    RuleBasedNERProvider,
    OpenCVVisionProvider,
    should_require_review,
)
from app.database.postgres import get_worker_session
from app.services.evidence_service import UPLOAD_DIR

logger = logging.getLogger(__name__)


class AIOrchestrator:
    """Coordinates the Phase 2 AI pipeline for a job.

    Targets:
    * ``ingestion_job`` — bytes are read from the opaque ingestion storage ref.
    * ``evidence`` — bytes are read from the local evidence file when present.

    Jobs are dispatched by ``job_type`` (OCR / NER / VISION). All providers are
    deterministic local implementations unless overridden; nothing is
    fabricated. Identity-relevant findings set the job to ``REQUIRES_REVIEW``
    so a human decides (bare-metal rule: no auto-confirmation).
    """

    def __init__(
        self,
        ocr_provider: OCRProvider = None,
        llm_provider: LLMProvider = None,
        vision_provider: VisionProvider = None,
    ):
        self.ocr_provider = ocr_provider or LocalTextOCRProvider()
        self.llm_provider = llm_provider or RuleBasedNERProvider()
        self.vision_provider = vision_provider or OpenCVVisionProvider()

    async def process_job_async(self, job_id: uuid.UUID, db: Session = None):
        owns_session = db is None
        session = db or get_worker_session()
        try:
            await self._process(job_id, session)
        finally:
            if owns_session:
                session.close()

    async def _process(self, job_id: uuid.UUID, db: Session):
        job = db.query(AIProcessingJob).filter(AIProcessingJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found.")
            return

        if job.status not in ["QUEUED", "FAILED"]:
            logger.info(f"Job {job_id} is in status {job.status}. Skipping.")
            return

        job.status = "PROCESSING"
        job.processing_started_at = datetime.utcnow()
        db.commit()

        try:
            if job.target_entity_type == "ingestion_job":
                await self._process_ingestion(db, job)
            elif job.target_entity_type == "evidence":
                await self._process_evidence(db, job)
            else:
                logger.warning(f"Unsupported target type {job.target_entity_type} for job {job.id}")
                job.status = "FAILED"
                job.error_details = f"Unsupported target type: {job.target_entity_type}"
                job.processing_completed_at = datetime.utcnow()
                db.commit()
                return

            job.processing_completed_at = datetime.utcnow()
            # REQUIRES_REVIEW (identity findings) is set mid-pipeline by
            # _flag_review_if_needed — never downgrade it back to COMPLETED.
            if job.status == "PROCESSING":
                job.status = "COMPLETED"
            db.commit()
        except Exception as e:
            logger.exception(f"Error processing AI job {job.id}")
            job.status = "FAILED"
            job.error_details = str(e)[:2000]
            job.processing_completed_at = datetime.utcnow()
            db.commit()

    # ------------------------------------------------------------- helpers
    def _complete_source_job(self, db: Session, target_entity_type: str, target_id: uuid.UUID) -> None:
        """Mark the ingestion source artifact completed once the AI pass lands."""
        if target_entity_type != "ingestion_job":
            return
        src = db.query(IngestionJob).filter(IngestionJob.id == target_id).first()
        if src and src.status == "READY_FOR_AI":
            src.status = "COMPLETED"
            src.completed_at = datetime.utcnow()
            db.commit()

    def _flag_review_if_needed(self, db: Session, job: AIProcessingJob, entities: list) -> None:
        if should_require_review(entities):
            job.status = "REQUIRES_REVIEW"
            job.processing_completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"Job {job.id} requires human review (identity-relevant findings)")

    async def _store_ocr(self, db: Session, source_type: str, source_id, results) -> str:
        full_text = ""
        for res in results:
            full_text += res.raw_text + "\n"
            db.add(AIOcrResult(
                source_entity_type=source_type,
                source_entity_id=source_id,
                raw_text=res.raw_text,
                page_number=res.page_number,
                confidence=res.confidence,
                bounding_boxes=res.bounding_boxes,
                provider=res.provider,
            ))
        db.flush()
        return full_text

    async def _store_entities(self, db: Session, source_type: str, source_id, entities) -> None:
        for ent in entities:
            db.add(AIEntity(
                entity_type=ent.entity_type,
                attributes=ent.attributes,
                source_entity_type=source_type,
                source_entity_id=source_id,
                confidence=ent.confidence,
                verification_status="PENDING",
                provider=ent.provider,
            ))
        db.flush()

    async def _store_events(self, db: Session, source_type: str, source_id, events) -> None:
        for ev in events:
            db.add(AIEvent(
                event_type=ev.event_type,
                source_entity_type=source_type,
                source_entity_id=source_id,
                timestamp_reference=ev.timestamp,
                confidence=ev.confidence,
                provider=ev.provider,
            ))
        db.flush()

    async def _run_ner_pass(self, db: Session, job: AIProcessingJob, source_type: str, source_id, text: str) -> None:
        if not (text or "").strip():
            return
        entities = await self.llm_provider.extract_entities(text)
        await self._store_entities(db, source_type, source_id, entities)
        self._flag_review_if_needed(db, job, entities)

    # --------------------------------------------------------- ingestion target
    async def _process_ingestion(self, db: Session, job: AIProcessingJob):
        src = db.query(IngestionJob).filter(IngestionJob.id == job.target_entity_id).first()
        if not src:
            raise ValueError(f"Ingestion job {job.target_entity_id} not found.")

        media_bytes = b""
        if src.storage_ref:
            candidate = (UPLOAD_DIR / src.storage_ref).resolve()
            if str(candidate).startswith(str((UPLOAD_DIR / "ingestion").resolve())) and candidate.exists():
                media_bytes = candidate.read_bytes()

        source_type = "ingestion_job"
        source_id = src.id
        filename = src.original_filename or "artifact"

        if job.job_type == "OCR":
            ocr_results = await self.ocr_provider.process_document(media_bytes, filename)
            if not ocr_results:
                logger.info(f"Job {job.id}: no text extractable; falling through to NER on stored payload")
            text = await self._store_ocr(db, source_type, source_id, ocr_results)
            await self._run_ner_pass(db, job, source_type, source_id, text or (src.normalized_payload or {}).get("text", ""))
        elif job.job_type == "NER":
            text = (src.normalized_payload or {}).get("text", "")
            await self._run_ner_pass(db, job, source_type, source_id, text)
        elif job.job_type == "VISION":
            events = await self.vision_provider.process_media(media_bytes, filename)
            await self._store_events(db, source_type, source_id, events)
        else:
            logger.warning(f"Job {job.id}: unknown job_type {job.job_type} — nothing to run")

        self._complete_source_job(db, source_type, source_id)

    # ----------------------------------------------------------- evidence target
    async def _process_evidence(self, db: Session, job: AIProcessingJob):
        evidence = db.query(Evidence).filter(Evidence.id == job.target_entity_id).first()
        if not evidence:
            raise ValueError(f"Evidence {job.target_entity_id} not found.")

        media_bytes = b""
        if evidence.storage_path:
            candidate = Path(evidence.storage_path)
            if candidate.exists():
                media_bytes = candidate.read_bytes()

        source_type = "evidence"
        source_id = evidence.id
        filename = evidence.title or "evidence"

        if not media_bytes:
            # Honest no-op: we never fabricate content for missing files.
            logger.info(f"Job {job.id}: evidence has no locally readable bytes; completing without results.")
            return

        if job.job_type in ("OCR", "NER"):
            ocr_results = await self.ocr_provider.process_document(media_bytes, filename)
            text = await self._store_ocr(db, source_type, source_id, ocr_results)
            if job.job_type == "OCR":
                await self._run_ner_pass(db, job, source_type, source_id, text)
            else:
                await self._run_ner_pass(db, job, source_type, source_id, text)
        elif job.job_type == "VISION":
            events = await self.vision_provider.process_media(media_bytes, filename)
            await self._store_events(db, source_type, source_id, events)
        else:
            logger.warning(f"Job {job.id}: unknown job_type {job.job_type} — nothing to run")


def run_job_sync(job_id: uuid.UUID):
    """Sync wrapper for background threads."""
    orchestrator = AIOrchestrator()
    asyncio.run(orchestrator.process_job_async(job_id))