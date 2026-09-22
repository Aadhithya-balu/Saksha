import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    require_roles,
)
from app.core.exceptions import NotFoundException
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.ai_candidates import (
    AICandidateCreate,
    AICandidateListOut,
    AICandidateOut,
    AICandidateReviewRequest,
)
from app.services import audit_service
from app.services.ai_candidate_service import (
    CandidateReviewError,
    accept_candidate,
    create_candidate,
    get_candidate,
    list_candidates,
    reject_candidate,
)

router = APIRouter(prefix="/ai/candidates", tags=["AI Candidates"])

REVIEW_ROLES = Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR))


@router.get("", response_model=AICandidateListOut)
def list_ai_candidates(
    status: str | None = Query(None, description="Filter by PROPOSED / ACCEPTED / REJECTED"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_candidates(db, status=status, limit=limit, offset=offset)


@router.get("/{candidate_id}", response_model=AICandidateOut)
def get_ai_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_candidate(db, candidate_id)
    except NotFoundException:
        raise HTTPException(404, "Candidate not found")


@router.post("", response_model=AICandidateOut, dependencies=[REVIEW_ROLES])
def create_ai_candidate(
    payload: AICandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Propose a review-gated knowledge record (pipeline / analyst entry point)."""
    candidate = create_candidate(
        db,
        candidate_type=payload.candidate_type,
        source_entity_type=payload.source_entity_type,
        source_entity_id=payload.source_entity_id,
        proposed_payload=payload.proposed_payload,
        confidence=payload.confidence,
        provenance=payload.provenance,
    )
    audit_service.log_action(
        db, current_user, "CREATE", "AICandidateRecord", str(candidate.id),
        details=f"proposed {candidate.candidate_type}",
    )
    return candidate


@router.post("/{candidate_id}/accept", response_model=AICandidateOut, dependencies=[REVIEW_ROLES])
def accept_ai_candidate(
    candidate_id: uuid.UUID,
    payload: AICandidateReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a PROPOSED candidate and materialize its crime case / FIR."""
    try:
        candidate, created = accept_candidate(
            db, candidate_id, current_user,
            review_note=payload.review_note,
            overrides=payload.overrides or None,
        )
    except CandidateReviewError as exc:
        raise HTTPException(422, str(exc))
    except NotFoundException:
        raise HTTPException(404, "Candidate not found")
    return candidate


@router.post("/{candidate_id}/reject", response_model=AICandidateOut, dependencies=[REVIEW_ROLES])
def reject_ai_candidate(
    candidate_id: uuid.UUID,
    payload: AICandidateReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return reject_candidate(db, candidate_id, current_user, review_note=payload.review_note)
    except CandidateReviewError as exc:
        raise HTTPException(422, str(exc))
    except NotFoundException:
        raise HTTPException(404, "Candidate not found")