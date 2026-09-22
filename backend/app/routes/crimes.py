"""Crime search + CRUD routes."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, require_roles
from app.auth.scope import enforce_district_scope, enforce_record_district, is_multi_district
from app.database.postgres import get_db
from app.models.crime import CrimeCase
from app.models.location import Location
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.crime import CrimeCaseCreate, CrimeCaseOut, CrimeCaseUpdate, CrimeTimelineEvent
from app.ai.inference.refresh import mark_data_changed
from app.services import audit_service
from app.services.case_status import (
    InvalidStatusTransitionError,
    is_immutable,
    validate_transition,
)
from app.services.crime_service import apply_status_transition, crime_crud, get_crime_timeline

router = APIRouter(prefix="/crimes", tags=["Crimes"], dependencies=[Depends(require_roles(*ALL_ROLES))])


@router.get("", response_model=PaginatedResponse[CrimeCaseOut])
def list_crimes(
    q: str | None = None,
    status: str | None = None,
    category_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = "occurred_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(CrimeCase)
    if status:
        query = query.filter(CrimeCase.status == status)
    if category_id:
        query = query.filter(CrimeCase.category_id == category_id)
    if location_id:
        query = query.filter(CrimeCase.location_id == location_id)
    if date_from:
        query = query.filter(CrimeCase.occurred_at >= date_from)
    if date_to:
        query = query.filter(CrimeCase.occurred_at <= date_to)
    if q:
        query = query.filter(CrimeCase.description.ilike(f"%{q}%"))
    effective_district = enforce_district_scope(current_user, None, db)
    if effective_district and not is_multi_district(current_user):
        query = query.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == effective_district)

    total = query.count()
    from sqlalchemy import asc, desc as sa_desc
    column = getattr(CrimeCase, sort_by, CrimeCase.occurred_at)
    query = query.order_by(sa_desc(column) if sort_order == "desc" else asc(column))

    results = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(total=total, page=page, page_size=page_size, results=results)


@router.get("/{crime_id}", response_model=CrimeCaseOut)
def get_crime(crime_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    crime = crime_crud.get(db, crime_id)
    if crime is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Crime case not found")
    enforce_record_district(current_user, crime.location.district if crime.location else None, db)
    return crime


@router.get("/{crime_id}/timeline", response_model=list[CrimeTimelineEvent])
def crime_timeline(crime_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    crime = crime_crud.get(db, crime_id)
    if crime is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Crime case not found")
    enforce_record_district(current_user, crime.location.district if crime.location else None, db)
    return get_crime_timeline(db, crime_id)


@router.post("", response_model=CrimeCaseOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST))])
def create_crime(payload: CrimeCaseCreate, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = payload.model_dump()
    # Validate initial status (no current status → creation path)
    initial_status = data.get("status", "active")
    try:
        canonical = validate_transition(None, initial_status)
    except InvalidStatusTransitionError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    data["status"] = canonical
    data.pop("found_by_police", None)
    crime = crime_crud.create(db, data)
    audit_service.log_action(db, current_user, "CREATE", "CrimeCase", str(crime.id), ip_address=request.client.host if request.client else None)
    mark_data_changed("crime_case", db=db)
    return crime


@router.put("/{crime_id}", response_model=CrimeCaseOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST))])
def update_crime(crime_id: uuid.UUID, payload: CrimeCaseUpdate, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    update_data = payload.model_dump(exclude_unset=True)
    crime = crime_crud.get(db, crime_id)

    # If a status change is requested, route through the transition validator.
    if "status" in update_data:
        new_status = update_data.pop("status")
        try:
            apply_status_transition(
                db, crime, new_status, current_user,
                ip_address=request.client.host if request.client else None,
            )
        except InvalidStatusTransitionError as exc:
            from fastapi import HTTPException
            raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # Guard: if the case is already immutable, reject any non-status field edits too.
    if is_immutable(crime.status) and update_data:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail=(
                f"Case '{crime.case_number}' has status '{crime.status}' which is locked. "
                "No fields may be modified on a locked case."
            ),
        )

    if update_data:
        for field, value in update_data.items():
            if value is not None:
                setattr(crime, field, value)
        db.add(crime)
        db.flush()
        audit_service.log_action(db, current_user, "UPDATE", "CrimeCase", str(crime_id), ip_address=request.client.host if request.client else None)

    mark_data_changed("crime_case", db=db)
    return crime


@router.delete("/{crime_id}", dependencies=[Depends(require_roles(ROLE_ADMIN))])
def delete_crime(crime_id: uuid.UUID, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    crime_crud.delete(db, crime_id)
    audit_service.log_action(db, current_user, "DELETE", "CrimeCase", str(crime_id), ip_address=request.client.host if request.client else None)
    mark_data_changed("crime_case", db=db)
    return {"message": "Crime case deleted"}
