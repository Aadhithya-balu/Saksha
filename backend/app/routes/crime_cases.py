"""API endpoints for Crime Case Management Workflow."""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, require_roles
from app.auth.scope import enforce_district_scope, enforce_record_district, is_multi_district
from app.database.postgres import get_db
from app.models.crime import CrimeCase
from app.models.fir import FIR
from app.models.officer import Officer
from app.models.location import Location
from app.models.crime_category import CrimeCategory
from app.models.investigation_note import InvestigationNote
from app.models.user import User

from app.schemas.common import PaginatedResponse
from app.schemas.crime import CrimeCaseCreate, CrimeCaseOut, CrimeCaseUpdate
from app.schemas.fir import FIROut
from app.schemas.officer import OfficerOut
from app.ai.inference.refresh import mark_data_changed
from app.services import audit_service
from app.services.case_status import (
    InvalidStatusTransitionError,
    is_immutable,
    validate_transition,
)
from app.services.crime_service import apply_status_transition, crime_crud
from app.services.realtime.bus import realtime_bus
from app.services.ttl_cache import invalidate_ttl_cache_prefix, ttl_cached

router = APIRouter(prefix="/crime-cases", tags=["Crime Case Management"], dependencies=[Depends(require_roles(*ALL_ROLES))])


# --- Schemas ---

class InvestigationNoteCreate(BaseModel):
    content: str


class InvestigationNoteOut(BaseModel):
    id: uuid.UUID
    officer_name: str
    officer_badge: str
    created_at: datetime
    content: str


class TimelineEventOut(BaseModel):
    timestamp: datetime
    event: str
    actor: str | None = None


class CrimeCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    section_code: str | None = None
    severity: str | None = None


class LocationSimpleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    district: str
    station: str
    pincode: str | None = None


class AIRecommendationOut(BaseModel):
    type: str
    title: str
    description: str


class CrimeCaseDetailOut(CrimeCaseOut):
    priority: str
    progress: int
    assigned_officer_id: uuid.UUID | None
    assigned_officer: Any | None = None
    notes: list[InvestigationNoteOut]
    timeline: list[TimelineEventOut]
    firs: list[FIROut]
    ai_recommendations: list[AIRecommendationOut]
    location: LocationSimpleOut | None = None
    category: CrimeCategoryOut | None = None


class LinkFIRsPayload(BaseModel):
    fir_ids: list[uuid.UUID]


class OfficerWithUserOut(OfficerOut):
    full_name: str


class CrimeCaseInsightsOut(BaseModel):
    total_cases: int
    open: int
    investigating: int
    charge_sheet: int
    closed: int
    critical: int
    high: int
    medium: int
    low: int
    avg_progress: int
    clearance_rate: int


# --- Endpoints ---

