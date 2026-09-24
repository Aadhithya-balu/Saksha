"""Database-backed dashboard services with dynamic filter options."""
from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR
from app.models.location import Location
from app.models.officer import Officer
from app.models.evidence import Evidence


def _apply_case_filters(
    query,
    has_location_joined: bool = False,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | uuid.UUID | None = None,
    officer_id: str | uuid.UUID | None = None,
    priority: str | None = None,
    status: str | None = None,
):
    if date_from:
        query = query.filter(CrimeCase.occurred_at >= date_from)
    if date_to:
        query = query.filter(CrimeCase.occurred_at <= date_to)
    if district:
        if not has_location_joined:
            query = query.join(Location, CrimeCase.location_id == Location.id)
        query = query.filter(Location.district == district)
    if category_id:
        if isinstance(category_id, str):
            try:
                category_id = uuid.UUID(category_id)
            except (ValueError, TypeError):
                pass
        query = query.filter(CrimeCase.category_id == category_id)
    if officer_id:
        if isinstance(officer_id, str):
            try:
                officer_id = uuid.UUID(officer_id)
            except (ValueError, TypeError):
                pass
        query = query.filter(CrimeCase.assigned_officer_id == officer_id)
    if priority:
        query = query.filter(CrimeCase.priority == priority)
    if status:
        query = query.filter(CrimeCase.status == status)
    return query


def get_filtered_summary(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    query = db.query(CrimeCase)
    query = _apply_case_filters(
        query,
        date_from=date_from,
        date_to=date_to,
        district=district,
        category_id=category_id,
        officer_id=officer_id,
        priority=priority,
        status=status,
    )

    total_crimes = query.count()
    open_crimes = query.filter(CrimeCase.status == "open").count()
    resolved = query.filter(CrimeCase.status == "closed").count()
    investigating = query.filter(CrimeCase.status == "investigating").count()

    # FIR filter counts
    fir_query = db.query(FIR)
    if date_from or date_to or district or category_id or officer_id or priority or status:
        # Filter FIRs linked to matching cases
        case_ids_query = db.query(CrimeCase.id)
        case_ids_query = _apply_case_filters(
            case_ids_query,
            date_from=date_from,
            date_to=date_to,
            district=district,
            category_id=category_id,
            officer_id=officer_id,
            priority=priority,
            status=status,
        )
        fir_query = fir_query.filter(FIR.crime_case_id.in_(case_ids_query.subquery()))

    total_firs = fir_query.count()
    total_criminals = db.query(Criminal).count()

    return {
        "total_crimes": total_crimes,
        "open_crimes": open_crimes,
        "resolved_crimes": resolved,
        "investigating_crimes": investigating,
        "total_firs": total_firs,
        "total_criminals": total_criminals,
        "resolution_rate_percent": round((resolved / total_crimes) * 100, 2) if total_crimes else 0.0,
    }


def get_filtered_trends(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    query = db.query(CrimeCase.occurred_at, CrimeCase.status)
    query = _apply_case_filters(
        query,
        date_from=date_from,
        date_to=date_to,
        district=district,
        category_id=category_id,
        officer_id=officer_id,
        priority=priority,
        status=status,
    )
    rows = query.order_by(CrimeCase.occurred_at).all()

    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "solved": 0})
    for occurred_at, status in rows:
        if occurred_at:
            bucket = buckets[occurred_at.date().replace(day=1).isoformat()]
            bucket["total"] += 1
            if status == "closed":
                bucket["solved"] += 1
    return [
        {"date": date, "count": bucket["total"], "solved": bucket["solved"]}
        for date, bucket in sorted(buckets.items())
    ]


