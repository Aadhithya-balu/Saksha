"""RAG Context Retrieval Service for building domain-aware investigation documents."""
from __future__ import annotations

from typing import Any, DefaultDict
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.fir import FIR, FIRCriminalLink
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.crime import CrimeCase
from app.models.location import Location
from app.services.analytics_service import category_breakdown, dashboard_summary, district_comparison

# Generous per-entity caps so vector retrieval covers every record in the
# database, not just an arbitrary first page. Queries are ordered for
# deterministic indexing across runs.
_FIR_CAP = 250
_CRIMINAL_CAP = 250
_EVIDENCE_CAP = 250
_CASE_CAP = 200


def _case_districts(db: Session) -> dict[str, str]:
    """case_id → district (from the case location)."""
    rows = db.query(
        CrimeCase.id, Location.district
    ).join(Location, Location.id == CrimeCase.location_id).all()
    return {str(case_id): district for case_id, district in rows if district}


def _fir_districts(db: Session) -> dict[str, str]:
    rows = db.query(
        FIR.id, Location.district
    ).join(CrimeCase, CrimeCase.id == FIR.crime_case_id).join(
        Location, Location.id == CrimeCase.location_id
    ).all()
    return {str(fir_id): district for fir_id, district in rows if district}


def _criminal_districts(db: Session) -> dict[str, str]:
    """criminal_id → comma-joined set of districts across their linked FIRs."""
    acc: DefaultDict[str, set[str]] = defaultdict(set)
    rows = db.query(
        FIRCriminalLink.criminal_id, Location.district
    ).join(FIR, FIR.id == FIRCriminalLink.fir_id).join(
        CrimeCase, CrimeCase.id == FIR.crime_case_id
    ).join(Location, Location.id == CrimeCase.location_id).all()
    for criminal_id, district in rows:
        if district:
            acc[str(criminal_id)].add(district)
    return {k: ", ".join(sorted(v)) for k, v in acc.items()}


