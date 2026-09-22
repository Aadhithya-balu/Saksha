from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.auth.dependencies import get_current_user
from app.auth.rbac import ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, REVIEW_ROLES, require_roles
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.ai_processing import (
    AIProcessingJobResponse,
    AIMatchRecordResponse,
    VerifyMatchRequest,
    SpawnJobRequest,
    AIEntityResponse,
)
from app.services.ai_processing_service import AIProcessingService
from app.services.audit_service import log_action
from app.services.entity_resolution_service import EntityResolutionService

router = APIRouter(prefix="/ai", tags=["ai_processing"])

_PROCESSING_ROLES = (ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST)
_REVIEW_ROLES = tuple(REVIEW_ROLES)


@router.get("/jobs", response_model=List[AIProcessingJobResponse])
def list_jobs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AIProcessingService.list_jobs(db, limit=limit)


@router.post(
    "/jobs",
    response_model=AIProcessingJobResponse,
    dependencies=[Depends(require_roles(*_PROCESSING_ROLES))],
)
def spawn_job(
    req: SpawnJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = AIProcessingService.spawn_job(db, req.target_type, req.target_id, req.job_type)
    log_action(db, current_user, "CREATE", "AIProcessingJob", str(job.id),
               details=f"spawn {req.job_type} on {req.target_type}")
    return job


@router.post(
    "/jobs/{job_id}/retry",
    response_model=AIProcessingJobResponse,
    dependencies=[Depends(require_roles(*_PROCESSING_ROLES))],
)
def retry_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = AIProcessingService.retry_job(db, job_id)
    if not job:
        raise HTTPException(status_code=400, detail="Job not found or not in failed state")
    log_action(db, current_user, "UPDATE", "AIProcessingJob", str(job.id), details="retry")
    return job


@router.get("/jobs/{job_id}", response_model=AIProcessingJobResponse)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = AIProcessingService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/results")
def get_job_results(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rich read surface for a job: OCR pages, entities and vision events."""
    job = AIProcessingService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return AIProcessingService.get_job_results(db, job_id)


@router.get("/jobs/{job_id}/entities", response_model=List[AIEntityResponse])
def get_job_entities(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = AIProcessingService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return AIProcessingService.get_entities_for_target(db, job.target_entity_type, job.target_entity_id)


@router.get("/matches", response_model=List[AIMatchRecordResponse])
def list_matches(
    status_filter: str = "PENDING",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return EntityResolutionService.list_pending_matches(db, status=status_filter)


@router.post(
    "/matches/{match_id}/verify",
    response_model=AIMatchRecordResponse,
    dependencies=[Depends(require_roles(*_REVIEW_ROLES))],
)
def verify_match(
    match_id: uuid.UUID,
    req: VerifyMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = EntityResolutionService.verify_match(db, match_id, req.decision, current_user.id)
    if not match:
        raise HTTPException(status_code=404, detail="Match record not found")
    log_action(db, current_user, "UPDATE", "AIMatchRecord", str(match.id),
               details=f"decision={req.decision}")
    return match


@router.post(
    "/entities/{entity_id}/generate_candidates",
    response_model=List[AIMatchRecordResponse],
    dependencies=[Depends(require_roles(*_REVIEW_ROLES))],
)
def generate_candidates(
    entity_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidates = EntityResolutionService.generate_candidates(db, entity_id)
    log_action(db, current_user, "CREATE", "AIMatchRecord", details=f"candidates for entity {entity_id}")
    return candidates