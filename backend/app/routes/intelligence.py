"""
Intelligence Engine routes — unified investigation intelligence builder.

Endpoints for building comprehensive intelligence reports, comparing cases,
and searching for entities to start an intelligence analysis from.
"""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ALL_ROLES,
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    require_roles,
)
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.intelligence import (
    FusionThresholdsInput,
    IntelligenceFusionRequest,
    IntelligenceFusionResponse,
    UnifiedIntelligenceResult,
)
from app.services import intelligence_engine
from app.services.audit_service import log_action

router = APIRouter(
    prefix="/intelligence",
    tags=["Intelligence Engine"],
    dependencies=[Depends(require_roles(*ALL_ROLES))],
)


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class BuildIntelligenceRequest(BaseModel):
    entity_type: str
    entity_id: str


class CompareCasesRequest(BaseModel):
    primary_case_id: str
    compare_case_ids: list[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/build")
def build_intelligence(
    body: BuildIntelligenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Build a comprehensive intelligence report for a given entity."""
    try:
        report = intelligence_engine.build_intelligence(db, body.entity_type, body.entity_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Intelligence engine error: {exc}")

    log_action(
        db, current_user, "INTELLIGENCE_BUILD", "IntelligenceReport",
        resource_id=body.entity_id,
        details=f"Intelligence report built for {body.entity_type}:{body.entity_id}",
        metadata_json=f'{{"entity_type":"{body.entity_type}","entity_id":"{body.entity_id}"}}',
    )

    _record_run(db, current_user, body.entity_type, body.entity_id, report)
    db.commit()
    return report


def _record_run(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: str,
    report: dict[str, Any],
) -> None:
    """Persist a compact record of the built report for the user's history.

    Upserts on (entity_type, entity_id, created_by_id): if the user has already
    analyzed this exact entity, the existing history row is updated in place
    rather than inserting a duplicate.
    """
    from datetime import datetime, timezone

    from app.models.intelligence_report import IntelligenceReportRun

    info = report.get("entity_info") or {}
    label = (
        info.get("full_name")
        or info.get("case_number")
        or (f"FIR {info.get('fir_number')}" if info.get("fir_number") else None)
        or f"{entity_type}:{entity_id}"
    )

    cs = report.get("confidence_summary") or {}

    existing = (
        db.query(IntelligenceReportRun)
        .filter(
            IntelligenceReportRun.entity_type == entity_type,
            IntelligenceReportRun.entity_id == entity_id,
            IntelligenceReportRun.created_by_id == user.id,
        )
        .first()
    )

    if existing:
        existing.entity_label = str(label)[:300]
        existing.summary = (report.get("summary") or "")[:2000]
        existing.connections = len(report.get("connections") or [])
        existing.leads = len(report.get("investigation_leads") or [])
        existing.threads = len(report.get("common_threads") or [])
        existing.timeline_events = len(report.get("timeline") or [])
        existing.confirmed = int(cs.get("confirmed", 0))
        existing.probable = int(cs.get("probable", 0))
        existing.possible = int(cs.get("possible", 0))
        existing.updated_at = datetime.now(timezone.utc)
    else:
        run = IntelligenceReportRun(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=str(label)[:300],
            summary=(report.get("summary") or "")[:2000],
            connections=len(report.get("connections") or []),
            leads=len(report.get("investigation_leads") or []),
            threads=len(report.get("common_threads") or []),
            timeline_events=len(report.get("timeline") or []),
            confirmed=int(cs.get("confirmed", 0)),
            probable=int(cs.get("probable", 0)),
            possible=int(cs.get("possible", 0)),
            created_by_id=user.id,
        )
        db.add(run)


@router.get("/history")
def list_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's recent intelligence runs (most recent first).

    Runs are de-duplicated on (entity_type, entity_id, created_by_id) so a
    re-built report or re-detected pattern surfaces only once in history.
    """
    from sqlalchemy import func
    from app.models.intelligence_report import IntelligenceReportRun

    ranked = (
        db.query(
            IntelligenceReportRun,
            func.row_number()
            .over(
                partition_by=[
                    IntelligenceReportRun.entity_type,
                    IntelligenceReportRun.entity_id,
                    IntelligenceReportRun.created_by_id,
                ],
                order_by=IntelligenceReportRun.created_at.desc(),
            )
            .label("rank"),
        )
        .filter(IntelligenceReportRun.created_by_id == current_user.id)
        .subquery("ranked_runs")
    )

    runs = (
        db.query(ranked)
        .filter(ranked.c.rank == 1)
        .order_by(ranked.c.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(r.id),
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "entity_label": r.entity_label,
            "summary": r.summary,
            "connections": r.connections,
            "leads": r.leads,
            "threads": r.threads,
            "timeline_events": r.timeline_events,
            "confirmed": r.confirmed,
            "probable": r.probable,
            "possible": r.possible,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.delete("/history/{run_id}")
def delete_history(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a single history entry owned by the current user."""
    from app.models.intelligence_report import IntelligenceReportRun

    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid run id: {exc}")

    run = (
        db.query(IntelligenceReportRun)
        .filter(IntelligenceReportRun.id == run_uuid)
        .filter(IntelligenceReportRun.created_by_id == current_user.id)
        .first()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="History entry not found")
    db.delete(run)
    log_action(
        db, current_user, "DELETE", "IntelligenceReportRun",
        resource_id=str(run_uuid),
        details=f"Deleted intelligence history entry ({run.entity_type}:{run.entity_id})",
    )
    db.commit()
    return {"deleted": True}


@router.post("/compare")
def compare_cases(
    body: CompareCasesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare two or more cases side by side."""
    try:
        primary_uuid = uuid.UUID(body.primary_case_id)
        compare_uuids = [uuid.UUID(cid) for cid in body.compare_case_ids]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {exc}")

    try:
        result = intelligence_engine._compare_cases(db, primary_uuid, compare_uuids)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Case comparison error: {exc}")

    log_action(
        db, current_user, "INTELLIGENCE_COMPARE", "CaseComparison",
        resource_id=body.primary_case_id,
        details=f"Compared case {body.primary_case_id} with {len(body.compare_case_ids)} case(s)",
        metadata_json=f'{{"primary":"{body.primary_case_id}","compared_count":{len(body.compare_case_ids)}}}',
    )
    db.commit()
    return result


@router.get("/entity-search")
def entity_search(
    q: str = Query(..., min_length=1, max_length=200),
    entity_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search for entities (criminals, FIRs, cases, victims) to start intelligence from."""
    from app.models.criminal import Criminal
    from app.models.victim import Victim
    from app.models.fir import FIR
    from app.models.crime import CrimeCase

    results: list[dict[str, Any]] = []
    pattern = f"%{q}%"
    want_all = entity_type is None

    if want_all or entity_type == "criminal":
        criminals = db.query(Criminal).filter(
            Criminal.full_name.ilike(pattern) | Criminal.aliases.ilike(pattern)
        ).limit(10).all()
        for c in criminals:
            results.append({
                "id": str(c.id),
                "type": "criminal",
                "name": c.full_name,
                "subtitle": f"Status: {c.status} | Aliases: {c.aliases or 'None'}",
            })

    if want_all or entity_type == "fir":
        firs = db.query(FIR).filter(
            FIR.fir_number.ilike(pattern) | FIR.complainant_name.ilike(pattern)
        ).limit(10).all()
        for f in firs:
            results.append({
                "id": str(f.id),
                "type": "fir",
                "name": f"FIR {f.fir_number}",
                "subtitle": f"Complainant: {f.complainant_name} | Sections: {f.sections or 'N/A'}",
            })

    if want_all or entity_type == "case":
        cases = db.query(CrimeCase).filter(
            CrimeCase.case_number.ilike(pattern) | CrimeCase.description.ilike(pattern)
        ).limit(10).all()
        for c in cases:
            results.append({
                "id": str(c.id),
                "type": "case",
                "name": c.case_number,
                "subtitle": f"Status: {c.status} | Priority: {c.priority or 'N/A'}",
            })

    if want_all or entity_type == "victim":
        victims = db.query(Victim).filter(
            Victim.full_name.ilike(pattern)
        ).limit(10).all()
        for v in victims:
            results.append({
                "id": str(v.id),
                "type": "victim",
                "name": v.full_name,
                "subtitle": f"Age: {v.age or 'N/A'} | Gender: {v.gender or 'N/A'}",
            })

    results.sort(key=lambda r: r["name"])
    return {"total": len(results[:10]), "results": results[:10]}


# ---------------------------------------------------------------------------
# Emerging Pattern Detection & Intelligence Fusion Endpoints
# ---------------------------------------------------------------------------

@router.get("/emerging-patterns", response_model=IntelligenceFusionResponse)
def get_emerging_patterns(
    district: str | None = Query(None, description="Filter by district"),
    category: str | None = Query(None, description="Filter by crime category"),
    min_signals: int = Query(default=2, ge=1, le=10, description="Minimum concurring signals"),
    min_risk: float = Query(default=0.40, ge=0.0, le=1.0, description="Minimum fused risk score"),
    min_confidence: float = Query(default=0.50, ge=0.0, le=1.0, description="Minimum confidence score"),
    time_window_days: int = Query(default=30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detect and fuse emerging crime patterns across jurisdictions using multi-signal analytics."""
    from datetime import datetime, timezone

    from app.auth.scope import enforce_district_scope, is_multi_district
    effective_district = enforce_district_scope(current_user, district, db)
    if effective_district and not is_multi_district(current_user):
        district = effective_district

    thresholds = intelligence_engine.FusionThresholds(
        min_supporting_signals=min_signals,
        min_risk_score=min_risk,
        min_confidence=min_confidence,
        current_window_days=time_window_days,
    )

    patterns = intelligence_engine.detect_emerging_patterns(
        db,
        district=district,
        category=category,
        custom_thresholds=thresholds,
    )

    log_action(
        db, current_user, "INTELLIGENCE_EMERGING_PATTERNS", "IntelligenceFusion",
        resource_id=district or "all_districts",
        details=f"Retrieved {len(patterns)} emerging patterns (district={district}, category={category})",
        metadata_json=f'{{"district":"{district}","category":"{category}","count":{len(patterns)}}}',
    )
    db.commit()

    return IntelligenceFusionResponse(
        total=len(patterns),
        generated_at=datetime.now(timezone.utc).isoformat(),
        patterns=patterns,
        thresholds_applied={
            "min_signals": min_signals,
            "min_risk": min_risk,
            "min_confidence": min_confidence,
            "time_window_days": time_window_days,
        },
    )


@router.post("/fuse", response_model=IntelligenceFusionResponse)
def fuse_intelligence(
    body: IntelligenceFusionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute on-demand multi-signal intelligence fusion with optional custom threshold overrides."""
    from datetime import datetime, timezone

    from app.auth.scope import enforce_district_scope

    # Server-side district scoping: a district-bound user can never fuse across
    # (or outside) their own district, regardless of the client-supplied value.
    district = enforce_district_scope(current_user, body.district, db)

    thresholds = intelligence_engine.FusionThresholds()
    if body.thresholds:
        thresholds.min_anomaly_score = body.thresholds.min_anomaly_score
        thresholds.min_percentage_change = body.thresholds.min_percentage_change
        thresholds.min_risk_score = body.thresholds.min_risk_score
        thresholds.min_confidence = body.thresholds.min_confidence
        thresholds.min_supporting_signals = body.thresholds.min_supporting_signals
        thresholds.min_current_incidents = body.thresholds.min_current_incidents
        thresholds.current_window_days = body.thresholds.current_window_days
        thresholds.baseline_window_days = body.thresholds.baseline_window_days

    patterns = intelligence_engine.detect_emerging_patterns(
        db,
        district=district,
        category=body.category,
        custom_thresholds=thresholds,
    )

    # Persist a single history record summarising this fusion run
    _record_fusion_run(db, current_user, patterns, district, body.category)

    log_action(
        db, current_user, "INTELLIGENCE_FUSION_RUN", "IntelligenceFusion",
        resource_id=district or "all_districts",
        details=f"On-demand intelligence fusion produced {len(patterns)} pattern(s)",
        metadata_json=f'{{"district":"{district}","category":"{body.category}","patterns":{len(patterns)}}}',
    )
    db.commit()

    return IntelligenceFusionResponse(
        total=len(patterns),
        generated_at=datetime.now(timezone.utc).isoformat(),
        patterns=patterns,
        thresholds_applied={
            "min_anomaly_score": thresholds.min_anomaly_score,
            "min_percentage_change": thresholds.min_percentage_change,
            "min_risk_score": thresholds.min_risk_score,
            "min_confidence": thresholds.min_confidence,
            "min_signals": thresholds.min_supporting_signals,
            "current_window_days": thresholds.current_window_days,
            "baseline_window_days": thresholds.baseline_window_days,
        },
    )


@router.get("/emerging-patterns/{intelligence_id}", response_model=UnifiedIntelligenceResult)
def get_emerging_pattern_by_id(
    intelligence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details for a single fused intelligence pattern by ID."""
    from app.auth.scope import enforce_record_district
    patterns = intelligence_engine.detect_emerging_patterns(db, min_signals=1, min_risk=0.1, min_confidence=0.1)
    matching = next((p for p in patterns if p["intelligence_id"] == intelligence_id), None)
    if not matching:
        raise HTTPException(status_code=404, detail="Intelligence pattern not found or expired")
    enforce_record_district(current_user, matching.get("location", {}).get("district"), db)
    return matching


class ActionDispatchPayload(BaseModel):
    title: str | None = None
    description: str | None = None
    intervention_type: str | None = None


@router.post(
    "/emerging-patterns/{intelligence_id}/action",
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))],
)
def dispatch_intelligence_action(
    intelligence_id: str,
    payload: ActionDispatchPayload | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatch a recommended action from fused intelligence directly into the interventions prevention loop."""
    import json
    from datetime import datetime, timezone
    from app.models.intervention import Intervention

    patterns = intelligence_engine.detect_emerging_patterns(db, min_signals=1, min_risk=0.1, min_confidence=0.1)
    matching = next((p for p in patterns if p["intelligence_id"] == intelligence_id), None)
    if not matching:
        raise HTTPException(status_code=404, detail="Intelligence pattern not found or expired")

    rec = matching["recommended_action_input"]
    sugg = rec.get("suggested_intervention") or {}

    district = matching.get("location", {}).get("district") or sugg.get("district") or "Unknown"
    intervention_type = (payload.intervention_type if payload and payload.intervention_type else None) or sugg.get("intervention_type") or rec.get("action_type") or "investigation"
    title = (payload.title if payload and payload.title else None) or sugg.get("title") or rec.get("title") or f"Action on {matching['pattern_type']}"
    description = (payload.description if payload and payload.description else None) or sugg.get("description") or rec.get("description")

    # Recommendation formulation fields from intelligence
    h3_cells = matching.get("affected_h3_cells") or []
    c = matching.get("change_from_baseline") or {}
    pct = c.get("change_percentage", 0)
    reason = matching.get("explanation") or f"Detected {matching.get('pattern_type')} with {pct:+.1f}% change from historical baseline."
    time_window = matching.get("time_window") or "Next 14-30 days"

    intervention = Intervention(
        district=district,
        intervention_type=intervention_type,
        title=title,
        description=description,
        started_at=datetime.now(timezone.utc),
        status="planned",
        workflow_stage="draft",
        intelligence_id=intelligence_id,
        pattern_type=matching.get("pattern_type"),
        affected_h3_cells=json.dumps(h3_cells) if h3_cells else None,
        relevant_time_period=time_window,
        reason=reason,
        supporting_intelligence=json.dumps(matching.get("supporting_signals") or []),
        estimated_coverage=80.0,
        assumptions="Operational deployment assumes standard sector squad availability and typical reporting fidelity.",
        created_by_id=current_user.id,
    )
    db.add(intervention)
    db.flush()

    log_action(
        db, current_user, "INTELLIGENCE_ACTION_DISPATCH", "Intervention",
        resource_id=str(intervention.id),
        details=f"Created draft intervention '{title}' from intelligence {intelligence_id} (pending human approval)",
        metadata_json=f'{{"intelligence_id":"{intelligence_id}","intervention_id":"{intervention.id}","workflow_stage":"draft"}}',
    )
    db.commit()
    db.refresh(intervention)

    return {
        "dispatched": True,
        "intelligence_id": intelligence_id,
        "intervention_id": str(intervention.id),
        "district": intervention.district,
        "intervention_type": intervention.intervention_type,
        "title": intervention.title,
        "status": intervention.status,
        "workflow_stage": intervention.workflow_stage,
    }


@router.post(
    "/emerging-patterns/{intelligence_id}/investigate",
    dependencies=[Depends(require_roles(*ALL_ROLES))],
)
def investigate_intelligence_pattern(
    intelligence_id: str,
    payload: UnifiedIntelligenceResult,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compose a provenance-aware investigation view for a fused intelligence pattern.

    Wire: Intelligence Alert -> Related FIRs -> MO/Pattern Matches -> Network Graph
    -> Evidence Drawer -> Why This Insight? (#250).

    The client-supplied ``UnifiedIntelligenceResult`` is treated as the (already
    verified) #249 contract and its ``related_fir_ids`` (FIR numbers) and
    ``related_entity_ids`` are resolved against the operational database.
    Verification states reuse the shared vocabulary — VERIFIED (solid),
    POTENTIAL (dashed), DEMO (dotted), RESTRICTED (locked) — and RESTRICTED
    evidence is masked for non-reviewer roles server-side.
    """
    if payload.intelligence_id != intelligence_id:
        raise HTTPException(
            status_code=400,
            detail="intelligence_id in path must match the intelligence payload",
        )

    from app.services.intelligence_investigation_service import build_intelligence_investigation

    try:
        view = build_intelligence_investigation(
            db, payload.model_dump(mode="json"), current_user
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Investigation composition error: {exc}")

    log_action(
        db, current_user, "INTELLIGENCE_INVESTIGATE", "IntelligenceInvestigation",
        resource_id=intelligence_id,
        details=f"Investigation view composed for {payload.pattern_type} ({payload.location.get('district')})",
        metadata_json=(
            f'{{"intelligence_id":"{intelligence_id}",'
            f'"related_firs":{len(view.get("firs", []))},'
            f'"evidence":{len(view.get("evidence", []))}}}'
        ),
    )
    db.commit()
    return view


def _record_fusion_run(
    db: Session,
    user: User,
    patterns: list[dict[str, Any]],
    district: str | None,
    category: str | None,
) -> None:
    """Persist a single history record summarising one on-demand fusion run.

    One fusion run yields exactly one history entry (regardless of how many
    patterns are detected) so the activity list stays clean instead of
    showing a separate entry for every pattern.
    """
    from app.models.intelligence_report import IntelligenceReportRun

    pattern_types = sorted({p.get("pattern_type", "Fused Pattern") for p in patterns})
    confirmed = sum(1 for p in patterns for s in p.get("supporting_signals", []) if s.get("status") == "CONFIRMED")
    probable = sum(1 for p in patterns for s in p.get("supporting_signals", []) if s.get("status") == "PROBABLE")
    possible = sum(1 for p in patterns for s in p.get("supporting_signals", []) if s.get("status") == "POSSIBLE")

    label = f"Intelligence Fusion — {district or 'All Districts'}"
    if category:
        label += f" ({category})"

    db.add(IntelligenceReportRun(
        entity_type="fusion",
        entity_id=str(uuid.uuid4()),
        entity_label=label[:300],
        summary="; ".join(pattern_types)[:2000],
        connections=len(patterns),
        leads=sum(len(p.get("supporting_signals", [])) for p in patterns),
        threads=sum(len(p.get("affected_h3_cells", [])) for p in patterns),
        timeline_events=sum(len(p.get("related_fir_ids", [])) for p in patterns),
        confirmed=confirmed,
        probable=probable,
        possible=possible,
        created_by_id=user.id,
    ))

