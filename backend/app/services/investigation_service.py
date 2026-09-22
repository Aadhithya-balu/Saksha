"""
Investigation service — compiles full investigation context for a crime case.

Aggregates data from CrimeCase, FIRs, Criminals, Evidence, and AuditLog
into a single unified investigation interface response.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.audit_log import AuditLog
from app.models.crime import CrimeCase
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.officer import Officer
from app.models.investigation_note import InvestigationNote
from app.models.chain_of_custody import ChainOfCustody
from app.models.forensic_report import ForensicReport



# ── Data classes for structured output ─────────────────────────

@dataclass
class InvestigationOfficer:
    id: str
    badge_number: str
    rank: str | None
    full_name: str
    district: str
    station: str


@dataclass
class InvestigationCase:
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
    assigned_officer: InvestigationOfficer | None
    crime_type: str | None = None
    location: str | None = None
    station: str | None = None
    district: str | None = None
    updated_at: str | None = None


@dataclass
class InvestigationVehicle:
    id: str
    registration: str
    make_model: str | None = None
    color: str | None = None
    status: str = "Recorded"
    source_type: str = "FIR/Narrative"
    source_reference: str | None = None
    verification_status: str = "LINKED"
    confidence: float = 1.0


@dataclass
class InvestigationLocation:
    id: str
    name: str
    type: str  # Crime Scene, Police Station, Transit Corridor
    station: str | None = None
    district: str | None = None
    address: str | None = None


@dataclass
class InvestigationOrganization:
    id: str
    name: str
    type: str  # Syndicate, Gang, Network
    leader_name: str | None = None
    active_members: int = 1
    risk_level: str = "MODERATE"
    territory: str | None = None


@dataclass
class InvestigationDigitalAccount:
    id: str
    account_type: str  # Phone, Email, Device, CCTV
    identifier: str
    associated_person: str | None = None
    source: str = "Case Record"
    verification_status: str = "VERIFIED"


@dataclass
class InvestigationFIR:
    id: str
    fir_number: str
    complainant_name: str
    complainant_contact: str | None
    sections: str | None
    status: str
    filed_at: str
    narrative: str | None
    criminals: list[dict]
    victims: list[dict]


@dataclass
class InvestigationCriminal:
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


@dataclass
class InvestigationEvidence:
    id: str
    evidence_type: str
    description: str | None
    file_url: str | None
    collected_by: str | None
    chain_of_custody: str | None
    created_at: str


@dataclass
class InvestigationTimelineEvent:
    id: str
    timestamp: str
    event: str
    actor: str | None
    category: str  # case / fir / evidence / forensic / custody / status / note
    source: str = "Case Record"
    source_id: str | None = None
    evidence_id: str | None = None
    details: str | None = None


@dataclass
class InvestigationAIRecommendation:
    type: str
    title: str
    description: str
    priority: str  # high / medium / low


@dataclass
class InvestigationHistoryEntry:
    timestamp: str
    action: str
    resource_type: str
    details: str | None
    officer_name: str | None
    officer_badge: str | None


@dataclass
class InvestigationData:
    case: InvestigationCase
    firs: list[InvestigationFIR]
    criminals: list[InvestigationCriminal]
    evidence: list[InvestigationEvidence]
    timeline: list[InvestigationTimelineEvent]
    ai_recommendations: list[InvestigationAIRecommendation]
    history: list[InvestigationHistoryEntry]
    vehicles: list[InvestigationVehicle] = field(default_factory=list)
    locations: list[InvestigationLocation] = field(default_factory=list)
    organizations: list[InvestigationOrganization] = field(default_factory=list)
    digital_accounts: list[InvestigationDigitalAccount] = field(default_factory=list)
    forensic_reports_count: int = 0



def _calculate_criminal_risk(criminal: Criminal, fir_count: int) -> int:
    """Calculate a simple risk score for a criminal based on attributes."""
    score = 35
    if fir_count >= 3:
        score += 25
    elif fir_count >= 2:
        score += 15
    else:
        score += 5

    if criminal.status == "at_large":
        score += 20
    elif criminal.status == "arrested":
        score -= 10

    if criminal.mo_summary:
        mo_words = len(criminal.mo_summary.split())
        score += min(15, mo_words * 2)

    return min(100, max(5, score))


def _generate_ai_recommendations(case: CrimeCase, firs: list[FIR], evidence: list[Evidence], db: Session | None = None) -> list[InvestigationAIRecommendation]:
    """Generate AI recommendations based on case data patterns and MO matching."""
    recommendations = []

    # Check severity-based recommendations
    if case.category and case.category.severity == "high":
        recommendations.append(InvestigationAIRecommendation(
            type="priority",
            title="High Severity Alert",
            description="This case is classified as high severity. Prioritize resource allocation and periodic review.",
            priority="high",
        ))

    # Real MO pattern matching leads
    if db is not None:
        try:
            from app.services.mo_matching_service import match_case_against_db
            mo_matches = match_case_against_db(db, case.id, top_k=2, min_similarity=0.60)
            if "error" not in mo_matches:
                for suspect in mo_matches.get("matching_suspects", []):
                    if suspect.get("similarity_percent", 0) >= 65 and not suspect.get("is_confirmed_relationship"):
                        factors = ", ".join(suspect.get("matching_factors", [])[:2])
                        recommendations.append(InvestigationAIRecommendation(
                            type="pattern",
                            title=f"Potential Suspect Lead: {suspect['full_name']} ({suspect['similarity_percent']}% MO Match)",
                            description=f"Investigative similarity detected based on: {factors}. Cross-reference alibi and whereabouts.",
                            priority="high" if suspect["similarity_percent"] >= 75 else "medium",
                        ))
                for other_c in mo_matches.get("matching_cases", []):
                    if other_c.get("similarity_percent", 0) >= 65:
                        recommendations.append(InvestigationAIRecommendation(
                            type="pattern",
                            title=f"Serial Pattern Link: Case {other_c['case_number']} ({other_c['similarity_percent']}% Match)",
                            description=f"Similar MO tactics identified in {other_c['district'] or 'district'}. Coordinate with investigating officers.",
                            priority="medium",
                        ))
        except Exception:
            pass

    # Evidence recommendations
    if evidence:
        digital_evidence = [e for e in evidence if e.evidence_type == "digital" or e.evidence_type == "document"]
        if digital_evidence:
            recommendations.append(InvestigationAIRecommendation(
                type="evidence",
                title="Digital Forensics Required",
                description=f"{len(digital_evidence)} digital/document evidence items require forensic analysis.",
                priority="medium",
            ))
    else:
        recommendations.append(InvestigationAIRecommendation(
            type="evidence",
            title="Evidence Collection Needed",
            description="No evidence has been logged for this case. Initiate evidence collection immediately.",
            priority="high",
        ))

    # FIR-based recommendations
    open_firs = [f for f in firs if f.status != "closed"]
    if len(open_firs) > 2:
        recommendations.append(InvestigationAIRecommendation(
            type="workload",
            title="Multiple Open FIRs",
            description=f"{len(open_firs)} FIRs are still open. Consider workload distribution.",
            priority="medium",
        ))

    # Case stale check
    if case.reported_at:
        reported_at = case.reported_at
        if reported_at.tzinfo is None:
            reported_at = reported_at.replace(tzinfo=timezone.utc)
        days_open = (datetime.now(timezone.utc) - reported_at).days
        if days_open > 30 and case.status not in ("closed", "charge sheet filed"):
            recommendations.append(InvestigationAIRecommendation(
                type="aging",
                title="Aging Case Alert",
                description=f"This case has been open for {days_open} days. Review progress and consider escalation.",
                priority="high",
            ))

    # Default recommendation if none generated
    if not recommendations:
        recommendations.append(InvestigationAIRecommendation(
            type="general",
            title="Standard Investigation Protocol",
            description="Initiate standard investigation procedures: gather evidence, record statements, and verify alibis.",
            priority="medium",
        ))

    return recommendations


def _build_timeline(
    case: CrimeCase,
    firs: list[FIR],
    evidence: list[Evidence],
    history: list[AuditLog],
    notes: list[InvestigationNote] = None,
    custody_records: list[ChainOfCustody] = None,
    forensic_reports: list[ForensicReport] = None,
) -> list[InvestigationTimelineEvent]:
    """Build a chronological, source-traceable timeline from all case events."""
    events: list[InvestigationTimelineEvent] = []

    # Case creation / incident occurred
    if case.occurred_at:
        events.append(InvestigationTimelineEvent(
            id=f"evt-incident-{case.id}",
            timestamp=case.occurred_at.isoformat(),
            event=f"Incident Occurred ({case.category.name if case.category else 'Crime Case'})",
            actor=None,
            category="case",
            source="Incident Record",
            source_id=str(case.id),
            details=f"Occurred in jurisdiction: {case.location.station if case.location else 'Station'}, {case.location.district if case.location else 'District'}",
        ))

    if case.reported_at:
        events.append(InvestigationTimelineEvent(
            id=f"evt-case-reported-{case.id}",
            timestamp=case.reported_at.isoformat(),
            event=f"Case Docket Registered ({case.case_number})",
            actor=case.assigned_officer.name if case.assigned_officer else None,
            category="case",
            source="Case Management Registry",
            source_id=str(case.id),
            details=f"Case status: {case.status}. Priority: {case.priority}.",
        ))

    # FIR registrations
    for fir in firs:
        events.append(InvestigationTimelineEvent(
            id=f"evt-fir-{fir.id}",
            timestamp=fir.filed_at.isoformat() if fir.filed_at else (fir.created_at.isoformat() if fir.created_at else ""),
            event=f"FIR {fir.fir_number} Filed",
            actor=fir.complainant_name or "Complainant",
            category="fir",
            source="Station FIR Register",
            source_id=str(fir.id),
            details=f"Penal Sections: {fir.sections or 'Sec Unspecified'}. Complainant: {fir.complainant_name or 'N/A'}",
        ))
        if fir.status == "closed":
            events.append(InvestigationTimelineEvent(
                id=f"evt-fir-close-{fir.id}",
                timestamp=fir.created_at.isoformat() if fir.created_at else "",
                event=f"FIR {fir.fir_number} Closed",
                actor=None,
                category="fir",
                source="Station FIR Register",
                source_id=str(fir.id),
                details=f"FIR {fir.fir_number} reached terminal status: Closed",
            ))

    # Evidence collection
    for ev in evidence:
        events.append(InvestigationTimelineEvent(
            id=f"evt-ev-{ev.id}",
            timestamp=ev.created_at.isoformat() if ev.created_at else "",
            event=f"Evidence Cataloged: {ev.title} ({ev.evidence_type})",
            actor=ev.created_by or "Investigating Officer",
            category="evidence",
            source="Evidence Vault",
            source_id=str(ev.id),
            evidence_id=str(ev.id),
            details=ev.description or f"Evidentiary exhibit {ev.evidence_type} secured in chain of custody.",
        ))

    # Custody events
    if custody_records:
        for c in custody_records:
            events.append(InvestigationTimelineEvent(
                id=f"evt-custody-{c.id}",
                timestamp=c.timestamp.isoformat() if c.timestamp else "",
                event=f"Custody Transfer: {c.action}",
                actor=c.remarks or "Custodian",
                category="custody",
                source="Chain of Custody Ledger",
                source_id=str(c.id),
                evidence_id=str(c.evidence_id),
                details=f"Location: {c.location or 'Evidence Room'}. Action: {c.action}",
            ))

    # Forensic reports and verifications
    if forensic_reports:
        for rep in forensic_reports:
            events.append(InvestigationTimelineEvent(
                id=f"evt-forensic-{rep.id}",
                timestamp=rep.created_at.isoformat() if rep.created_at else "",
                event=f"Forensic Report: {rep.title}",
                actor=rep.examiner_name,
                category="forensic",
                source="SFSL Forensic Lab",
                source_id=str(rep.id),
                evidence_id=str(rep.evidence_id) if rep.evidence_id else None,
                details=f"Status: {rep.status.upper()} | Type: {rep.forensic_type.upper()} | {rep.lab_name}",
            ))
            if rep.verified_at and rep.verified_by:
                events.append(InvestigationTimelineEvent(
                    id=f"evt-forensic-verify-{rep.id}",
                    timestamp=rep.verified_at.isoformat(),
                    event=f"Forensic Analysis Certified: {rep.title}",
                    actor=rep.verified_by,
                    category="forensic",
                    source="Forensic Certification",
                    source_id=str(rep.id),
                    evidence_id=str(rep.evidence_id) if rep.evidence_id else None,
                    details="Authoritative certification confirmed under CrPC Section 293.",
                ))

    # Investigation notes
    if notes:
        for note in notes:
            events.append(InvestigationTimelineEvent(
                id=f"evt-note-{note.id}",
                timestamp=note.created_at.isoformat() if note.created_at else "",
                event="Investigation Diary Note",
                actor=note.officer_name,
                category="note",
                source="Case Diary",
                source_id=str(note.id),
                details=note.content if hasattr(note, 'content') else None,
            ))

    # Status changes from audit log
    for log in history:
        if log.resource_type == "CrimeCase" and log.action in ("UPDATE", "CREATE", "STATUS_CHANGE"):
            events.append(InvestigationTimelineEvent(
                id=f"evt-audit-{log.id}",
                timestamp=log.timestamp.isoformat() if log.timestamp else "",
                event=f"Audit Milestone: {log.action} ({log.resource_type})",
                actor=log.user.full_name if log.user else None,
                category="status",
                source="Immutable Audit Log",
                source_id=str(log.id),
                details=log.details or "Case record attribute updated.",
            ))

    # Filter out empty timestamps and sort by timestamp
    valid_events = [e for e in events if e.timestamp]
    valid_events.sort(key=lambda e: e.timestamp)
    return valid_events



def get_investigation(db: Session, case_id: uuid.UUID) -> InvestigationData:
    """Compile full investigation data for a given crime case."""
    # Load case with all relationships
    case = (
        db.query(CrimeCase)
        .options(
            joinedload(CrimeCase.category),
            joinedload(CrimeCase.location),
            joinedload(CrimeCase.assigned_officer).joinedload(Officer.user),
            selectinload(CrimeCase.firs)
            .selectinload(FIR.criminal_links)
            .joinedload(FIRCriminalLink.criminal),
            selectinload(CrimeCase.firs)
            .selectinload(FIR.victim_links)
            .joinedload(FIRVictimLink.victim),
            joinedload(CrimeCase.evidence),
        )
        .filter(CrimeCase.id == case_id)
        .first()
    )

    if not case:
        raise ValueError(f"Crime case {case_id} not found")

    # ── Assigned Officer ──
    assigned_officer = None
    if case.assigned_officer:
        off = case.assigned_officer
        assigned_officer = InvestigationOfficer(
            id=str(off.id),
            badge_number=off.badge_number,
            rank=off.rank,
            full_name=off.user.full_name if off.user else "Unknown",
            district=off.district,
            station=off.station,
        )

    # ── Case info ──
    crime_type_str = case.category.name if case.category else "General Investigation"
    station_str = case.location.station if case.location else "Station Unknown"
    district_str = case.location.district if case.location else "District Unknown"
    location_summary = f"{station_str}, {district_str}"

    case_info = InvestigationCase(
        id=str(case.id),
        case_number=case.case_number,
        description=case.description,
        mo_tags=case.mo_tags,
        status=case.status,
        priority=case.priority or "medium",
        progress=case.progress or 10,
        occurred_at=case.occurred_at.isoformat() if case.occurred_at else "",
        reported_at=case.reported_at.isoformat() if case.reported_at else "",
        created_at=case.created_at.isoformat() if case.created_at else "",
        assigned_officer=assigned_officer,
        crime_type=crime_type_str,
        location=location_summary,
        station=station_str,
        district=district_str,
        updated_at=case.updated_at.isoformat() if case.updated_at else "",
    )

    # ── FIRs with linked data ──
    firs_list: list[InvestigationFIR] = []
    criminal_map: dict[str, InvestigationCriminal] = {}
    all_evidence: list[Evidence] = list(case.evidence) if case.evidence else []

    case_fir_ids = [f.id for f in case.firs]
    criminal_ids: list[uuid.UUID] = []
    for fir in case.firs:
        for link in fir.criminal_links:
            if link.criminal and link.criminal.id not in criminal_ids:
                criminal_ids.append(link.criminal.id)
    evidence_ids = [ev.id for ev in all_evidence]

    loaded_criminals: list[Criminal] = []
    fir_links_by_criminal: dict[str, list] = {}
    if criminal_ids:
        loaded_criminals = (
            db.query(Criminal)
            .options(selectinload(Criminal.fir_links))
            .filter(Criminal.id.in_(criminal_ids))
            .all()
        )
        fir_links_by_criminal = {str(c.id): list(c.fir_links) for c in loaded_criminals}

    custody_by_evidence: dict[str, list[ChainOfCustody]] = {}
    all_custody_records: list[ChainOfCustody] = []
    if evidence_ids:
        all_custody_records = (
            db.query(ChainOfCustody)
            .filter(ChainOfCustody.evidence_id.in_(evidence_ids))
            .order_by(ChainOfCustody.timestamp.asc())
            .all()
        )
        for row in all_custody_records:
            custody_by_evidence.setdefault(str(row.evidence_id), []).append(row)

    for fir in case.firs:
        fir_criminals = []
        fir_victims = []
        for link in fir.criminal_links:
            if link.criminal:
                c = link.criminal
                fir_criminals.append({
                    "id": str(c.id),
                    "full_name": c.full_name,
                    "aliases": c.aliases,
                    "status": c.status,
                })
                # Accumulate unique criminals for the case-level list
                if str(c.id) not in criminal_map:
                    fir_links = fir_links_by_criminal.get(str(c.id), [])
                    fir_count_in_case = len([lk for lk in fir_links if lk.fir_id in case_fir_ids])
                    criminal_map[str(c.id)] = InvestigationCriminal(
                        id=str(c.id),
                        full_name=c.full_name,
                        aliases=c.aliases,
                        gender=c.gender,
                        date_of_birth=c.date_of_birth.isoformat() if c.date_of_birth else None,
                        identifying_marks=c.identifying_marks,
                        mo_summary=c.mo_summary,
                        status=c.status,
                        risk_score=_calculate_criminal_risk(c, len(fir_links)),
                        linked_fir_count=fir_count_in_case,
                    )

        for link in fir.victim_links:
            if link.victim:
                v = link.victim
                fir_victims.append({
                    "id": str(v.id),
                    "full_name": v.full_name,
                    "contact_number": v.contact_number,
                    "gender": v.gender,
                    "age": v.age,
                    "statement": v.statement,
                })

        firs_list.append(InvestigationFIR(
            id=str(fir.id),
            fir_number=fir.fir_number,
            complainant_name=fir.complainant_name,
            complainant_contact=fir.complainant_contact,
            sections=fir.sections,
            status=fir.status,
            filed_at=fir.filed_at.isoformat() if fir.filed_at else "",
            narrative=fir.narrative,
            criminals=fir_criminals,
            victims=fir_victims,
        ))

    # ── Evidence list ──
    evidence_list = []
    for ev in all_evidence:
        custody_records = custody_by_evidence.get(str(ev.id), [])
        chain_summary = None
        if custody_records:
            chain_summary = " -> ".join(
                f"{c.action} ({c.timestamp.strftime('%Y-%m-%d') if c.timestamp else 'N/A'})"
                for c in custody_records
            )
        evidence_list.append(InvestigationEvidence(
            id=str(ev.id),
            evidence_type=ev.evidence_type,
            description=ev.description,
            file_url=ev.storage_path,
            collected_by=ev.created_by,
            chain_of_custody=chain_summary,
            created_at=ev.created_at.isoformat() if ev.created_at else "",
        ))

    # ── Forensic reports ──
    forensic_reports = (
        db.query(ForensicReport)
        .filter(ForensicReport.case_id == case_id)
        .order_by(ForensicReport.created_at.desc())
        .all()
    )

    # ── Entity Extraction (Vehicles, Locations, Organizations, Digital Accounts) ──
    vehicles: list[InvestigationVehicle] = []
    seen_plates: set[str] = set()
    plate_regex = re.compile(r"\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{3,4})\b", re.I)

    candidate_texts = [case.description or "", case.mo_tags or ""]
    for fir in case.firs:
        candidate_texts.append(fir.narrative or "")
    for ev in all_evidence:
        candidate_texts.append(ev.title or "")
        candidate_texts.append(ev.description or "")
    for c in loaded_criminals:
        candidate_texts.append(c.mo_summary or "")

    for text_sample in candidate_texts:
        for match in plate_regex.findall(text_sample):
            norm_plate = re.sub(r"\s+", "-", match.strip().upper())
            if len(norm_plate) >= 6 and norm_plate not in seen_plates:
                seen_plates.add(norm_plate)
                vehicles.append(InvestigationVehicle(
                    id=f"veh-{norm_plate}",
                    registration=norm_plate,
                    make_model="Identified in case records",
                    color=None,
                    status="Flagged in Incident",
                    source_type="FIR / Narrative Exhibit",
                    source_reference=case.case_number,
                    verification_status="VERIFIED" if norm_plate.startswith("KA-") else "LINKED",
                    confidence=0.95 if norm_plate.startswith("KA-") else 0.80,
                ))

    # Fallback generic vehicle indicator from MO tags if no raw plate found
    if not vehicles and case.mo_tags and any(v in case.mo_tags.lower() for v in ["vehicle", "bike", "car", "scooter", "auto"]):
        vehicles.append(InvestigationVehicle(
            id=f"veh-generic-{case.id}",
            registration="UNIDENTIFIED TWO-WHEELER / VEHICLE",
            make_model="Suspect get-away conveyance",
            status="Under Tracking",
            source_type="MO Analysis",
            source_reference=case.case_number,
            verification_status="SUSPECT",
            confidence=0.75,
        ))

    # Locations
    locations: list[InvestigationLocation] = []
    if case.location:
        locations.append(InvestigationLocation(
            id=f"loc-scene-{case.location.id}",
            name=f"Primary Scene of Crime ({case.location.station})",
            type="Scene of Incident",
            station=case.location.station,
            district=case.location.district,
            address=case.location.address or f"{case.location.station}, {case.location.district}",
        ))
        if case.location.station:
            locations.append(InvestigationLocation(
                id=f"loc-ps-{case.location.id}",
                name=f"{case.location.station} Police Station",
                type="Jurisdictional Station",
                station=case.location.station,
                district=case.location.district,
                address=f"{case.location.station} PS, {case.location.district}",
            ))

    # Organizations
    organizations: list[InvestigationOrganization] = []
    seen_gangs: set[str] = set()
    for c in loaded_criminals:
        gang = (c.gang_affiliation or "").strip()
        if gang and gang not in seen_gangs:
            seen_gangs.add(gang)
            organizations.append(InvestigationOrganization(
                id=f"org-{re.sub(r'[^a-zA-Z0-9]+', '-', gang.lower())}",
                name=gang,
                type="Organized Crime Syndicate",
                leader_name=c.full_name,
                active_members=1,
                risk_level="HIGH" if len(c.fir_links) >= 2 else "MODERATE",
                territory=district_str,
            ))

    # Digital Accounts
    digital_accounts: list[InvestigationDigitalAccount] = []
    seen_identifiers: set[str] = set()

    for fir in case.firs:
        if fir.complainant_contact and fir.complainant_contact not in seen_identifiers:
            seen_identifiers.add(fir.complainant_contact)
            digital_accounts.append(InvestigationDigitalAccount(
                id=f"dig-comp-{fir.id}",
                account_type="Mobile Phone",
                identifier=fir.complainant_contact,
                associated_person=fir.complainant_name,
                source=f"FIR {fir.fir_number}",
                verification_status="VERIFIED",
            ))
        for link in fir.victim_links:
            if link.victim and link.victim.contact_number and link.victim.contact_number not in seen_identifiers:
                seen_identifiers.add(link.victim.contact_number)
                digital_accounts.append(InvestigationDigitalAccount(
                    id=f"dig-vic-{link.victim.id}",
                    account_type="Mobile Phone",
                    identifier=link.victim.contact_number,
                    associated_person=link.victim.full_name,
                    source=f"Victim Statement ({fir.fir_number})",
                    verification_status="VERIFIED",
                ))

    for ev in all_evidence:
        if ev.evidence_type.lower() in ("digital", "phone", "cctv", "device", "document"):
            digital_accounts.append(InvestigationDigitalAccount(
                id=f"dig-ev-{ev.id}",
                account_type=f"Digital Exhibit ({ev.evidence_type.title()})",
                identifier=ev.title,
                associated_person=ev.created_by,
                source="Evidence Vault",
                verification_status="VERIFIED" if ev.status == "Analyzed" else "UNDER_ANALYSIS",
            ))

    # ── Audit History ──
    audit_logs = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .filter(
            AuditLog.resource_id == str(case.id),
            AuditLog.resource_type.in_(["CrimeCase", "FIR", "Evidence", "ForensicReport"]),
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(50)
        .all()
    )

    history = [
        InvestigationHistoryEntry(
            timestamp=log.timestamp.isoformat() if log.timestamp else "",
            action=log.action,
            resource_type=log.resource_type,
            details=log.details,
            officer_name=log.user.full_name if log.user else None,
            officer_badge=log.user.username if log.user else None,
        )
        for log in audit_logs
    ]

    # ── Traceable Unified Timeline ──
    timeline = _build_timeline(
        case=case,
        firs=case.firs,
        evidence=all_evidence,
        history=audit_logs,
        notes=case.notes if hasattr(case, 'notes') else None,
        custody_records=all_custody_records,
        forensic_reports=forensic_reports,
    )

    # ── AI Recommendations ──
    ai_recommendations = _generate_ai_recommendations(case, case.firs, all_evidence, db=db)

    return InvestigationData(
        case=case_info,
        firs=firs_list,
        criminals=list(criminal_map.values()),
        evidence=evidence_list,
        timeline=timeline,
        ai_recommendations=ai_recommendations,
        history=history,
        vehicles=vehicles,
        locations=locations,
        organizations=organizations,
        digital_accounts=digital_accounts,
        forensic_reports_count=len(forensic_reports),
    )


