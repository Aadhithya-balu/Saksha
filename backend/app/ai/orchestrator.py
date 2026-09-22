import uuid
import logging
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.ai_processing import AIProcessingJob, AIOcrResult, AIEntity, AIEvent
from app.models.evidence import Evidence
from app.ai.providers.base import OCRProvider, LLMProvider, VisionProvider
from app.ai.providers.mock_providers import MockOCRProvider, MockLLMProvider, MockVisionProvider
from app.database.postgres import get_worker_session

logger = logging.getLogger(__name__)

class AIOrchestrator:
    """Coordinates AI pipeline: OCR -> NLP/NER -> Vision"""
    def __init__(
        self, 
        ocr_provider: OCRProvider = None, 
        llm_provider: LLMProvider = None, 
        vision_provider: VisionProvider = None
    ):
        self.ocr_provider = ocr_provider or MockOCRProvider()
        self.llm_provider = llm_provider or MockLLMProvider()
        self.vision_provider = vision_provider or MockVisionProvider()

    async def process_job_async(self, job_id: uuid.UUID):
        # We get a separate worker session for background task
        with get_worker_session() as db:
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
                # 1. Fetch Target Entity (e.g. Evidence)
                if job.target_entity_type == "evidence":
                    evidence = db.query(Evidence).filter(Evidence.id == job.target_entity_id).first()
                    if not evidence:
                        raise ValueError(f"Evidence {job.target_entity_id} not found.")
                    
                    # Determine pipeline based on evidence type
                    if evidence.evidence_type in ["document", "image", "pdf"]:
                        await self._process_document(db, job, evidence)
                    elif evidence.evidence_type in ["video"]:
                        await self._process_video(db, job, evidence)
                    else:
                        logger.warning(f"Unsupported evidence type {evidence.evidence_type} for job {job.id}")
                
                job.status = "COMPLETED"
                job.processing_completed_at = datetime.utcnow()
                db.commit()
            
            except Exception as e:
                logger.exception(f"Error processing AI job {job.id}")
                job.status = "FAILED"
                job.error_details = str(e)
                job.processing_completed_at = datetime.utcnow()
                db.commit()

    async def _process_document(self, db: Session, job: AIProcessingJob, evidence: Evidence):
        # 1. OCR
        # Note: In real app, we load bytes from evidence.storage_path
        document_bytes = b"dummy_content"
        filename = evidence.title
        
        ocr_results = await self.ocr_provider.process_document(document_bytes, filename)
        
        full_text = ""
        for res in ocr_results:
            full_text += res.raw_text + "\n"
            db_ocr = AIOcrResult(
                source_entity_type="evidence",
                source_entity_id=evidence.id,
                raw_text=res.raw_text,
                page_number=res.page_number,
                confidence=res.confidence,
                bounding_boxes=res.bounding_boxes,
                provider=res.provider
            )
            db.add(db_ocr)
        
        db.flush()
        
        # 2. NLP / NER
        if full_text.strip():
            entities = await self.llm_provider.extract_entities(full_text)
            for ent in entities:
                db_ent = AIEntity(
                    entity_type=ent.entity_type,
                    attributes=ent.attributes,
                    source_entity_type="evidence",
                    source_entity_id=evidence.id,
                    confidence=ent.confidence,
                    verification_status="PENDING",
                    provider=ent.provider
                )
                db.add(db_ent)
        
        # We don't necessarily commit here, handled by parent

    async def _process_video(self, db: Session, job: AIProcessingJob, evidence: Evidence):
        # 1. Vision
        media_bytes = b"dummy_video"
        filename = evidence.title
        events = await self.vision_provider.process_media(media_bytes, filename)
        
        for ev in events:
            db_ev = AIEvent(
                event_type=ev.event_type,
                source_entity_type="evidence",
                source_entity_id=evidence.id,
                timestamp_reference=ev.timestamp,
                confidence=ev.confidence,
                provider=ev.provider
            )
            db.add(db_ev)

def run_job_sync(job_id: uuid.UUID):
    """Sync wrapper for ThreadPoolExecutor"""
    orchestrator = AIOrchestrator()
    asyncio.run(orchestrator.process_job_async(job_id))
