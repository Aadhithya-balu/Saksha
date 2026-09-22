import uuid
import threading
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.ai_processing import AIProcessingJob, AIOcrResult, AIEntity, AIEvent
from app.ai.orchestrator import run_job_sync

class AIProcessingService:
    @staticmethod
    def spawn_job(db: Session, target_type: str, target_id: uuid.UUID, job_type: str) -> AIProcessingJob:
        job = AIProcessingJob(
            target_entity_type=target_type,
            target_entity_id=target_id,
            job_type=job_type,
            status="QUEUED"
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Spawn background thread
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
