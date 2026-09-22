import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ALL_ROLES,
    ROLE_ADMIN,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    require_roles,
)
from app.auth.scope import enforce_district_scope, enforce_record_district, is_multi_district
from app.database.postgres import get_db
from app.models.intervention import Intervention
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.intervention import (
    AdvanceStageRequest,
    InterventionCreate,
    InterventionListResponse,
    InterventionOut,
    InterventionUpdate,
)
from app.services import audit_service, intervention_service

router = APIRouter(
    prefix="/interventions",
    tags=["Interventions"],
    dependencies=[Depends(require_roles(*ALL_ROLES))],
)

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["supervisor_review", "draft"],
    "supervisor_review": ["approved", "draft", "supervisor_review"],
    "approved": ["deployed", "supervisor_review", "approved"],
    "deployed": ["outcome_review", "deployed"],
    "outcome_review": ["completed", "deployed", "outcome_review"],
    "completed": ["completed", "outcome_review"],
}



@router.get("", response_model=InterventionListResponse)
def list_interventions(
    district: str | None = None,
    status: str | None = None,
    workflow_stage: str | None = None,
    intelligence_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Intervention)
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district:
        if is_multi_district(current_user):
            query = query.filter(Intervention.district.ilike(f"%{effective_district}%"))
        else:
            query = query.filter(Intervention.district == effective_district)
    if status:
        query = query.filter(Intervention.status == status)
    if workflow_stage:
        query = query.filter(Intervention.workflow_stage == workflow_stage)
    if intelligence_id:
        query = query.filter(Intervention.intelligence_id == intelligence_id)
    total = query.count()
    rows = (
        query.order_by(Intervention.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": rows,
        "interventions": rows,
    }


@router.post(
    "",
    response_model=InterventionOut,
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))],
)
def create_intervention(
    payload: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    effective_district = enforce_district_scope(current_user, data.get("district"), db)
    if effective_district:
        data["district"] = effective_district
    intervention = Intervention(**data, created_by_id=current_user.id)
    db.add(intervention)
    db.flush()
    audit_service.log_action(db, current_user, "CREATE", "Intervention", str(intervention.id), details=payload.title)
    db.commit()
    db.refresh(intervention)
    return intervention


@router.get("/{intervention_id}", response_model=InterventionOut)
def get_intervention(
    intervention_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if intervention is None:
        raise HTTPException(status_code=404, detail="Intervention not found")
    enforce_record_district(current_user, intervention.district, db)
    return intervention


@router.put(
    "/{intervention_id}",
    response_model=InterventionOut,
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))],
)
@router.patch(
    "/{intervention_id}",
    response_model=InterventionOut,
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))],
)
def update_intervention(
    intervention_id: uuid.UUID,
    payload: InterventionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if intervention is None:
        return Response(status_code=404, content="Intervention not found")
    enforce_record_district(current_user, intervention.district, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(intervention, field, value)
    audit_service.log_action(db, current_user, "UPDATE", "Intervention", str(intervention_id))
    db.commit()
    db.refresh(intervention)
    return intervention


@router.post(
    "/{intervention_id}/advance-stage",
    response_model=InterventionOut,
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))],
)
def advance_intervention_stage(
    intervention_id: uuid.UUID,
    body: AdvanceStageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enforce human approval workflow progression:

    Draft -> Supervisor Review -> Approved -> Deployed -> Outcome Review -> Completed.
    No automatic operational deployment is permitted.
    """
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if intervention is None:
        raise HTTPException(status_code=404, detail="Intervention not found")

    enforce_record_district(current_user, intervention.district, db)

    current_stage = intervention.workflow_stage or "draft"
    target_stage = body.target_stage

    allowed = VALID_TRANSITIONS.get(current_stage, [])
    if target_stage not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid workflow transition from '{current_stage}' to '{target_stage}'. Allowed: {allowed}",
        )

    # Apply stage-specific transition rules
    now = datetime.now(timezone.utc)
    if target_stage == "supervisor_review":
        if body.notes:
            intervention.review_notes = body.notes
    elif target_stage == "approved":
        if body.notes:
            intervention.supervisor_notes = body.notes
        intervention.status = "planned"
    elif target_stage == "deployed":
        # Operational deployment signed off by human commander
        intervention.status = "active"
        if not intervention.started_at:
            intervention.started_at = now
        if body.notes:
            intervention.review_notes = (intervention.review_notes or "") + f"\n[Deployment] {body.notes}"
    elif target_stage == "outcome_review":
        # Deployment finished, ready for debrief
        if not intervention.ended_at:
            intervention.ended_at = now
    elif target_stage == "completed":
        intervention.status = "completed"
        if not intervention.ended_at:
            intervention.ended_at = now

    # Record any outcome review payload submitted with the transition
    if body.outcome_data:
        if "subsequent_crime_count" in body.outcome_data:
            intervention.subsequent_crime_count = body.outcome_data["subsequent_crime_count"]
        if "pattern_persisted" in body.outcome_data:
            intervention.pattern_persisted = body.outcome_data["pattern_persisted"]
        if "observed_outcome" in body.outcome_data:
            intervention.observed_outcome = body.outcome_data["observed_outcome"]
        if "review_notes" in body.outcome_data:
            intervention.review_notes = body.outcome_data["review_notes"]

    intervention.workflow_stage = target_stage
    audit_service.log_action(
        db,
        current_user,
        "WORKFLOW_STAGE_ADVANCE",
        "Intervention",
        str(intervention.id),
        details=f"Advanced stage from '{current_stage}' to '{target_stage}'",
    )
    db.commit()
    db.refresh(intervention)
    return intervention


@router.get("/{intervention_id}/effectiveness")
def intervention_effectiveness(
    intervention_id: uuid.UUID,
    window_days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pre/post crime-count comparison around the intervention window."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if intervention is None:
        return Response(status_code=404, content="Intervention not found")
    enforce_record_district(current_user, intervention.district, db)
    result = intervention_service.compute_effectiveness(db, intervention, window_days=window_days)
    db.commit()
    return result

