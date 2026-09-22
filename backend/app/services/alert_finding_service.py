"""Rule-driven analytics alert findings with explicit human review (Phase 5).

Deterministic, explainable rules derived from the live DB only — no ML, no
fabricated signals. Each finding is a *proposed lead* awaiting a REVIEW_ROLES
decision; nothing is auto-confirmed or auto-accused.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.core.alert_policy import (
    AlertType,
    Confidence,
    RedZoneThresholds,
    build_alert_explanation,
)
from app.models.alert_finding import (
    FINDING_STATUS_DISMISSED,
    FINDING_STATUS_IN_REVIEW,
    FINDING_STATUS_OPEN,
    FINDING_STATUS_REVIEWED,
    REVIEW_DECISIONS,
    SEVERITY_CRITICAL,
    SEVERITY_HIGH,
    SEVERITY_LOW,
    SEVERITY_MEDIUM,
    AlertFinding,
    finding_payload,
)
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink
from app.models.location import Location

FINDING_TYPE_CRIME_SPIKE = "CRIME_SPIKE"
FINDING_TYPE_REPEAT_OFFENDER = "REPEAT_OFFENDER"


def _severity_rank(severity: str) -> int:
    return {
        SEVERITY_CRITICAL: 4,
        SEVERITY_HIGH: 3,
        SEVERITY_MEDIUM: 2,
        SEVERITY_LOW: 1,
    }.get(severity, 0)


def generate_candidate_findings(db: Session, district: str | None = None) -> dict[str, int]:
    """Derive proposed findings from current analytics patterns.

    ``district`` narrows all rules to one district (bound callers only ever
    produce findings for their own jurisdiction). Returns creation stats.
    """
    now = datetime.utcnow()
    current_start = now - timedelta(days=RedZoneThresholds.CURRENT_WINDOW_DAYS)
    baseline_start = now - timedelta(days=RedZoneThresholds.CURRENT_WINDOW_DAYS + RedZoneThresholds.BASELINE_WINDOW_DAYS)

    created = 0

    # -- CRIME_SPIKE: (district, category) up vs its own 30/90-day baseline ----
    spike_rows = (
        db.query(
            Location.district,
            CrimeCategory.name,
            func.sum(case((FIR.filed_at >= current_start, 1), else_=0)),
            func.sum(case((and_(FIR.filed_at >= baseline_start, FIR.filed_at < current_start), 1), else_=0)),
            func.max(FIR.dataset_provenance),
        )
        .select_from(FIR)
        .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        .join(CrimeCategory, CrimeCategory.id == CrimeCase.category_id)
        .join(Location, Location.id == CrimeCase.location_id)
        .group_by(Location.district, CrimeCategory.name)
        .all()
    )
    for row_district, category, current_count, baseline_count, provenance in spike_rows:
        if district and row_district.lower() != district.lower():
            continue
        current_count = int(current_count or 0)
        baseline_count = float(baseline_count or 0)
        if current_count < RedZoneThresholds.MIN_CURRENT_COUNT:
            continue
        ratio = current_count / baseline_count if baseline_count > 0 else float(current_count)
        if baseline_count > 0 and ratio < RedZoneThresholds.RATIO_THRESHOLD:
            continue

        if ratio >= RedZoneThresholds.CRITICAL_RATIO or (
            baseline_count == 0 and current_count >= RedZoneThresholds.CRITICAL_ZERO_BASELINE_COUNT
        ):
            severity, confidence = SEVERITY_CRITICAL, Confidence.HIGH.value
        elif baseline_count > 0:
            severity, confidence = SEVERITY_HIGH, Confidence.MEDIUM.value
        else:
            severity, confidence = SEVERITY_LOW, Confidence.INSUFFICIENT_DATA.value

        explanation = build_alert_explanation(
            alert_type=AlertType.CRIME_SPIKE,
            district=row_district,
            category=category,
            current_count=current_count,
            baseline_count=baseline_count,
            spike_ratio=round(ratio, 2),
        )
        grouping_key = f"{FINDING_TYPE_CRIME_SPIKE}:{row_district}:{category}"
        created_count, _ = _persist_finding(
            db,
            finding_type=FINDING_TYPE_CRIME_SPIKE,
            district=row_district,
            category=category,
            severity=severity,
            confidence=confidence,
            provenance=str(provenance or "unknown"),
            current_count=current_count,
            baseline_count=baseline_count,
            spike_ratio=round(ratio, 2),
            evidence=[
                {"category": category, "district": row_district,
                 "current_count": current_count, "baseline_count": baseline_count}
            ],
            time_window={"current_days": RedZoneThresholds.CURRENT_WINDOW_DAYS,
                         "baseline_days": RedZoneThresholds.BASELINE_WINDOW_DAYS},
            explanation=explanation,
            grouping_key=grouping_key,
        )
        created += created_count

    # -- REPEAT_OFFENDER: criminal named in >=2 FIRs in the current window ----
    repeat_rows = (
        db.query(FIRCriminalLink.criminal_id, Location.district, func.count(FIR.id))
        .select_from(FIRCriminalLink)
        .join(FIR, FIR.id == FIRCriminalLink.fir_id)
        .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        .join(Location, Location.id == CrimeCase.location_id)
        .filter(FIR.filed_at >= current_start)
        .group_by(FIRCriminalLink.criminal_id, Location.district)
        .having(func.count(FIR.id) >= 2)
        .all()
    )
    criminal_ids = [criminal_id for criminal_id, _d, _c in repeat_rows]
    names = {
        c.id: c.full_name
        for c in db.query(Criminal).filter(Criminal.id.in_(criminal_ids)).all()
    } if criminal_ids else {}
    for criminal_id, row_district, fir_count in repeat_rows:
        if district and row_district.lower() != district.lower():
            continue
        fir_count = int(fir_count or 0)
        severity = SEVERITY_HIGH if fir_count >= 5 else SEVERITY_MEDIUM
        explanation = (
            f"{names.get(criminal_id, 'Unknown offender')} appears as a suspect in "
            f"{fir_count} FIR(s) in {row_district} within the current "
            f"{RedZoneThresholds.CURRENT_WINDOW_DAYS}-day window ({now.strftime('%Y-%m-%d')}). "
            f"Proposed lead — requires reviewer confirmation."
        )
        grouping_key = f"{FINDING_TYPE_REPEAT_OFFENDER}:{row_district}:{criminal_id}"
        created_count, _ = _persist_finding(
            db,
            finding_type=FINDING_TYPE_REPEAT_OFFENDER,
            district=row_district,
            entity_type="criminal",
            entity_id=criminal_id,
            severity=severity,
            confidence=Confidence.MEDIUM.value,
            provenance="unknown",
            current_count=fir_count,
            baseline_count=0.0,
            spike_ratio=float(fir_count),
            evidence=[{"fir_count": fir_count, "district": row_district}],
            time_window={"current_days": RedZoneThresholds.CURRENT_WINDOW_DAYS},
            explanation=explanation,
            grouping_key=grouping_key,
        )
        created += created_count

    db.commit()
    return {"generated": created, "empty": False, "total_open": _count_open(db)}


def _persist_finding(
    db: Session,
    *,
    finding_type: str,
    district: str,
    category: str | None = None,
    entity_type: str | None = None,
    entity_id: Any = None,
    severity: str,
    confidence: str,
    provenance: str,
    current_count: int,
    baseline_count: float,
    spike_ratio: float,
    evidence: list,
    time_window: dict | None,
    explanation: str,
    grouping_key: str,
) -> tuple[int, AlertFinding | None]:
    """Persist a candidate finding unless an open duplicate exists (dedup)."""
    duplicate = (
        db.query(AlertFinding)
        .filter(
            AlertFinding.grouping_key == grouping_key,
            AlertFinding.status.in_([FINDING_STATUS_OPEN, FINDING_STATUS_IN_REVIEW]),
        )
        .first()
    )
    if duplicate:
        return 0, duplicate
    finding = AlertFinding(
        finding_type=finding_type,
        district=district,
        category=category,
        entity_type=entity_type,
        entity_id=entity_id,
        severity=severity,
        confidence=confidence,
        provenance=provenance,
        current_count=current_count,
        baseline_count=baseline_count,
        spike_ratio=spike_ratio,
        evidence=evidence,
        time_window=time_window,
        explanation=explanation,
        grouping_key=grouping_key,
        status=FINDING_STATUS_OPEN,
    )
    db.add(finding)
    db.flush()
    return 1, finding


def _count_open(db: Session) -> int:
    return (
        db.query(AlertFinding)
        .filter(AlertFinding.status.in_([FINDING_STATUS_OPEN, FINDING_STATUS_IN_REVIEW]))
        .count()
    )


def list_findings(
    db: Session,
    district: str | None = None,
    status: str | None = None,
    finding_type: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """List findings, optionally scoped to one district and a status filter."""
    q = db.query(AlertFinding)
    if district:
        q = q.filter(func.lower(AlertFinding.district) == district.lower())
    if status:
        q = q.filter(AlertFinding.status == status)
    if finding_type:
        q = q.filter(AlertFinding.finding_type == finding_type)
    results = q.order_by(
        AlertFinding.created_at.desc(),
        AlertFinding.severity.desc(),
    ).limit(limit).all()
    results.sort(key=lambda f: _severity_rank(f.severity), reverse=True)
    return [finding_payload(f) for f in results]


def review_finding(
    db: Session,
    finding: AlertFinding,
    decision: str,
    reviewer: Any,
    note: str | None = None,
) -> AlertFinding:
    """Apply a reviewer decision (confirm | investigate | dismiss).

    Transitively the only way lifecycle state changes — nothing is
    auto-confirmed. Returns the updated finding.
    """
    if decision not in REVIEW_DECISIONS:
        raise ValueError(f"decision must be one of {'|'.join(REVIEW_DECISIONS)}")

    if decision == "dismiss":
        finding.status = FINDING_STATUS_DISMISSED
    elif decision == "confirm":
        finding.status = FINDING_STATUS_REVIEWED
    else:
        finding.status = FINDING_STATUS_IN_REVIEW
    finding.review_decision = decision
    finding.review_note = note
    finding.reviewed_by_id = reviewer.id
    finding.reviewed_at = datetime.utcnow()
    db.flush()
    return finding