@router.get("", response_model=PaginatedResponse[CrimeCaseDetailOut])
def list_cases(
    q: str | None = None,
    status: str | None = None,
    category_id: uuid.UUID | None = None,
    district: str | None = None,
    priority: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List crime cases from PostgreSQL with complete detail attributes.

    Newest cases first. ``q`` matches anywhere in the case number (e.g.
    ``5537`` finds ``CR-2026-BLR-5537``) or the description.
    """
    query = (
        db.query(CrimeCase)
        .options(
            joinedload(CrimeCase.assigned_officer)
            .joinedload(Officer.user),
            joinedload(CrimeCase.location),
            joinedload(CrimeCase.category),
        )
        .order_by(CrimeCase.reported_at.desc())
    )
    if status:
        query = query.filter(CrimeCase.status == status)
    if category_id:
        query = query.filter(CrimeCase.category_id == category_id)
    if priority:
        query = query.filter(CrimeCase.priority == priority)
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district:
        query = query.join(Location, CrimeCase.location_id == Location.id)
        if is_multi_district(current_user):
            query = query.filter(
                (Location.district == effective_district) | (Location.station == effective_district)
            )
        else:
            query = query.filter(Location.district == effective_district)

    from app.auth.scope import is_court_user
    if is_court_user(current_user) and not is_multi_district(current_user):
        org_id = getattr(current_user, "organization_id", None)
        if org_id:
            from app.models.case_access import CaseAccess
            allowed_case_ids = (
                db.query(CaseAccess.case_id)
                .filter(CaseAccess.organization_id == org_id, CaseAccess.status == "active")
                .subquery()
            )
            query = query.filter(CrimeCase.id.in_(allowed_case_ids))
        else:
            from sqlalchemy import false
            query = query.filter(false())
    if q:
        query = query.filter(
            (CrimeCase.case_number.ilike(f"%{q}%")) | (CrimeCase.description.ilike(f"%{q}%"))
        )

    total = query.count()
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    extended_results = []
    for case in results:
        priority = case.priority or "medium"
        progress = case.progress if case.progress is not None else 10
        assigned_officer_id = case.assigned_officer_id
        assigned_officer = None
        if case.assigned_officer:
            assigned_officer = {
                "id": case.assigned_officer.id,
                "badge_number": case.assigned_officer.badge_number,
                "rank": case.assigned_officer.rank,
                "district": case.assigned_officer.district,
                "station": case.assigned_officer.station,
                "full_name": case.assigned_officer.user.full_name if case.assigned_officer.user else case.assigned_officer.name
            }

        # Query investigation notes for case
        notes_db = db.query(InvestigationNote).filter(InvestigationNote.case_id == case.id).order_by(InvestigationNote.created_at.desc()).all()
        notes_out = [
            InvestigationNoteOut(
                id=n.id,
                officer_name=n.officer_name,
                officer_badge=n.officer_badge,
                created_at=n.created_at,
                content=n.content
            )
            for n in notes_db
        ]

        extended_results.append(
            CrimeCaseDetailOut(
                id=case.id,
                case_number=case.case_number,
                category_id=case.category_id,
                location_id=case.location_id,
                occurred_at=case.occurred_at,
                reported_at=case.reported_at,
                description=case.description,
                mo_tags=case.mo_tags,
                status=case.status,
                created_at=case.created_at,
                priority=priority,
                progress=progress,
                assigned_officer_id=assigned_officer_id,
                assigned_officer=assigned_officer,
                notes=notes_out,
                timeline=[],
                firs=[],
                ai_recommendations=[],
                location=case.location,
                category=case.category,
            )
        )

    return PaginatedResponse(total=total, page=page, page_size=page_size, results=extended_results)


# --- Static Routes (Must be declared before parameterized /{case_id} route to avoid validation conflict) ---

@router.get("/unassigned-officers", response_model=list[OfficerWithUserOut])
def list_unassigned_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all officer profiles with full names for assignment dropdowns."""
    officers = db.query(Officer).join(User).all()
    results = []
    for off in officers:
        results.append(
            OfficerWithUserOut(
                id=off.id,
                user_id=off.user_id,
                badge_number=off.badge_number,
                rank=off.rank,
                district=off.district,
                station=off.station,
                created_at=off.created_at,
                full_name=off.user.full_name,
                name=off.name
            )
        )
    return results


@router.get("/unlinked-firs", response_model=list[FIROut])
def list_unlinked_firs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all FIRs so they can be selected for linking to cases."""
    firs = db.query(FIR).all()
    return [FIROut.model_validate(fir) for fir in firs]


@router.get("/categories", response_model=list[CrimeCategoryOut])
def list_crime_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of all categories."""
    return ttl_cached(
        "crime_cases:categories",
        (),
        120,
        lambda: [CrimeCategoryOut.model_validate(c) for c in db.query(CrimeCategory).all()],
        scope=db.get_bind(),
    )


@router.get("/locations", response_model=list[LocationSimpleOut])
def list_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of all locations."""
    return ttl_cached(
        "crime_cases:locations",
        (),
        120,
        lambda: [LocationSimpleOut.model_validate(loc) for loc in db.query(Location).all()],
        scope=db.get_bind(),
    )


@router.get("/insights", response_model=CrimeCaseInsightsOut)
def crime_case_insights(
    status: str | None = None,
    category_id: uuid.UUID | None = None,
    district: str | None = None,
    priority: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated crime case analytics computed directly from the database.

    Mirrors the filters used by the case list so the telemetry ribbon reflects
    the full filtered dataset rather than a single (paginated) page of rows.
    """
    base = db.query(CrimeCase)
    if status:
        base = base.filter(CrimeCase.status == status)
    if category_id:
        base = base.filter(CrimeCase.category_id == category_id)
    if priority:
        base = base.filter(CrimeCase.priority == priority)
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district:
        base = base.join(Location, CrimeCase.location_id == Location.id)
        if is_multi_district(current_user):
            base = base.filter(
                (Location.district == effective_district) | (Location.station == effective_district)
            )
        else:
            base = base.filter(Location.district == effective_district)

    rows = base.all()

    def s(*values: str) -> int:
        return sum(1 for r in rows if (r.status or "").lower() in values)

    def p(value: str) -> int:
        return sum(1 for r in rows if (r.priority or "").lower() == value)

    total = len(rows)
    open_count = s("open", "assigned")
    investigating_count = s("investigating", "evidence collected")
    charge_sheet = s("charge sheet filed")
    closed = s("closed")

    total_progress = sum(r.progress or 0 for r in rows)

    return CrimeCaseInsightsOut(
        total_cases=total,
        open=open_count,
        investigating=investigating_count,
        charge_sheet=charge_sheet,
        closed=closed,
        critical=p("critical"),
        high=p("high"),
        medium=p("medium"),
        low=p("low"),
        avg_progress=round(total_progress / total) if total else 0,
        clearance_rate=round((closed / total) * 100) if total else 0,
    )


# --- Parameterized Routes ---

@router.get("/{case_id}", response_model=CrimeCaseDetailOut)
def get_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full details of a crime case, including linked FIRs, timeline and persisted investigation notes."""
    case = (
        db.query(CrimeCase)
        .options(
            joinedload(CrimeCase.assigned_officer)
            .joinedload(Officer.user),
            joinedload(CrimeCase.location),
            joinedload(CrimeCase.category),
        )
        .filter(CrimeCase.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Crime case not found")

    enforce_record_district(current_user, case.location.district if case.location else None, db)

    from app.auth.scope import is_court_user, check_case_access
    if is_court_user(current_user) and not check_case_access(current_user, case.id, db):
        raise HTTPException(status_code=403, detail="Your organization is not authorized to access this case")

    # 1. Fetch linked FIRs from existing table
    firs_list = db.query(FIR).filter(FIR.crime_case_id == case.id).all()
    firs_out = [FIROut.model_validate(fir) for fir in firs_list]

    # 2. Build timeline from report date + linked FIR registrations + investigation notes
    timeline = [
        TimelineEventOut(timestamp=case.reported_at, event="Case Created", actor=None)
    ]
    for fir in firs_list:
        timeline.append(
            TimelineEventOut(
                timestamp=fir.filed_at,
                event=f"FIR {fir.fir_number} Linked",
                actor=fir.complainant_name
            )
        )

    # Query notes from PostgreSQL investigation_notes table
    notes_db = db.query(InvestigationNote).filter(InvestigationNote.case_id == case.id).order_by(InvestigationNote.created_at.desc()).all()
    for note in notes_db:
        timeline.append(
            TimelineEventOut(
                timestamp=note.created_at,
                event="Investigation Note Added",
                actor=note.officer_name
            )
        )

    timeline = sorted(timeline, key=lambda e: e.timestamp)

    notes_out = [
        InvestigationNoteOut(
            id=n.id,
            officer_name=n.officer_name,
            officer_badge=n.officer_badge,
            created_at=n.created_at,
            content=n.content
        )
        for n in notes_db
    ]

    # 3. AI Recommendations — only real, DB-derived directives are returned (empty otherwise)
    ai_recommendations = []

    priority = case.priority or "medium"
    progress = case.progress if case.progress is not None else 10
    assigned_officer_id = case.assigned_officer_id
    assigned_officer = None
    if case.assigned_officer:
        assigned_officer = {
            "id": case.assigned_officer.id,
            "badge_number": case.assigned_officer.badge_number,
            "rank": case.assigned_officer.rank,
            "district": case.assigned_officer.district,
            "station": case.assigned_officer.station,
            "full_name": case.assigned_officer.user.full_name if case.assigned_officer.user else case.assigned_officer.name
        }

    return CrimeCaseDetailOut(
        id=case.id,
        case_number=case.case_number,
        category_id=case.category_id,
        location_id=case.location_id,
        occurred_at=case.occurred_at,
        reported_at=case.reported_at,
        description=case.description,
        mo_tags=case.mo_tags,
        status=case.status,
        created_at=case.created_at,
        priority=priority,
        progress=progress,
        assigned_officer_id=assigned_officer_id,
        assigned_officer=assigned_officer,
        notes=notes_out,
        timeline=timeline,
        firs=firs_out,
        ai_recommendations=ai_recommendations,
        location=case.location,
        category=case.category,
    )


@router.post("", response_model=CrimeCaseOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST))])
def create_case(
    payload: CrimeCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new crime case in PostgreSQL."""
    data = payload.model_dump()
    data.pop("found_by_police", None)
    # Validate initial status (creation path — no current status)
    initial_status = data.get("status", "active")
    try:
        data["status"] = validate_transition(None, initial_status)
    except InvalidStatusTransitionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    case = crime_crud.create(db, data)
    audit_service.log_action(db, current_user, "CREATE", "CrimeCase", str(case.id))

    # Real-time push: refresh server defaults, then fan out to SSE subscribers.
    # Payload mirrors GET /dashboard/recent-incidents items so clients can
    # prepend it to the live incident log without a refetch.
    try:
        db.refresh(case)
        category_name = case.category.name if case.category else "Unclassified"
        location_label = (
            (case.location.station or case.location.district) if case.location else "Unknown"
        )
        realtime_bus.publish(
            "case_created",
            {
                "id": str(case.id),
                "case_number": case.case_number,
                "crime_type": category_name,
                "location": location_label,
                "time": case.occurred_at.isoformat() if case.occurred_at else None,
                "status": case.status,
                "priority": case.priority or "medium",
                "reported_at": case.reported_at.isoformat() if case.reported_at else None,
                "created_at": case.created_at.isoformat() if case.created_at else None,
            },
        )
    except Exception:
        pass

    mark_data_changed("crime_case", db=db)
    invalidate_ttl_cache_prefix("dashboard")
    return case


@router.put("/{case_id}", response_model=CrimeCaseOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_CRIME_ANALYST))])
def update_case(
    case_id: uuid.UUID,
    payload: CrimeCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a crime case with priority, progress, status, and assigned officer."""
    update_data = payload.model_dump(exclude_unset=True)
    case = crime_crud.get(db, case_id)

    if "status" in update_data:
        new_status = update_data.pop("status")
        try:
            apply_status_transition(db, case, new_status, current_user)
        except InvalidStatusTransitionError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # Reject any non-status edits on a locked case
    if is_immutable(case.status) and update_data:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Case '{case.case_number}' has status '{case.status}' which is locked. "
                "No fields may be modified on a locked case."
            ),
        )

    if update_data:
        for field, value in update_data.items():
            if value is not None:
                setattr(case, field, value)
        db.add(case)
        db.flush()
        audit_service.log_action(db, current_user, "UPDATE", "CrimeCase", str(case_id))

    mark_data_changed("crime_case", db=db)
    invalidate_ttl_cache_prefix("dashboard")
    return case


@router.delete("/{case_id}", dependencies=[Depends(require_roles(ROLE_ADMIN))])
def delete_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a crime case and all dependent records.

    Explicitly removes children before the parent so we never depend on
    ON DELETE CASCADE constraints that may be missing in the actual database.
    Each child-table cleanup is guarded so a missing table in a partial
    deployment never blocks the parent deletion.
    """
    from sqlalchemy import inspect as sa_inspect
    from sqlalchemy import text as sa_text

    try:
        # Verify case exists first
        case = db.query(CrimeCase).filter(CrimeCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Crime case not found")

        # Discover which tables actually exist (some children may not be
        # created in this deployment).
        existing = set(sa_inspect(db.bind).get_table_names())
        cid = str(case_id)

        def exec_del(table: str, where_sql: str, params: dict) -> None:
            """Run a DELETE if the target table exists, else skip."""
            if table not in existing:
                return
            db.execute(sa_text(f"DELETE FROM {table} WHERE {where_sql}"), params)

        def exec_any(sql: str, params: dict) -> None:
            db.execute(sa_text(sql), params)

        # 1. FIR child tables (links → FIRs)
        fir_rows = db.execute(sa_text("SELECT id FROM firs WHERE crime_case_id = :cid"), {"cid": cid}).fetchall() if "firs" in existing else []
        fir_ids = [str(r[0]) for r in fir_rows]
        if fir_ids:
            fid_list = ",".join(f"'{fid}'" for fid in fir_ids)
            for tbl in ("fir_criminal_links", "fir_victim_links"):
                if tbl in existing:
                    exec_del(tbl, f"fir_id IN ({fid_list})", {})
            exec_del("firs", "crime_case_id = :cid", {"cid": cid})

        # 2. Evidence child tables → Evidence
        ev_rows = db.execute(sa_text("SELECT id FROM evidence WHERE case_id = :cid"), {"cid": cid}).fetchall() if "evidence" in existing else []
        ev_ids = [str(r[0]) for r in ev_rows]
        if ev_ids:
            eid_list = ",".join(f"'{eid}'" for eid in ev_ids)
            for tbl in (
                "evidence_metadata",
                "evidence_timeline",
                "evidence_assignments",
                "chain_of_custody",
                "evidence_ai_summary",
                "report_evidence_links",
            ):
                if tbl in existing:
                    exec_del(tbl, f"evidence_id IN ({eid_list})", {})
            exec_del("evidence", "case_id = :cid", {"cid": cid})

        # 3. Case MO tag links
        exec_del("case_mo_tags", "case_id = :cid", {"cid": cid})

        # 4. Investigation notes (ORM cascade target)
        exec_del("investigation_notes", "case_id = :cid", {"cid": cid})

        # 5. Reports → SET NULL case_id (reports are independent records)
        if "reports" in existing:
            exec_any("UPDATE reports SET case_id = NULL WHERE case_id = :cid", {"cid": cid})

        # 6. Now safe to delete the case itself
        db.delete(case)
        db.flush()

        audit_service.log_action(db, current_user, "DELETE", "CrimeCase", str(case_id))
        mark_data_changed("crime_case", db=db)
        return {"message": "Crime case deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete crime case: {exc}") from exc


@router.post("/{case_id}/notes", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def add_case_note(
    case_id: uuid.UUID,
    payload: InvestigationNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add and persist an investigation note in PostgreSQL."""
    # Verify case exists
    crime_crud.get(db, case_id)

    # Check if officer record exists for current_user
    officer = db.query(Officer).filter(Officer.user_id == current_user.id).first()
    officer_id = officer.id if officer else None
    officer_name = current_user.full_name or current_user.username
    officer_badge = officer.badge_number if officer else current_user.username

    note = InvestigationNote(
        case_id=case_id,
        officer_id=officer_id,
        officer_name=officer_name,
        officer_badge=officer_badge,
        content=payload.content
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    audit_service.log_action(
        db, current_user, "CREATE", "InvestigationNote", f"Note added to case {case_id}"
    )
    return {"message": "Investigation note added successfully", "id": str(note.id), "content": note.content}


@router.delete("/{case_id}/notes/{note_id}", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def delete_case_note(
    case_id: uuid.UUID,
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an investigation note from PostgreSQL."""
    note = db.query(InvestigationNote).filter(
        InvestigationNote.id == note_id,
        InvestigationNote.case_id == case_id
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Investigation note not found")

    db.delete(note)
    db.commit()

    audit_service.log_action(
        db, current_user, "DELETE", "InvestigationNote", f"Note {note_id} deleted"
    )
    return {"message": "Investigation note deleted successfully"}



@router.post("/{case_id}/link-firs", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def link_firs_to_case(
    case_id: uuid.UUID,
    payload: LinkFIRsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Link multiple FIRs to a crime case using the existing 'crime_case_id' column relationship.
    """
    # Verify case exists
    crime_crud.get(db, case_id)

    for fir_id in payload.fir_ids:
        fir = db.query(FIR).filter(FIR.id == fir_id).first()
        if fir:
            fir.crime_case_id = case_id
    db.commit()

    audit_service.log_action(
        db, current_user, "UPDATE", "CrimeCase", f"Linked {len(payload.fir_ids)} FIRs to case {case_id}"
    )
    mark_data_changed("fir", db=db)
    return {"message": f"Successfully linked {len(payload.fir_ids)} FIRs"}