def build_rag_documents(
    db: Session,
    *,
    fir_id: str | None = None,
    criminal_id: str | None = None,
    evidence_id: str | None = None,
    case_id: str | None = None,
) -> list[dict[str, Any]]:
    """Build multi-entity domain documents for RAG vector index.
    
    Includes context from FIRs, Criminals, Evidence, Crime Cases, and Analytics summary.
    If specific IDs are passed, prioritizes and includes pinpoint context.
    """
    documents: list[dict[str, Any]] = []

    # 1. Analytics & Summary Context
    try:
        summary = dashboard_summary(db)
        districts = district_comparison(db)
        categories = category_breakdown(db)
        
        documents.append({
            "id": "analytics-summary",
            "title": "Analytics Dashboard Summary",
            "source": "analytics",
            "content": (
                f"Total crime records: {summary.get('total_crimes', 0)}. Open active cases: {summary.get('open_crimes', 0)}. "
                f"Total registered FIRs: {summary.get('total_firs', 0)}. Case resolution rate: {summary.get('resolution_rate_percent', 0)}%."
            ),
        })

        if districts:
            documents.append({
                "id": "analytics-districts",
                "title": "District Crime Distribution",
                "source": "analytics",
                "content": ", ".join(f"District {row['district']} has {row['count']} registered crime cases" for row in districts[:10]),
            })

        if categories:
            documents.append({
                "id": "analytics-categories",
                "title": "Crime Category Distribution",
                "source": "analytics",
                "content": ", ".join(f"Category {row['category']} accounts for {row['count']} cases" for row in categories[:10]),
            })
    except Exception:
        pass

    # 2. FIR Context
    try:
        fir_query = db.query(FIR)
        if fir_id:
            fir_query = fir_query.filter(FIR.id == fir_id)
        firs = fir_query.order_by(FIR.created_at.desc()).limit(_FIR_CAP).all()
        fir_district_map = _fir_districts(db)

        for fir in firs:
            content_parts = [
                f"FIR Number: {fir.fir_number}",
                f"Complainant: {fir.complainant_name}",
                f"Status: {fir.status}",
                f"IPC/BNS Sections: {fir.sections or 'N/A'}",
            ]
            if fir.narrative:
                content_parts.append(f"Narrative: {fir.narrative}")
            if fir.criminal_links:
                accused_names = [link.criminal.full_name for link in fir.criminal_links if link.criminal]
                if accused_names:
                    content_parts.append(f"Accused/Suspects: {', '.join(accused_names)}")

            doc = {
                "id": f"fir-{fir.id}",
                "title": f"FIR Record {fir.fir_number}",
                "source": "fir",
                "content": ". ".join(content_parts),
                "fir_id": str(fir.id),
                "fir_number": fir.fir_number,
            }
            fir_district = fir_district_map.get(str(fir.id))
            if fir_district:
                doc["district"] = fir_district
            documents.append(doc)
    except Exception:
        pass

    # 3. Criminal Context
    try:
        criminal_query = db.query(Criminal)
        if criminal_id:
            criminal_query = criminal_query.filter(Criminal.id == criminal_id)
        criminals = criminal_query.order_by(Criminal.created_at.desc()).limit(_CRIMINAL_CAP).all()
        criminal_district_map = _criminal_districts(db)

        for c in criminals:
            content_parts = [
                f"Criminal Full Name: {c.full_name}",
                f"Status: {c.status}",
            ]
            if c.aliases:
                content_parts.append(f"Aliases: {c.aliases}")
            if c.gender:
                content_parts.append(f"Gender: {c.gender}")
            if c.address:
                content_parts.append(f"Known Address: {c.address}")
            if c.mo_summary:
                content_parts.append(f"Modus Operandi (MO): {c.mo_summary}")
            if c.identifying_marks:
                content_parts.append(f"Identifying Marks: {c.identifying_marks}")

            doc = {
                "id": f"criminal-{c.id}",
                "title": f"Offender Record: {c.full_name}",
                "source": "criminal",
                "content": ". ".join(content_parts),
                "criminal_id": str(c.id),
                "name": c.full_name,
            }
            criminal_district = criminal_district_map.get(str(c.id))
            if criminal_district:
                doc["district"] = criminal_district
            documents.append(doc)
    except Exception:
        pass

    # 4. Evidence Context
    try:
        ev_query = db.query(Evidence)
        if evidence_id:
            ev_query = ev_query.filter(Evidence.id == evidence_id)
        evidences = ev_query.order_by(Evidence.created_at.desc()).limit(_EVIDENCE_CAP).all()
        evidence_district_map = _case_districts(db)

        for ev in evidences:
            content_parts = [
                f"Evidence Title: {ev.title}",
                f"Evidence Type: {ev.evidence_type}",
                f"Status: {ev.status}",
            ]
            if ev.description:
                content_parts.append(f"Description: {ev.description}")

            doc = {
                "id": f"evidence-{ev.id}",
                "title": f"Evidence: {ev.title}",
                "source": "evidence",
                "content": ". ".join(content_parts),
                "evidence_id": str(ev.id),
            }
            evidence_district = evidence_district_map.get(str(ev.case_id))
            if evidence_district:
                doc["district"] = evidence_district
            documents.append(doc)
    except Exception:
        pass

    # 5. Crime Case Context
    try:
        case_query = db.query(CrimeCase)
        if case_id:
            case_query = case_query.filter(CrimeCase.id == case_id)
        cases = case_query.order_by(CrimeCase.created_at.desc()).limit(_CASE_CAP).all()
        case_district_map = _case_districts(db)

        for case in cases:
            content_parts = [
                f"Case Number: {case.case_number}",
                f"Status: {case.status}",
                f"Priority: {case.priority or 'medium'}",
            ]
            if case.description:
                content_parts.append(f"Description: {case.description}")
            if case.mo_tags:
                content_parts.append(f"MO Tags: {case.mo_tags}")

            doc = {
                "id": f"case-{case.id}",
                "title": f"Crime Case {case.case_number}",
                "source": "case",
                "content": ". ".join(content_parts),
                "case_id": str(case.id),
            }
            case_district = case_district_map.get(str(case.id))
            if case_district:
                doc["district"] = case_district
            documents.append(doc)
    except Exception:
        pass

    return documents