def get_filtered_category_breakdown(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    query = db.query(CrimeCategory.name, func.count(CrimeCase.id)).join(CrimeCase, CrimeCase.category_id == CrimeCategory.id)
    query = _apply_case_filters(
        query,
        date_from=date_from,
        date_to=date_to,
        district=district,
        category_id=category_id,
        officer_id=officer_id,
        priority=priority,
        status=status,
    )
    rows = query.group_by(CrimeCategory.name).order_by(func.count(CrimeCase.id).desc()).all()
    return [{"category": name, "count": count} for name, count in rows]


def get_filtered_district_comparison(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
    category_id: str | None = None,
    officer_id: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    query = db.query(Location.district, func.count(CrimeCase.id)).join(CrimeCase, CrimeCase.location_id == Location.id)
    query = _apply_case_filters(
        query,
        has_location_joined=True,
        date_from=date_from,
        date_to=date_to,
        district=district,
        category_id=category_id,
        officer_id=officer_id,
        priority=priority,
        status=status,
    )
    rows = query.group_by(Location.district).order_by(func.count(CrimeCase.id).desc()).all()
    return [{"district": dist, "count": count} for dist, count in rows]


def _officer_count(db: Session, district: str | None = None) -> int:
    query = db.query(Officer)
    if district:
        query = query.filter(Officer.district == district)
    return query.count()


def get_officer_stats(db: Session, district: str | None = None) -> dict[str, Any]:
    total_officers = _officer_count(db, district)
    active_offices = db.query(Officer).filter(Officer.status == "active")
    if district:
        active_offices = active_offices.filter(Officer.district == district)
    active_officers = active_offices.count()

    investigating_query = (
        db.query(Officer)
        .join(CrimeCase, CrimeCase.assigned_officer_id == Officer.id)
        .filter(CrimeCase.status == "open")
    )
    if district:
        investigating_query = investigating_query.join(
            Location, CrimeCase.location_id == Location.id
        ).filter(Location.district == district)
    investigating_officers = investigating_query.distinct().count()

    # No on_duty/off_duty fields: the Officer schema has no duty-state column,
    # so any such value would be fabricated. Report only counts the schema and
    # query actually support (issue #282 §18 — never invent availability).
    return {
        "total_officers": total_officers,
        "active_officers": active_officers,
        "investigating_officers": investigating_officers,
    }


def _evidence_status_query(db: Session, status: str, district: str | None = None):
    query = db.query(Evidence).filter(Evidence.status == status)
    if district:
        query = (
            query.join(CrimeCase, Evidence.case_id == CrimeCase.id)
            .join(Location, CrimeCase.location_id == Location.id)
            .filter(Location.district == district)
        )
    return query


def get_evidence_stats(db: Session, district: str | None = None) -> dict[str, Any]:
    collected = _evidence_status_query(db, "Collected", district).count()
    pending = _evidence_status_query(db, "Pending", district).count()
    verified = _evidence_status_query(db, "Verified", district).count()
    rejected = _evidence_status_query(db, "Rejected", district).count()

    total_evidence = collected + pending + verified + rejected
    if total_evidence == 0:
        return {
            "collected": 0,
            "pending": 0,
            "verified": 0,
            "rejected": 0,
        }

    return {
        "collected": collected,
        "pending": pending,
        "verified": verified,
        "rejected": rejected,
    }


def get_recent_incidents(db: Session, limit: int = 5, district: str | None = None) -> list[dict[str, Any]]:
    cases = (
        db.query(CrimeCase)
        .options(joinedload(CrimeCase.category), joinedload(CrimeCase.location))
    )
    if district:
        cases = cases.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    cases = (
        cases.order_by(CrimeCase.reported_at.desc()).limit(limit).all()
    )
    return [
        {
            "id": str(case.id),
            "case_number": case.case_number,
            "crime_type": case.category.name if case.category else "Unclassified",
            "location": case.location.station or case.location.district if case.location else "Unknown",
            "district": case.location.district if case.location else None,
            "time": case.occurred_at.isoformat() if case.occurred_at else None,
            "status": case.status,
            "priority": case.priority,
        }
        for case in cases
    ]


def _case_count_in_window(db: Session, district: str | None, occurred_before=None, occurred_after=None) -> int:
    query = db.query(CrimeCase)
    if district:
        query = query.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    if occurred_before is not None:
        query = query.filter(CrimeCase.occurred_at < occurred_before)
    if occurred_after is not None:
        query = query.filter(CrimeCase.occurred_at >= occurred_after)
    return query.count()


def _recent_case_records(db: Session, district: str | None, days: int = 180) -> list[dict[str, Any]]:
    """Row-dict basis for the real forecast model (occurred_at/district/category)."""
    start = datetime.now() - timedelta(days=days)
    cases = db.query(CrimeCase).options(joinedload(CrimeCase.location), joinedload(CrimeCase.category)).filter(
        CrimeCase.occurred_at >= start
    )
    if district:
        cases = cases.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    return [
        {
            "occurred_at": case.occurred_at,
            "district": district or (case.location.district if case.location else "Unknown"),
            "category": case.category.name if case.category else "Unclassified",
        }
        for case in cases.all()
    ]


def _forecast_estimate(db: Session, district: str | None) -> dict[str, Any]:
    """Run the real forecast model against live records; never fabricate values.

    Returns an honest availability envelope — the frontend renders an
    "insufficient data" state instead of a guessed number (issue #282 §15).
    """
    unavailable = {
        "available": False,
        "method": "unavailable",
        "method_version": None,
        "reason": None,
        "next_day_forecast": None,
        "next_week_forecast": None,
    }
    records = _recent_case_records(db, district)
    if len(records) < 30:
        return {**unavailable, "reason": "insufficient historical data"}
    try:
        from app.ai.inference.risk import get_model_info, predict_forecast

        points = predict_forecast(records)
    except Exception:
        return {**unavailable, "reason": "forecast computation failed"}
    ml_points = [p for p in points or [] if p.get("prediction_mode") == "ML"]
    if not ml_points:
        return {**unavailable, "reason": "trained forecast model not available"}
    target = ml_points[0]
    if district:
        target = next((p for p in ml_points if p.get("district") == district), target)
    try:
        monthly = max(float(target.get("predicted_crime_count", 0.0) or 0.0), 0.0)
    except (TypeError, ValueError):
        return {**unavailable, "reason": "forecast computation failed"}
    per_day = monthly / 30.0
    try:
        version = get_model_info().get("version")
    except Exception:
        version = None
    return {
        "available": True,
        "method": "forecast-model-estimate",
        "method_version": version,
        "reason": None,
        "next_day_forecast": int(round(per_day)),
        "next_week_forecast": int(round(per_day * 7)),
    }


def get_forecast_data(db: Session, district: str | None = None) -> dict[str, Any]:
    total_crimes = _case_count_in_window(db, district)
    now = datetime.now()
    last_week_crimes = _case_count_in_window(db, district, occurred_after=now - timedelta(days=7))
    prev_week_crimes = _case_count_in_window(db, district, occurred_before=now - timedelta(days=7), occurred_after=now - timedelta(days=14))

    expected_change = 0.0
    if prev_week_crimes > 0:
        expected_change = round(((last_week_crimes - prev_week_crimes) / prev_week_crimes) * 100, 1)

    trend_direction = "stable"
    if expected_change > 2.0:
        trend_direction = "up"
    elif expected_change < -2.0:
        trend_direction = "down"

    start = (now - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    query = db.query(CrimeCase.occurred_at)
    if district:
        query = query.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    daily = query.filter(CrimeCase.occurred_at >= start).all()

    day_buckets: Counter[str] = Counter()
    for (occurred_at,) in daily:
        if occurred_at:
            day_buckets[occurred_at.date().isoformat()] += 1
    # Real historical series covering the trailing 14 calendar days (zeros are
    # genuine zero-activity days, never placeholder values).
    series = [
        {
            "day": day.date().isoformat(),
            "value": day_buckets.get(day.date().isoformat(), 0),
            "type": "historical",
            "color": 0x1E6FD9,
            "hexColor": "#1E6FD9",
        }
        for day in (start + timedelta(days=i) for i in range(14))
    ]
    # Mark the most recent day with recorded activity as "today" for anchoring.
    historical_days = [s for s in series if s["value"] > 0]
    if historical_days:
        historical_days[-1].update({"type": "today", "color": 0x0E9E78, "hexColor": "#0E9E78"})

    forecast = _forecast_estimate(db, district)

    return {
        "next_day_forecast": forecast["next_day_forecast"],
        "next_week_forecast": forecast["next_week_forecast"],
        "expected_change_percent": expected_change,
        "trend_direction": trend_direction,
        "series": series,
        "available": forecast["available"],
        "method": forecast["method"],
        "method_version": forecast["method_version"],
        "reason": forecast["reason"],
        "sample_size": total_crimes,
    }


def get_risk_prediction(db: Session, district: str | None = None) -> dict[str, Any]:
    """Deterministic, sample-derived risk outlook (RULE-SQL-V2).

    Every output is a real function of observed rows. With zero records there
    is nothing to estimate, so the API returns an unavailable envelope and the
    UI renders an honest empty state (issue #282 §16).
    """
    total_crimes = _case_count_in_window(db, district)
    open_query = db.query(CrimeCase).filter(CrimeCase.status == "open")
    if district:
        open_query = open_query.join(Location, CrimeCase.location_id == Location.id).filter(Location.district == district)
    open_crimes = open_query.count()

    base = {
        "method": "rule-based",
        "method_version": "RULE-SQL-V2",
        "sample_size": total_crimes,
    }
    if total_crimes == 0:
        return {
            **base,
            "available": False,
            "crime_risk_percent": None,
            "threat_level": None,
            "trend": None,
            "confidence_score": None,
            "prediction_time": "Next 7 Days",
        }

    open_ratio = open_crimes / total_crimes
    crime_risk_percent = round(35 + (open_ratio * 40) + (min(total_crimes, 50) / 50 * 15), 1)

    threat_level = "Low"
    if crime_risk_percent >= 85:
        threat_level = "Critical"
    elif crime_risk_percent >= 70:
        threat_level = "High"
    elif crime_risk_percent >= 50:
        threat_level = "Medium"

    trend = "increasing" if open_ratio > 0.4 else "decreasing" if open_ratio < 0.25 else "stable"
    # Deterministic confidence from observed sample size — monotonically
    # increasing with records, never a fixed/synthetic value.
    confidence_score = round(min(1.0, total_crimes / 100.0), 2)

    return {
        **base,
        "available": True,
        "crime_risk_percent": crime_risk_percent,
        "threat_level": threat_level,
        "trend": trend,
        "confidence_score": confidence_score,
        "prediction_time": "Next 7 Days",
    }


SEASON_MAP = {
    1: "Winter", 2: "Winter", 3: "Summer",
    4: "Summer", 5: "Summer", 6: "Monsoon",
    7: "Monsoon", 8: "Monsoon", 9: "Monsoon",
    10: "Post-Monsoon", 11: "Post-Monsoon", 12: "Winter",
}
SEASON_ORDER = ["Summer", "Monsoon", "Post-Monsoon", "Winter"]


def get_season_breakdown(db: Session, district: str | None = None) -> dict[str, Any]:

    rows = db.query(CrimeCase.occurred_at, Location.district).join(
        Location, CrimeCase.location_id == Location.id
    )
    if district:
        rows = rows.filter(Location.district == district)
    rows = rows.all()

    season_counts: dict[str, int] = {s: 0 for s in SEASON_ORDER}
    season_districts: dict[str, Counter[str]] = defaultdict(Counter)

    for occurred_at, district in rows:
        if not occurred_at:
            continue
        season = SEASON_MAP.get(occurred_at.month, "Unknown")
        if season in season_counts:
            season_counts[season] += 1
            season_districts[season][district] += 1

    total = sum(season_counts.values())
    result = []
    for season in SEASON_ORDER:
        count = season_counts[season]
        pct = round((count / total) * 100, 1) if total else 0.0
        top_district = season_districts[season].most_common(1)[0][0] if season_districts[season] else ""
        result.append({
            "season": season,
            "count": count,
            "percentage": pct,
            "top_district": top_district,
        })

    return {
        "seasons": result,
        "total_cases": total,
    }
