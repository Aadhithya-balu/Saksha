"""Red-zone spike detection + alert notifications (issue #146, gaps 128.3/130.4).

Refactored for Issue #10 P2: all thresholds sourced from the central alert
policy in ``app.core.alert_policy``.  Every generated alert now carries:
  - policy version
  - provenance (LIVE / DEMO / MIXED / UNKNOWN)
  - confidence (HIGH / MEDIUM / LOW / INSUFFICIENT_DATA)
  - structured evidence metadata
  - human-readable explanation
  - warnings for low-confidence / insufficient-baseline scenarios

Detection methodology
---------------------
1. Load all crime cases with ``occurred_at`` and valid location.
2. Partition into current window (last 30 days) and baseline window
   (prior 90 days) per (district, crime_category).
3. Scale baseline to a 30-day equivalent: ``baseline_30d = raw * (30 / 90)``.
4. Compute spike ratio: ``current / max(baseline_30d, 0.5)``.
5. Apply minimum-current-count filter.
6. Apply ratio threshold.
7. Classify severity using policy rules.
8. Evaluate baseline sufficiency → confidence.
9. Determine provenance from dataset_provenance columns on supporting records.
10. Attach evidence, warnings, and explanation.
11. Deduplicate against existing unread notifications.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.core.alert_policy import (
    ALERT_POLICY_VERSION,
    AlertSeverity,
    AlertStatus,
    AlertType,
    BaselineStatus,
    Confidence,
    Provenance,
    RedZoneThresholds,
    build_alert_explanation,
)
from app.models.crime import CrimeCase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _determine_provenance(provenances: set[str]) -> str:
    """Derive alert-level provenance from the set of record provenances.

    Accepted DB values: "live", "seed" (demo), "migrated", or any other
    string (treated as unknown).  Case-insensitive matching.
    """
    if not provenances:
        return Provenance.UNKNOWN.value

    normalised = {p.lower().strip() for p in provenances}
    has_live = "live" in normalised
    has_seed = "seed" in normalised
    has_other = bool(normalised - {"live", "seed"})

    if has_live and (has_seed or has_other):
        return Provenance.MIXED.value
    if has_live:
        return Provenance.LIVE.value
    if has_seed or has_other:
        return Provenance.DEMO.value
    return Provenance.UNKNOWN.value


def _determine_confidence(
    baseline_observations: int,
    current_count: int,
    provenance: str,
) -> str:
    """Classify confidence based on evidence quality and provenance."""
    if baseline_observations < RedZoneThresholds.MIN_BASELINE_OBSERVATIONS:
        return Confidence.INSUFFICIENT_DATA.value
    if provenance == Provenance.UNKNOWN.value:
        return Confidence.LOW.value
    if provenance in (Provenance.DEMO.value, Provenance.MIXED.value):
        return Confidence.MEDIUM.value
    if current_count >= RedZoneThresholds.MIN_CURRENT_COUNT and baseline_observations >= 3:
        return Confidence.HIGH.value
    return Confidence.MEDIUM.value


def _classify_severity(
    current_count: int,
    baseline_30d: float,
    spike_ratio: float,
) -> str:
    """Classify alert severity using central policy rules."""
    if (baseline_30d == 0 and current_count >= RedZoneThresholds.CRITICAL_ZERO_BASELINE_COUNT):
        return AlertSeverity.CRITICAL.value
    if spike_ratio >= RedZoneThresholds.CRITICAL_RATIO:
        return AlertSeverity.CRITICAL.value
    if spike_ratio >= RedZoneThresholds.RATIO_THRESHOLD:
        return AlertSeverity.HIGH.value
    return AlertSeverity.MEDIUM.value


def _build_warnings(
    confidence: str,
    provenance: str,
    baseline_observations: int,
) -> list[dict[str, str]]:
    """Build non-fatal warning list for the alert."""
    warnings = []
    if confidence == Confidence.INSUFFICIENT_DATA.value:
        warnings.append({
            "code": "INSUFFICIENT_BASELINE",
            "message": (
                f"Baseline has {baseline_observations} observations, below the "
                f"minimum of {RedZoneThresholds.MIN_BASELINE_OBSERVATIONS}. "
                "Result marked INSUFFICIENT_DATA."
            ),
        })
    if provenance == Provenance.DEMO.value:
        warnings.append({
            "code": "DEMO_DATA",
            "message": "Alert generated from DEMO/seed data, not live operational records.",
        })
    elif provenance == Provenance.MIXED.value:
        warnings.append({
            "code": "MIXED_PROVENANCE",
            "message": "Alert includes both LIVE and DEMO records.",
        })
    elif provenance == Provenance.UNKNOWN.value:
        warnings.append({
            "code": "UNKNOWN_PROVENANCE",
            "message": "Dataset provenance could not be determined. Do not treat as live evidence.",
        })
    return warnings


# ---------------------------------------------------------------------------
# Core detection
# ---------------------------------------------------------------------------

def detect_red_zones(
    db: Session,
    *,
    min_current: int | None = None,
    ratio_threshold: float | None = None,
) -> dict[str, Any]:
    """Compare last-30-day volume per (district, category) vs prior 90 days.

    Returns a dict with structured ``AlertItem``-compatible entries in
    ``red_zones``, plus metadata about the detection run.
    """
    # Resolve thresholds from central policy (allow override for backward compat)
    _min_current = min_current if min_current is not None else RedZoneThresholds.MIN_CURRENT_COUNT
    _ratio_threshold = ratio_threshold if ratio_threshold is not None else RedZoneThresholds.RATIO_THRESHOLD

    now = datetime.now(timezone.utc)
    cutoff_current = now - timedelta(days=RedZoneThresholds.CURRENT_WINDOW_DAYS)
    cutoff_baseline = now - timedelta(days=RedZoneThresholds.CURRENT_WINDOW_DAYS + RedZoneThresholds.BASELINE_WINDOW_DAYS)

    cases = (
        db.query(CrimeCase)
        .options(joinedload(CrimeCase.category), joinedload(CrimeCase.location))
        .filter(CrimeCase.occurred_at.isnot(None))
        .all()
    )

    # Accumulators per (district, category)
    current: dict[tuple[str, str], int] = defaultdict(int)
    baseline: dict[tuple[str, str], int] = defaultdict(int)
    stations: dict[tuple[str, str], set[str]] = defaultdict(set)
    case_ids_current: dict[tuple[str, str], list[str]] = defaultdict(list)
    case_ids_baseline: dict[tuple[str, str], list[str]] = defaultdict(list)
    provenances: dict[tuple[str, str], set[str]] = defaultdict(set)

    for case in cases:
        ts = _aware(case.occurred_at)
        if ts is None or ts < cutoff_baseline:
            continue
        district = case.location.district if case.location else "Unknown"
        category = case.category.name if case.category else "Unclassified"
        key = (district, category)

        # Determine provenance from the case's ImportProvenanceMixin columns
        prov = getattr(case, "dataset_provenance", "seed") or "seed"
        provenances[key].add(prov)

        if ts >= cutoff_current:
            current[key] += 1
            case_ids_current[key].append(str(case.id))
            station_name = case.location.station if case.location else None
            if station_name:
                stations[key].add(station_name)
        else:
            baseline[key] += 1
            case_ids_baseline[key].append(str(case.id))

    zones: list[dict[str, Any]] = []

    for key, count in current.items():
        district, category = key

        # Minimum current count filter
        if count < _min_current:
            continue

        raw_baseline = baseline.get(key, 0)
        baseline_30d = raw_baseline * (30.0 / RedZoneThresholds.BASELINE_WINDOW_DAYS)
        baseline_observations = raw_baseline
        denom = max(baseline_30d, 0.5)
        spike_ratio = count / denom

        # Apply ratio threshold (skip if zero-baseline with enough current)
        if raw_baseline > 0 and spike_ratio < _ratio_threshold:
            continue

        # Baseline sufficiency
        baseline_status = (
            BaselineStatus.SUFFICIENT.value
            if baseline_observations >= RedZoneThresholds.MIN_BASELINE_OBSERVATIONS
            else BaselineStatus.INSUFFICIENT_BASELINE.value
        )

        # Severity
        severity = _classify_severity(count, baseline_30d, spike_ratio)

        # Provenance
        alert_provenance = _determine_provenance(provenances[key])

        # Confidence
        confidence = _determine_confidence(baseline_observations, count, alert_provenance)

        # Warnings
        warnings = _build_warnings(confidence, alert_provenance, baseline_observations)

        # Evidence
        all_case_ids = case_ids_current[key] + case_ids_baseline[key]
        evidence = {
            "current_count": count,
            "baseline_count": round(baseline_30d, 1),
            "spike_ratio": round(spike_ratio, 2),
            "supporting_records": len(all_case_ids),
            "supporting_record_ids": case_ids_current[key],
            "baseline_observations": baseline_observations,
            "stations": sorted(stations.get(key, set())),
        }

        # Explanation
        explanation = build_alert_explanation(
            alert_type=AlertType.RED_ZONE_SPIKE,
            district=district,
            category=category,
            current_count=count,
            baseline_count=baseline_30d,
            spike_ratio=round(spike_ratio, 2),
        )

        # Resource key for deduplication
        resource_id = f"redzone:{district}:{category}"

        zones.append({
            "alert_id": f"rz-{district.replace(' ', '-').lower()}:{category.replace(' ', '-').lower()}",
            "type": AlertType.RED_ZONE_SPIKE.value,
            "severity": severity,
            "status": AlertStatus.NEW.value,
            "district": district,
            "crime_category": category,
            "category": category,  # backward-compatible alias
            "policy_version": ALERT_POLICY_VERSION,
            "provenance": alert_provenance,
            "confidence": confidence,
            "evidence": evidence,
            "explanation": explanation,
            "warnings": warnings,
            "detection_timestamp": now.isoformat(),
            "resource_type": "red_zone",
            "resource_id": resource_id,
            "related_case_number": None,
            # Legacy fields for backward compatibility
            "current_count": count,
            "baseline_count": round(baseline_30d, 1),
            "spike_ratio": round(spike_ratio, 2),
            "stations": sorted(stations.get(key, set())),
            "window": f"last {RedZoneThresholds.CURRENT_WINDOW_DAYS}d vs prior {RedZoneThresholds.BASELINE_WINDOW_DAYS}d baseline",
        })

    zones.sort(key=lambda z: (z["spike_ratio"], z["current_count"]), reverse=True)

    return {
        "generated_at": now.isoformat(),
        "policy_version": ALERT_POLICY_VERSION,
        "thresholds": {
            "min_current": _min_current,
            "ratio_threshold": _ratio_threshold,
            "current_window_days": RedZoneThresholds.CURRENT_WINDOW_DAYS,
            "baseline_window_days": RedZoneThresholds.BASELINE_WINDOW_DAYS,
        },
        "total_alerts": len(zones),
        "red_zones": zones,
    }


# ---------------------------------------------------------------------------
# Notification broadcast (deduplication-aware)
# ---------------------------------------------------------------------------

def notify_red_zones(db: Session, zones: list[dict[str, Any]]) -> dict[str, int]:
    """Broadcast one unread notification per zone; dedupes on resource_id."""
    from app.models.notification import Notification

    existing = {
        row[0]
        for row in db.query(Notification.resource_id)
        .filter(
            Notification.notification_type == "red_zone_spike",
            Notification.is_read.is_(False),
        )
        .all()
        if row[0]
    }

    created = skipped = 0
    for zone in zones:
        resource_id = zone.get("resource_id", f"redzone:{zone['district']}:{zone['crime_category']}")
        if resource_id in existing:
            skipped += 1
            continue

        severity = zone.get("severity", "high")
        db.add(
            Notification(
                user_id=None,
                subject="Red-zone spike detected",
                notification_type="red_zone_spike",
                category="crime_alert",
                title=f"Red zone: {zone['crime_category']} spiking in {zone['district']}",
                message=(
                    f"{zone['evidence']['current_count']} incidents in the last "
                    f"{RedZoneThresholds.CURRENT_WINDOW_DAYS} days vs a baseline of "
                    f"{zone['evidence']['baseline_count']} "
                    f"(x{zone['evidence']['spike_ratio']}). "
                    f"Policy: {zone.get('policy_version', ALERT_POLICY_VERSION)}. "
                    f"Provenance: {zone.get('provenance', 'UNKNOWN')}. "
                    f"Confidence: {zone.get('confidence', 'LOW')}. "
                    f"Stations: {', '.join(zone.get('stations', [])) or 'district-wide'}."
                ),
                severity=severity,
                priority="high" if severity == AlertSeverity.CRITICAL.value else "medium",
                status=AlertStatus.NEW.value,
                resource_type="red_zone",
                resource_id=resource_id,
                related_case_number=None,
                is_broadcast=True,
            )
        )
        existing.add(resource_id)
        created += 1

    if created:
        db.commit()
    return {"created": created, "skipped": skipped}


# ---------------------------------------------------------------------------
# District ranking
# ---------------------------------------------------------------------------

def rank_districts(
    db: Session,
    *,
    window_days: int | None = None,
) -> list[dict[str, Any]]:
    """Rank districts by raw incident count in the current window.

    Methodology (from central policy):
      - Metric: incident_count
      - Window: 30 days (configurable)
      - No population normalisation (no reliable per-district data)
      - No severity weighting
    """
    from sqlalchemy import func

    from app.core.alert_policy import DistrictRanking
    from app.models.location import Location

    _window = window_days or DistrictRanking.WINDOW_DAYS
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=_window)

    rows = (
        db.query(Location.district, func.count(CrimeCase.id))
        .join(CrimeCase, CrimeCase.location_id == Location.id)
        .filter(CrimeCase.occurred_at >= cutoff)
        .group_by(Location.district)
        .order_by(func.count(CrimeCase.id).desc())
        .all()
    )

    result = []
    for rank, (district, count) in enumerate(rows, start=1):
        if count < DistrictRanking.MIN_EVIDENCE:
            continue
        result.append({
            "district": district,
            "incident_count": count,
            "rank": rank,
            "period_days": _window,
            "metric": DistrictRanking.METRIC,
        })
    return result


# ---------------------------------------------------------------------------
# Crime-category ranking
# ---------------------------------------------------------------------------

def rank_categories(
    db: Session,
    *,
    window_days: int | None = None,
    district: str | None = None,
) -> list[dict[str, Any]]:
    """Rank crime categories by total incidents in the current window.

    Methodology (from central policy):
      - Metric: incident_count
      - Secondary: change_percentage vs prior window
      - Window: 30 days (configurable)
    """
    from sqlalchemy import func

    from app.core.alert_policy import CategoryRanking
    from app.models.crime_category import CrimeCategory
    from app.models.location import Location

    _window = window_days or CategoryRanking.WINDOW_DAYS
    now = datetime.now(timezone.utc)
    cutoff_current = now - timedelta(days=_window)
    cutoff_prior = now - timedelta(days=_window * 2)

    current_rows = (
        db.query(CrimeCategory.name, func.count(CrimeCase.id))
        .join(CrimeCase, CrimeCase.category_id == CrimeCategory.id)
    )
    if district:
        current_rows = current_rows.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    current_rows = (
        current_rows
        .filter(CrimeCase.occurred_at >= cutoff_current)
        .group_by(CrimeCategory.name)
        .all()
    )
    prior_rows = (
        db.query(CrimeCategory.name, func.count(CrimeCase.id))
        .join(CrimeCase, CrimeCase.category_id == CrimeCategory.id)
    )
    if district:
        prior_rows = prior_rows.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    prior_rows = (
        prior_rows
        .filter(CrimeCase.occurred_at >= cutoff_prior, CrimeCase.occurred_at < cutoff_current)
        .group_by(CrimeCategory.name)
        .all()
    )

    prior_map = {name: count for name, count in prior_rows}

    result = []
    for rank, (name, count) in enumerate(
        sorted(current_rows, key=lambda r: r[1], reverse=True), start=1
    ):
        if count < CategoryRanking.MIN_EVIDENCE:
            continue
        prior_count = prior_map.get(name, 0)
        change_pct = (
            round(((count - prior_count) / max(prior_count, 1)) * 100, 1)
            if prior_count > 0
            else 100.0 if count > 0 else 0.0
        )
        result.append({
            "category": name,
            "incident_count": count,
            "rank": rank,
            "period_days": _window,
            "metric": CategoryRanking.METRIC,
            "change_percentage": change_pct,
        })
    return result
