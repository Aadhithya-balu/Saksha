"""
Unified Investigation Interface — routes for investigation dashboard, timeline,
case progress, linked FIRs/criminals/evidence, AI recommendations, chat, and history.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, require_roles
from app.auth.scope import enforce_record_district
from app.database.postgres import get_db
from app.models.user import User
from app.services import audit_service
from app.services.investigation_service import get_investigation

router = APIRouter(prefix="/investigation", tags=["Investigation"], dependencies=[Depends(require_roles(*ALL_ROLES))])


# ── Response Schemas ──────────────────────────────────────────

class OfficerOut(BaseModel):
    id: str
    badge_number: str
    rank: str | None
    full_name: str
    district: str | None = None
    station: str | None = None


class CaseOut(BaseModel):
    id: str
    case_number: str
    description: str | None
    mo_tags: str | None
    status: str
    priority: str
    progress: int
    occurred_at: str
    reported_at: str
    created_at: str
    assigned_officer: OfficerOut | None
    crime_type: str | None = None
    location: str | None = None
    station: str | None = None
    district: str | None = None
    updated_at: str | None = None


class VehicleOut(BaseModel):
    id: str
    registration: str
    make_model: str | None = None
    color: str | None = None
    status: str = "Recorded"
    source_type: str = "FIR/Narrative"
    source_reference: str | None = None
    verification_status: str = "LINKED"
    confidence: float = 1.0


class LocationOut(BaseModel):
    id: str
    name: str
    type: str
    station: str | None = None
    district: str | None = None
    address: str | None = None


class OrganizationOut(BaseModel):
    id: str
    name: str
    type: str
    leader_name: str | None = None
    active_members: int = 1
    risk_level: str = "MODERATE"
    territory: str | None = None


class DigitalAccountOut(BaseModel):
    id: str
    account_type: str
    identifier: str
    associated_person: str | None = None
    source: str = "Case Record"
    verification_status: str = "VERIFIED"


class FIRCriminalOut(BaseModel):
    id: str
    full_name: str
    aliases: str | None
    status: str


class FIRVictimOut(BaseModel):
    id: str
    full_name: str
    contact_number: str | None
    gender: str | None
    age: int | None
    statement: str | None


class FIRSummaryOut(BaseModel):
    id: str
    fir_number: str
    complainant_name: str
    complainant_contact: str | None
    sections: str | None
    status: str
    filed_at: str
    narrative: str | None
    criminals: list[FIRCriminalOut]
    victims: list[FIRVictimOut]


class CriminalOut(BaseModel):
    id: str
    full_name: str
    aliases: str | None
    gender: str | None
    date_of_birth: str | None
    identifying_marks: str | None
    mo_summary: str | None
    status: str
    risk_score: int
    linked_fir_count: int


class EvidenceOut(BaseModel):
    id: str
    evidence_type: str
    description: str | None
    file_url: str | None
    collected_by: str | None
    chain_of_custody: str | None
    created_at: str


class TimelineEventOut(BaseModel):
    id: str | None = None
    timestamp: str
    event: str
    actor: str | None
    category: str
    source: str | None = "Case Record"
    source_id: str | None = None
    evidence_id: str | None = None
    details: str | None = None


class AIRecommendationOut(BaseModel):
    type: str
    title: str
    description: str
    priority: str


class HistoryEntryOut(BaseModel):
    timestamp: str
    action: str
    resource_type: str
    details: str | None
    officer_name: str | None
    officer_badge: str | None


class InvestigationResponse(BaseModel):
    case: CaseOut
    firs: list[FIRSummaryOut]
    criminals: list[CriminalOut]
    evidence: list[EvidenceOut]
    timeline: list[TimelineEventOut]
    ai_recommendations: list[AIRecommendationOut]
    history: list[HistoryEntryOut]
    vehicles: list[VehicleOut] = []
    locations: list[LocationOut] = []
    organizations: list[OrganizationOut] = []
    digital_accounts: list[DigitalAccountOut] = []
    forensic_reports_count: int = 0


class InvestigationChatRequest(BaseModel):
    case_id: uuid.UUID
    message: str
    session_id: str | None = None


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/{case_id}", response_model=InvestigationResponse)
def get_investigation_dashboard(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the full unified investigation interface for a crime case."""
    try:
        data = get_investigation(db, case_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Crime case not found.")
    enforce_record_district(
        current_user,
        data.case.district,
        db,
    )

    audit_service.log_action(db, current_user, "CASE_VIEW", "CrimeCase", str(case_id))

    case_dict = data.case.__dict__.copy()
    if case_dict.get("assigned_officer"):
        case_dict["assigned_officer"] = case_dict["assigned_officer"].__dict__

    return InvestigationResponse(
        case=CaseOut(**case_dict),
        firs=[FIRSummaryOut(**{**f.__dict__, "criminals": f.criminals, "victims": f.victims}) for f in data.firs],
        criminals=[CriminalOut(**c.__dict__) for c in data.criminals],
        evidence=[EvidenceOut(**e.__dict__) for e in data.evidence],
        timeline=[TimelineEventOut(**t.__dict__) for t in data.timeline],
        ai_recommendations=[AIRecommendationOut(**r.__dict__) for r in data.ai_recommendations],
        history=[HistoryEntryOut(**h.__dict__) for h in data.history],
        vehicles=[VehicleOut(**v.__dict__) for v in data.vehicles],
        locations=[LocationOut(**l.__dict__) for l in data.locations],
        organizations=[OrganizationOut(**o.__dict__) for o in data.organizations],
        digital_accounts=[DigitalAccountOut(**d.__dict__) for d in data.digital_accounts],
        forensic_reports_count=data.forensic_reports_count,
    )


@router.get("/{case_id}/timeline", response_model=list[TimelineEventOut])
def get_investigation_timeline(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the investigation timeline for a crime case."""
    try:
        data = get_investigation(db, case_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Crime case not found.")
    enforce_record_district(
        current_user,
        data.case.district,
        db,
    )

    return [TimelineEventOut(**t.__dict__) for t in data.timeline]


@router.get("/{case_id}/history", response_model=list[HistoryEntryOut])
def get_investigation_history(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the audit history for a crime case investigation."""
    try:
        data = get_investigation(db, case_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Crime case not found.")
    enforce_record_district(
        current_user,
        data.case.district,
        db,
    )

    return [HistoryEntryOut(**h.__dict__) for h in data.history]


@router.post("/chat")
async def investigation_chat(
    payload: InvestigationChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ask an AI question about a specific investigation case.
    The response is contextualized with the investigation data.
    """
    try:
        data = get_investigation(db, payload.case_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Crime case not found.")
    enforce_record_district(
        current_user,
        data.case.district,
        db,
    )

    case = data.case
    context_message = (
        f"Case {case.case_number} ({case.status}, priority: {case.priority}, "
        f"progress: {case.progress}%). "
        f"Description: {case.description or 'N/A'}. "
        f"Involved: {len(data.firs)} FIRs, {len(data.criminals)} criminals, {len(data.evidence)} evidence items. "
        f"User question: {payload.message}"
    )

    from app.ai.chat.orchestrator import ChatOrchestrator
    from app.routes.ai_chat import _build_response
    orchestrator = ChatOrchestrator()
    user_sid = f"user:{current_user.username}:{payload.session_id or 'default'}"
    result = orchestrator.process_message_sync(context_message, user_sid, db)
    return _build_response(result)

