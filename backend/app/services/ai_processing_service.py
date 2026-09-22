import uuid
import threading
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.ai_processing import AIProcessingJob, AIOcrResult, AIEntity, AIEvent
from app.ai.orchestrator import run_job_sync

class AIProcessingService:
    @staticmethod
    def spawn_job(db: Session, target_type: str, target_id: uuid.UUID, job_type: str, background: bool = True) -> AIProcessingJob:
        job = AIProcessingJob(
            target_entity_type=target_type,
            target_entity_id=target_id,
            job_type=job_type,
            status="QUEUED"
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        if background:
            # Spawn background thread on the worker pool
            threading.Thread(target=run_job_sync, args=(job.id,), daemon=True).start()

        return job
    
    @staticmethod
    def retry_job(db: Session, job_id: uuid.UUID) -> Optional[AIProcessingJob]:
        job = db.query(AIProcessingJob).filter(AIProcessingJob.id == job_id).first()
        if not job or job.status not in ["FAILED", "QUEUED"]: # allow queued to be manually nudged
            return None
            
        job.status = "QUEUED"
        job.retry_count += 1
        job.error_details = None
        db.commit()
        db.refresh(job)
        
        threading.Thread(target=run_job_sync, args=(job.id,), daemon=True).start()
        return job

    @staticmethod
    def list_jobs(db: Session, limit: int = 100) -> List[AIProcessingJob]:
        return db.query(AIProcessingJob).order_by(AIProcessingJob.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_job(db: Session, job_id: uuid.UUID) -> Optional[AIProcessingJob]:
        return db.query(AIProcessingJob).filter(AIProcessingJob.id == job_id).first()

    @staticmethod
    def get_entities_for_target(db: Session, target_type: str, target_id: uuid.UUID) -> List[AIEntity]:
        return db.query(AIEntity).filter(
            AIEntity.source_entity_type == target_type, 
            AIEntity.source_entity_id == target_id
        ).all()

    @staticmethod
    def get_job_results(db: Session, job_id: uuid.UUID) -> dict:
        """Aggregated result surface for a job (OCR + NER + vision events)."""
        from app.models.ai_processing import AIOcrResult, AIEvent

        job = db.query(AIProcessingJob).filter(AIProcessingJob.id == job_id).first()
        if not job:
            return None
        ocr = (
            db.query(AIOcrResult)
            .filter(
                AIOcrResult.source_entity_type == job.target_entity_type,
                AIOcrResult.source_entity_id == job.target_entity_id,
            )
            .order_by(AIOcrResult.page_number.asc())
            .all()
        )
        events = (
            db.query(AIEvent)
            .filter(
                AIEvent.source_entity_type == job.target_entity_type,
                AIEvent.source_entity_id == job.target_entity_id,
            )
            .order_by(AIEvent.created_at.asc())
            .all()
        )
        entities = db.query(AIEntity).filter(
            AIEntity.source_entity_type == job.target_entity_type,
            AIEntity.source_entity_id == job.target_entity_id,
        ).all()
        return {
            "job_id": str(job.id),
            "status": job.status,
            "job_type": job.job_type,
            "target": {"entity_type": job.target_entity_type, "entity_id": str(job.target_entity_id)},
            "ocr_results": [
                {
                    "id": str(o.id),
                    "raw_text": o.raw_text,
                    "page_number": o.page_number,
                    "confidence": o.confidence,
                    "provider": o.provider,
                }
                for o in ocr
            ],
            "entities": [
                {
                    "id": str(e.id),
                    "entity_type": e.entity_type,
                    "attributes": e.attributes,
                    "confidence": e.confidence,
                    "verification_status": e.verification_status,
                    "provider": e.provider,
                }
                for e in entities
            ],
            "events": [
                {
                    "id": str(ev.id),
                    "event_type": ev.event_type,
                    "timestamp_reference": ev.timestamp_reference,
                    "confidence": ev.confidence,
                    "provider": ev.provider,
                }
                for ev in events
            ],
        }
