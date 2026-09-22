from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.database.postgres import get_db
from app.services.auth_service import get_current_user
from app.models.user import User
from app.schemas.ai_processing import (
    AIProcessingJobResponse, 
    AIMatchRecordResponse, 
    VerifyMatchRequest, 
    SpawnJobRequest,
    AIEntityResponse
)
from app.services.ai_processing_service import AIProcessingService
from app.services.entity_resolution_service import EntityResolutionService

router = APIRouter(prefix="/ai", tags=["ai_processing"])

@router.get("/jobs", response_model=List[AIProcessingJobResponse])
def list_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return AIProcessingService.list_jobs(db)

@router.post("/jobs", response_model=AIProcessingJobResponse)
def spawn_job(req: SpawnJobRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return AIProcessingService.spawn_job(db, req.target_type, req.target_id, req.job_type)

@router.post("/jobs/{job_id}/retry", response_model=AIProcessingJobResponse)
def retry_job(job_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = AIProcessingService.retry_job(db, job_id)
    if not job:
        raise HTTPException(status_code=400, detail="Job not found or not in failed state")
    return job

@router.get("/matches", response_model=List[AIMatchRecordResponse])
def list_matches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return EntityResolutionService.list_pending_matches(db)

@router.post("/matches/{match_id}/verify", response_model=AIMatchRecordResponse)
def verify_match(match_id: uuid.UUID, req: VerifyMatchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    match = EntityResolutionService.verify_match(db, match_id, req.decision, current_user.id)
    if not match:
        raise HTTPException(status_code=404, detail="Match record not found")
    return match

@router.post("/entities/{entity_id}/generate_candidates", response_model=List[AIMatchRecordResponse])
def generate_candidates(entity_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return EntityResolutionService.generate_candidates(db, entity_id)
