"""Officer CRUD + performance routes."""
import uuid

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INSPECTOR, ROLE_INVESTIGATOR, ROLE_POLICYMAKER, require_roles
from app.auth.scope import enforce_district_scope, enforce_record_district, is_multi_district
from app.database.postgres import get_db
from app.models.fir import FIR
from app.models.officer import Officer
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.officer import OfficerCreate, OfficerOut, OfficerPerformance, OfficerUpdate
from app.services import audit_service
from app.services.base_service import BaseCRUDService

router = APIRouter(prefix="/officers", tags=["Officers"], dependencies=[Depends(require_roles(*ALL_ROLES))])
officer_crud = BaseCRUDService(Officer)


@router.get("", response_model=PaginatedResponse[OfficerOut], dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))])
def list_officers(
    search: str | None = None,
    district: str | None = None,
    station: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Officer)
    
    if search:
        query = query.filter(or_(
            Officer.name.ilike(f"%{search}%"),
            Officer.badge_number.ilike(f"%{search}%"),
            Officer.email.ilike(f"%{search}%"),
            Officer.phone.ilike(f"%{search}%"),
        ))
    if district:
        query = query.filter(Officer.district == district)
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district:
        if not is_multi_district(current_user):
            query = query.filter(Officer.district == effective_district)
    if station:
        query = query.filter(Officer.station == station)
    if status:
        query = query.filter(Officer.status == status)
        
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=items
    )


@router.get("/{officer_id}", response_model=OfficerOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))])
def get_officer(officer_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    officer = officer_crud.get(db, officer_id)
    if officer is None:
        raise HTTPException(status_code=404, detail="Officer not found")
    enforce_record_district(current_user, officer.district, db)
    return officer


@router.get("/{officer_id}/performance", response_model=OfficerPerformance, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))])
def officer_performance(officer_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    officer = officer_crud.get(db, officer_id)
    if officer is None:
        raise HTTPException(status_code=404, detail="Officer not found")
    enforce_record_district(current_user, officer.district, db)
    firs = db.query(FIR).filter(FIR.investigating_officer_id == officer_id).all()
    closed = sum(1 for f in firs if f.status == "closed")
    return OfficerPerformance(
        officer_id=officer_id,
        total_firs_handled=len(firs),
        cases_closed=closed,
        cases_open=len(firs) - closed,
        avg_resolution_days=None,
    )


@router.post("", response_model=OfficerOut, dependencies=[Depends(require_roles(ROLE_ADMIN))])
def create_officer(payload: OfficerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        officer = officer_crud.create(db, payload.model_dump())
        audit_service.log_action(db, current_user, "CREATE", "Officer", str(officer.id))
        return officer
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Badge number or email already exists.")


@router.put("/{officer_id}", response_model=OfficerOut, dependencies=[Depends(require_roles(ROLE_ADMIN))])
def update_officer(officer_id: uuid.UUID, payload: OfficerUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        officer = officer_crud.update(db, officer_id, payload.model_dump(exclude_unset=True))
        audit_service.log_action(db, current_user, "UPDATE", "Officer", str(officer_id))
        return officer
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Badge number or email already exists.")

@router.delete("/{officer_id}", dependencies=[Depends(require_roles(ROLE_ADMIN))])
def delete_officer(officer_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    officer = officer_crud.get(db, officer_id)
    officer.status = "inactive"
    db.add(officer)
    audit_service.log_action(db, current_user, "DELETE", "Officer", str(officer_id))
    return {"detail": "Officer deactivated successfully"}


# ---------------------------------------------------------------------------
# Issue #107 — Officer image upload
# ---------------------------------------------------------------------------

from fastapi import UploadFile, File as FastAPIFile  # noqa: E402


@router.post("/{officer_id}/image", dependencies=[Depends(require_roles(ROLE_ADMIN))])
def upload_officer_image(
    officer_id: uuid.UUID,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    officer = officer_crud.get(db, officer_id)
    from app.services.person_image_service import store_person_image
    image_url = store_person_image(file, person_type="officers", person_id=officer_id)

    officer.image_url = image_url
    db.add(officer)
    db.commit()
    audit_service.log_action(db, current_user, "IMAGE_UPLOAD", "Officer", str(officer_id))
    return {"image_url": image_url}
