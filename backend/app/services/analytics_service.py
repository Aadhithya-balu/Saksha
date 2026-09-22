"""Database-backed analytics used by the prototype UI.

These functions are intentionally rule-based: they make the app dynamic and
complete without pretending an ML model is already trained.
"""
from __future__ import annotations

import math
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.location import Location
from app.models.victim import Victim

SEVERITY_WEIGHT = {"low": 0.8, "medium": 1.0, "high": 1.25, None: 1.0}


def _district_fir_ids(db: Session, district: str):
    """FIR ids whose case location is in ``district`` (chat/analytics scope)."""
    return db.query(FIR.id).join(CrimeCase, CrimeCase.id == FIR.crime_case_id).join(
        Location, Location.id == CrimeCase.location_id
    ).filter(Location.district == district)


def _district_criminal_ids(db: Session, district: str):
    """Criminal ids linked to at least one FIR in ``district``."""
    return db.query(FIRCriminalLink.criminal_id).join(
        FIR, FIR.id == FIRCriminalLink.fir_id
    ).join(CrimeCase, CrimeCase.id == FIR.crime_case_id).join(
        Location, Location.id == CrimeCase.location_id
    ).filter(Location.district == district)


def derive_data_provenance(records: list) -> str:
    """Derive data provenance from actual source records.

    Returns one of: 'LIVE_DB', 'DEMO', 'LIVE_DB + DEMO', 'UNKNOWN'
    based on the dataset_provenance column of the source records.
    """
    if not records:
        return 'UNKNOWN'
    provenance_set = set()
    for record in records:
        prov = getattr(record, 'dataset_provenance', None) or 'unknown'
        provenance_set.add(prov.lower().strip())
    if provenance_set <= {'live'}:
        return 'LIVE_DB'
    if provenance_set <= {'demo'}:
        return 'DEMO'
    if 'live' in provenance_set and 'demo' in provenance_set:
        return 'LIVE_DB + DEMO'
    if 'unknown' in provenance_set:
        if len(provenance_set) == 1:
            return 'UNKNOWN'
        others = provenance_set - {'unknown'}
        if others <= {'live'}:
            return 'LIVE_DB'
        if others <= {'demo'}:
            return 'DEMO'
        return 'MIXED'
    return 'MIXED'


def recent_activity(db: Session, days: int = 0, district: str | None = None) -> dict[str, Any]:
    """Time-aware activity summary so the chat can answer 'any records today?'.

    days=0 means since local midnight (i.e. today); otherwise a rolling window.
    ``district`` narrows every figure to one district for scoped callers.
    """
    from app.models.evidence import Evidence

    now = datetime.now()
    if days <= 0:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = f"today ({start.strftime('%Y-%m-%d')})"
    else:
        start = now - timedelta(days=days)
        period_label = f"{start.strftime('%Y-%m-%d %H:%M')} to {now.strftime('%Y-%m-%d %H:%M')}"

    new_cases = (
        db.query(CrimeCase).join(Location, Location.id == CrimeCase.location_id).filter(
            CrimeCase.created_at >= start
        ).filter(Location.district == district if district else True).count()
    )
    new_firs = (
        db.query(FIR).filter(FIR.created_at >= start)
        .filter(FIR.id.in_(list(r[0] for r in _district_fir_ids(db, district).all())) if district else True).count()
    )
    new_evidence = (
        db.query(Evidence).join(CrimeCase, CrimeCase.id == Evidence.case_id)
        .join(Location, Location.id == CrimeCase.location_id).filter(
            Evidence.created_at >= start
        ).filter(Location.district == district if district else True).count()
    )
    new_criminals = (
        db.query(Criminal).filter(Criminal.created_at >= start)
        .filter(Criminal.id.in_(list(r[0] for r in _district_criminal_ids(db, district).all())) if district else True).count()
    )

    case_q = db.query(CrimeCase).join(Location, Location.id == CrimeCase.location_id)
    if district:
        case_q = case_q.filter(Location.district == district)
    latest_case = case_q.order_by(CrimeCase.created_at.desc()).first()

    fir_q = db.query(FIR)
    if district:
        fir_q = fir_q.filter(FIR.id.in_(list(r[0] for r in _district_fir_ids(db, district).all())))
    latest_fir = fir_q.order_by(FIR.created_at.desc()).first()

    return {
        "period_label": period_label,
        "new_cases": new_cases,
        "new_firs": new_firs,
        "new_evidence": new_evidence,
        "new_criminals": new_criminals,
        "latest_case": (
            f"{latest_case.case_number} registered {latest_case.created_at.strftime('%Y-%m-%d %H:%M')}"
            if latest_case and latest_case.created_at else "none on file"
        ),
        "latest_fir": (
            f"{latest_fir.fir_number} filed {latest_fir.created_at.strftime('%Y-%m-%d %H:%M')}"
            if latest_fir and latest_fir.created_at else "none on file"
        ),
        "now": now.strftime("%Y-%m-%d %H:%M"),
    }

SEASON_MAP = {
    1: "Winter", 2: "Winter", 3: "Summer",
    4: "Summer", 5: "Summer", 6: "Monsoon",
    7: "Monsoon", 8: "Monsoon", 9: "Monsoon",
    10: "Post-Monsoon", 11: "Post-Monsoon", 12: "Winter",
}

SEASON_ORDER = ["Summer", "Monsoon", "Post-Monsoon", "Winter"]


def get_season(month: int) -> str:
    return SEASON_MAP.get(month, "Unknown")


@dataclass(frozen=True)
class DistrictAggregate:
    district: str
    total: int
    open_cases: int
    high_severity: int
    recent_cases: int
    top_category: str
    lat: float
    lng: float


def dashboard_summary(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    district: str | None = None,
) -> dict[str, Any]:
    query = db.query(CrimeCase)
    if district:
        query = query.join(Location, Location.id == CrimeCase.location_id).filter(Location.district == district)
    if date_from:
        query = query.filter(CrimeCase.occurred_at >= date_from)
    if date_to:
        query = query.filter(CrimeCase.occurred_at <= date_to)

    total_crimes = query.count()
    open_crimes = query.filter(CrimeCase.status == "open").count()
    resolved = query.filter(CrimeCase.status == "closed").count()

    fir_q = db.query(FIR)
    criminal_q = db.query(Criminal)
    if district:
        fir_ids = [r[0] for r in _district_fir_ids(db, district).all()]
        fir_q = fir_q.filter(FIR.id.in_(fir_ids))
        criminal_q = criminal_q.filter(Criminal.id.in_([r[0] for r in _district_criminal_ids(db, district).all()]))

    return {
        "total_crimes": total_crimes,
        "open_crimes": open_crimes,
        "total_firs": fir_q.count(),
        "total_criminals": criminal_q.count(),
        "resolution_rate_percent": round((resolved / total_crimes) * 100, 2) if total_crimes else 0.0,
    }


def crime_trends(db: Session) -> list[dict[str, Any]]:
    rows = db.query(CrimeCase.occurred_at).order_by(CrimeCase.occurred_at).all()
    buckets: Counter[str] = Counter()
    for (occurred_at,) in rows:
        if occurred_at:
            buckets[occurred_at.date().replace(day=1).isoformat()] += 1
    return [{"date": date, "count": count} for date, count in sorted(buckets.items())]


def category_breakdown(db: Session, district: str | None = None) -> list[dict[str, Any]]:
    query = (
        db.query(CrimeCategory.name, func.count(CrimeCase.id))
        .join(CrimeCase, CrimeCase.category_id == CrimeCategory.id)
    )
    if district:
        query = query.join(Location, Location.id == CrimeCase.location_id).filter(Location.district == district)
    rows = query.group_by(CrimeCategory.name).order_by(func.count(CrimeCase.id).desc()).all()
    return [{"category": name, "count": count} for name, count in rows]


def district_comparison(db: Session, district: str | None = None) -> list[dict[str, Any]]:
    query = (
        db.query(Location.district, func.count(CrimeCase.id))
        .join(CrimeCase, CrimeCase.location_id == Location.id)
    )
    if district:
        query = query.filter(Location.district == district)
    rows = query.group_by(Location.district).order_by(func.count(CrimeCase.id).desc()).all()
    return [{"district": district, "count": count} for district, count in rows]


def _district_aggregates(db: Session) -> list[DistrictAggregate]:
    cases = (
        db.query(CrimeCase)
        .options(joinedload(CrimeCase.location), joinedload(CrimeCase.category))
        .all()
    )
    if not cases:
        return []

    grouped: dict[str, list[CrimeCase]] = defaultdict(list)
    for case in cases:
        if case.location:
            grouped[case.location.district].append(case)

    aggregates: list[DistrictAggregate] = []
    for district, district_cases in grouped.items():
        category_counts = Counter(case.category.name for case in district_cases if case.category)
        lat = sum(case.location.latitude for case in district_cases) / len(district_cases)
        lng = sum(case.location.longitude for case in district_cases) / len(district_cases)
        aggregates.append(
            DistrictAggregate(
                district=district,
                total=len(district_cases),
                open_cases=sum(1 for case in district_cases if case.status == "open"),
                high_severity=sum(1 for case in district_cases if case.category and case.category.severity == "high"),
                recent_cases=sum(1 for case in district_cases if _within_days(case.occurred_at, 30)),
                top_category=category_counts.most_common(1)[0][0] if category_counts else "Unclassified",
                lat=lat,
                lng=lng,
            )
        )
    return sorted(aggregates, key=lambda item: item.total, reverse=True)


def risk_scores(db: Session, district_id: str | None = None, window: str = "next_7d") -> dict[str, Any]:
    aggregates = _district_aggregates(db)
    if district_id:
        aggregates = [item for item in aggregates if item.district == district_id]

    max_total = max((item.total for item in aggregates), default=1)
    max_recent = max((item.recent_cases for item in aggregates), default=1)
    predictions = []
    for item in aggregates:
        open_ratio = item.open_cases / item.total if item.total else 0
        severity_ratio = item.high_severity / item.total if item.total else 0
        volume_component = (item.total / max_total) * 50
        recency_component = (item.recent_cases / max_recent) * 30 if max_recent > 0 else 0
        score = min(100, round(volume_component + recency_component + open_ratio * 12 + severity_ratio * 8))
        predictions.append(
            {
                "district": item.district,
                "risk_score": score,
                "confidence": round(min(0.95, 0.58 + (item.total / max_total) * 0.32), 2),
            }
        )

    return {
        "district_id": district_id,
        "window": window,
        "grid_predictions": sorted(predictions, key=lambda row: row["risk_score"], reverse=True),
        "model_version": "rule-based-sql-v2",
    }


# ---------------------------------------------------------------------------
# Spatial statistics (issue #143 gap 131.1)
#
# The legacy hotspot score was ad-hoc counting (35 + share*55 + recent*2).
# These helpers add proper cluster-significance testing:
#   - Getis-Ord Gi*  : per-location z-scores for high-high clustering,
#   - Gaussian KDE   : smooth incident density surface over lat/lng,
#   - Global Moran's I: spatial autocorrelation of the whole map.
# Pure numpy/math — no new dependencies.
# ---------------------------------------------------------------------------

GISTAR_BAND_KM = 25.0          # neighbour distance band for the spatial weights
EARTH_RADIUS_KM = 6371.0088


def _haversine_km_matrix(lats: np.ndarray, lngs: np.ndarray) -> np.ndarray:
    """Pairwise great-circle distance matrix (km) between location centroids."""
    lat = np.radians(np.asarray(lats, dtype=np.float64))
    lon = np.radians(np.asarray(lngs, dtype=np.float64))
    dlat = lat[:, None] - lat[None, :]
    dlon = lon[:, None] - lon[None, :]
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat)[:, None] * np.cos(lat)[None, :] * np.sin(dlon / 2.0) ** 2
    return 2.0 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))


def _distance_band_weights(dist_km: np.ndarray, band_km: float) -> np.ndarray:
    """Binary Gi* weights including the self-pair (the 'star' convention)."""
    return (dist_km <= band_km).astype(np.float64)


def _two_sided_p(z: float) -> float:
    """Two-tailed p-value under the standard normal approximation."""
    return math.erfc(abs(z) / math.sqrt(2.0))


def getis_ord_gi_star(values: np.ndarray, weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Getis-Ord Gi* z-scores and two-sided p-values for weighted points.

    values  : (n,) observed counts per location
    weights : (n, n) symmetric spatial weights (self-inclusive for Gi* star)
    """
    values = np.asarray(values, dtype=np.float64)
    n = len(values)
    if n < 3 or not weights.any():
        return np.zeros(n), np.ones(n)

    x_bar = values.mean()
    s_numerator = (values ** 2).sum() / n - x_bar ** 2
    if s_numerator <= 0:
        return np.zeros(n), np.ones(n)
    s = math.sqrt(s_numerator)

    w_sums = weights.sum(axis=1)                       # Σ_j w_ij
    w_sq_sums = (weights ** 2).sum(axis=1)             # Σ_j w_ij²
    w_x = weights @ values                             # Σ_j w_ij x_j

    denom = s * np.sqrt((n * w_sq_sums - w_sums ** 2) / max(n - 1, 1))
    denom = np.where(denom > 1e-12, denom, 1e-12)
    z_scores = (w_x - x_bar * w_sums) / denom
    p_values = np.array([_two_sided_p(float(z)) for z in z_scores])
    return z_scores, p_values


def morans_i(values: np.ndarray, weights: np.ndarray) -> dict[str, float | None]:
    """Global Moran's I with randomisation-normality variance and z-test."""
    values = np.asarray(values, dtype=np.float64)
    weights = np.asarray(weights, dtype=np.float64)
    n = len(values)
    if n < 4 or not weights.any():
        return {"moran_i": None, "expected_i": None, "z_score": None, "p_value": None}

    s0 = float(weights.sum())
    if s0 <= 0:
        return {"moran_i": None, "expected_i": None, "z_score": None, "p_value": None}

    deviations = values - values.mean()
    num = float((deviations[:, None] * weights * deviations[None, :]).sum())
    den = float((deviations ** 2).sum())
    if den <= 0:
        return {"moran_i": None, "expected_i": None, "z_score": None, "p_value": None}

    moran = (n / s0) * num / den
    expected = -1.0 / (n - 1)

    s1 = 0.5 * float(((weights + weights.T) ** 2).sum())
    row_sums = weights.sum(axis=1) + weights.sum(axis=0)
    s2 = float((row_sums ** 2).sum())
    m2 = den / n
    m4 = float((deviations ** 4).sum() / n)
    b2 = m4 / (m2 ** 2) if m2 > 0 else 0.0

    var_numerator = (
        n * ((n ** 2 - 3 * n + 3) * s1 - n * s2 + 3 * s0 ** 2)
        - b2 * ((n ** 2 - n) * s1 - 2 * n * s0 ** 2 + 6 * s0 ** 2)
    )
    var_denominator = (n - 1) ** 2 * (n - 2) * (n - 3) * s0 ** 2
    variance = var_numerator / var_denominator if var_denominator > 0 else 0.0
    z_score = (moran - expected) / math.sqrt(variance) if variance > 0 else 0.0

    return {
        "moran_i": round(moran, 4),
        "expected_i": round(expected, 4),
        "z_score": round(float(z_score), 4),
        "p_value": round(_two_sided_p(float(z_score)), 4),
    }


def gaussian_kde_density(
    points_lat: np.ndarray,
    points_lng: np.ndarray,
    eval_lat: np.ndarray,
    eval_lng: np.ndarray,
) -> np.ndarray:
    """Gaussian kernel density estimate at evaluation points.

    ``points_*`` are individual incident coordinates; bandwidth follows
    Silverman's rule applied to the mean pairwise distance so the estimate
    adapts to the spatial spread of the data.
    """
    pts = np.column_stack([np.radians(points_lat, dtype=np.float64), np.radians(points_lng, dtype=np.float64)])
    ev = np.column_stack([np.radians(eval_lat, dtype=np.float64), np.radians(eval_lng, dtype=np.float64)])
    n_pts = len(pts)
    if n_pts == 0 or len(ev) == 0:
        return np.zeros(max(len(ev), 0))
    # Pairwise distances evaluation-points × incident-points (km)
    dlat = ev[:, None, 0] - pts[None, :, 0]
    dlon = ev[:, None, 1] - pts[None, :, 1]
    a = np.sin(dlat / 2.0) ** 2 + np.cos(ev[:, 0])[:, None] * np.cos(pts[:, 0])[None, :] * np.sin(dlon / 2.0) ** 2
    dist = 2.0 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))

    bandwidth = 5.0
    if n_pts > 1:
        mean_pairwise = float(_haversine_km_matrix(points_lat, points_lng).mean()) or 1.0
        # Silverman-style bandwidth (km), clamped so kernels stay local.
        bandwidth = float(np.clip(0.9 * mean_pairwise * n_pts ** (-1.0 / 5.0), 2.0, 50.0))

    u = dist / bandwidth
    kernels = np.exp(-0.5 * u ** 2)
    density = kernels.sum(axis=1) / (n_pts * bandwidth * math.sqrt(2.0 * math.pi))
    return density


def hotspots(db: Session, district_id: str | None = None, hour: int | None = None) -> dict[str, Any]:
    """Statistically scored spatial hotspots (issue #143 gap 131.1).

    Replaces ad-hoc counting with Getis-Ord Gi* cluster significance,
    Gaussian kernel density estimation, and a global Moran's I test.
    Legacy response fields (score/category/trend ordering contract) are kept;
    new fields are additive only.

    ``hour`` (issue #146 gap 128.2/131.2) restricts the analysis to incidents
    whose occurred_at hour-of-day matches, powering the TimeSlider drill-down.
    """
    from app.services.ttl_cache import ttl_cached

    return ttl_cached(
        "analytics_service.hotspots",
        (district_id, hour),
        ttl_seconds=60,
        compute=lambda: _build_hotspots(db, district_id=district_id, hour=hour),
        scope=db.bind,
    )


def _build_hotspots(db: Session, district_id: str | None = None, hour: int | None = None) -> dict[str, Any]:
    query = db.query(Location).join(CrimeCase, CrimeCase.location_id == Location.id)
    if district_id:
        query = query.filter(Location.district == district_id)
    locations = query.options(joinedload(Location.crimes).joinedload(CrimeCase.category)).all()

    all_crimes = [case for loc in locations for case in loc.crimes]
    provenance = derive_data_provenance(all_crimes)

    prepared: list[dict[str, Any]] = []
    incident_lat: list[float] = []
    incident_lng: list[float] = []
    total_cases = 0
    for location in locations:
        crimes = [case for case in location.crimes]
        if not crimes:
            continue
        day_total = len(crimes)
        if hour is not None:
            crimes = [
                case
                for case in crimes
                if case.occurred_at is not None and case.occurred_at.hour == hour
            ]
            if not crimes:
                continue
        categories = Counter(case.category.name for case in crimes if case.category)
        recent = sum(1 for case in crimes if _within_days(case.occurred_at, 30))
        previous = max(len(crimes) - recent, 0)
        trend = "up" if recent > previous else "down" if recent < previous else "stable"
        total_cases += len(crimes)
        incident_lat.extend([location.latitude] * len(crimes))
        incident_lng.extend([location.longitude] * len(crimes))
        prepared.append(
            {
                "district_id": location.district,
                "name": location.station or location.address or location.district,
                "lat": location.latitude,
                "lng": location.longitude,
                "count": len(crimes),
                "day_total": day_total if hour is not None else len(crimes),
                "recent_count": recent,
                "category": categories.most_common(1)[0][0] if categories else "Unclassified",
                "trend": trend,
            }
        )

    if not prepared:
        return {
            "hour": hour,
            "hotspots": [],
            "analysis_mode": "STATISTICAL",
            "data_provenance": provenance,
            "statistics": {
                "method": "getis_ord_gi_star+kde+morans_i",
                "locations_assessed": 0,
                "incidents_assessed": 0,
                "bandwidth_km": GISTAR_BAND_KM,
                **morans_i(np.zeros(0), np.zeros((0, 0))),
            },
        }

    counts = np.array([item["count"] for item in prepared], dtype=np.float64)
    lats = np.array([item["lat"] for item in prepared], dtype=np.float64)
    lngs = np.array([item["lng"] for item in prepared], dtype=np.float64)

    # Spatial weights: self-inclusive distance band around each centroid.
    dist_km = _haversine_km_matrix(lats, lngs)
    weights = _distance_band_weights(dist_km, GISTAR_BAND_KM)

    z_scores, p_values = getis_ord_gi_star(counts, weights)

    # Kernel density evaluated at every location centroid -> percentile rank.
    densities = gaussian_kde_density(np.array(incident_lat), np.array(incident_lng), lats, lngs)
    kde_pct = np.zeros(len(densities))
    if densities.max() > densities.min():
        order = densities.argsort().argsort()
        kde_pct = order / max(len(densities) - 1, 1) * 100.0

    max_count = float(counts.max())
    rows: list[dict[str, Any]] = []
    for idx, item in enumerate(prepared):
        z = float(z_scores[idx])
        p = float(p_values[idx])
        # Composite 0-100 score blending cluster significance (Gi*), smoothed
        # density, raw volume share, and recency — deterministic and explainable.
        gi_component = float(np.clip(z / 3.0, -1.0, 1.5)) / 1.5 * 100.0
        volume_component = counts[idx] / max_count * 100.0
        # Scale recency proportionally to total incidents at this location
        total_at_location = max(item.get("day_total", item["count"]), 1)
        recency_pct = (item["recent_count"] / total_at_location) * 100.0
        recency_component = min(100.0, recency_pct)
        score = int(round(0.35 * max(gi_component, 0.0) + 0.25 * kde_pct[idx] + 0.25 * volume_component + 0.15 * recency_component))
        score = int(np.clip(score, 0, 100))
        rows.append(
            {
                **item,
                "score": score,
                "z_score": round(z, 4),
                "p_value": round(p, 4),
                "kde_percentile": round(float(kde_pct[idx]), 1),
                "significant": bool(p < 0.05 and z > 0),
            }
        )

    statistics = {
        "method": "getis_ord_gi_star+kde+morans_i",
        "locations_assessed": len(prepared),
        "incidents_assessed": int(total_cases),
        "bandwidth_km": GISTAR_BAND_KM,
        **morans_i(counts, weights),
    }

    return {
        "hour": hour,
        "hotspots": sorted(rows, key=lambda row: (row["score"], row["count"]), reverse=True),
        # Authoritative status metadata (issue 9): hotspot scores are a
        # statistical analysis of recorded historical incidents, not ML output.
        "analysis_mode": "STATISTICAL",
        "data_provenance": provenance,
        "statistics": statistics,
    }


def anomalies(db: Session, district: str | None = None) -> dict[str, Any]:
    firs = (
        db.query(FIR)
        .options(
            joinedload(FIR.crime_case).joinedload(CrimeCase.category),
            joinedload(FIR.crime_case).joinedload(CrimeCase.location),
            joinedload(FIR.criminal_links),
        )
        .order_by(FIR.filed_at.desc())
        .limit(30)
        .all()
    )
    rows = []
    for fir in firs:
        case = fir.crime_case
        if not case:
            continue
        if district and (not case.location or case.location.district != district):
            continue
        severity = case.category.severity if case.category else "medium"
        score = 0.45
        reasons = []
        if severity == "high":
            score += 0.22
            reasons.append("high severity category")
        if case.status == "open":
            score += 0.12
            reasons.append("open investigation")
        if case.mo_tags:
            score += min(0.16, len([tag for tag in case.mo_tags.split(",") if tag.strip()]) * 0.04)
            reasons.append("modus-operandi tags present")
        if fir.criminal_links and len(fir.criminal_links) > 1:
            score += 0.08
            reasons.append("multiple linked suspects")

        if score >= 0.62:
            label = f"{case.category.name if case.category else 'Incident'} anomaly"
            rows.append(
                {
                    "case_id": fir.fir_number,
                    "case_uuid": str(case.id),
                    "case_number": case.case_number,
                    "district": case.location.district if case.location else None,
                    "station": case.location.station if case.location else None,
                    "category": case.category.name if case.category else None,
                    "filed_at": fir.filed_at.isoformat() if fir.filed_at else None,
                    "label": label,
                    "score": round(min(score, 0.98), 2),
                    "reason": ", ".join(reasons) if reasons else "case diverges from current baseline",
                }
            )
    return {"anomalies": sorted(rows, key=lambda row: row["score"], reverse=True)}


def offender_dossiers(db: Session, district: str | None = None) -> list[dict[str, Any]]:
    # Eager-load the full FIR -> CrimeCase -> Location/Category chain in one
    # query. Without it each dossier row lazy-loads every linked FIR's case,
    # location and category over one round trip apiece — tens of seconds
    # against a remote database at scale.
    criminals = (
        db.query(Criminal)
        .options(
            joinedload(Criminal.fir_links)
            .joinedload(FIRCriminalLink.fir)
            .joinedload(FIR.crime_case)
            .joinedload(CrimeCase.location),
            joinedload(Criminal.fir_links)
            .joinedload(FIRCriminalLink.fir)
            .joinedload(FIR.crime_case)
            .joinedload(CrimeCase.category),
        )
        .all()
    )
    rows = []
    for criminal in criminals:
        firs = [link.fir for link in criminal.fir_links if link.fir]
        districts = sorted({fir.crime_case.location.district for fir in firs if fir.crime_case and fir.crime_case.location})
        if district and district not in districts:
            continue
        categories = [fir.crime_case.category.name for fir in firs if fir.crime_case and fir.crime_case.category]
        linked_count = len(firs)
        risk = min(100, 35 + linked_count * 12 + (10 if criminal.status == "at_large" else 0))
        classification = "A-CATEGORY" if risk >= 80 else "B-CATEGORY" if risk >= 60 else "WATCHLIST"
        status = "ACTIVE" if criminal.status == "at_large" else "INCARCERATED" if criminal.status in {"arrested", "convicted"} else "UNDER_SURVEILLANCE"
        rows.append(
            {
                "id": str(criminal.id),
                "name": criminal.full_name,
                "alias": criminal.aliases or criminal.full_name,
                "age": _age_from_dob(criminal.date_of_birth),
                "gender": criminal.gender or "Unknown",
                "classification": classification,
                "activeDistricts": districts,
                "status": status,
                "riskScore": risk,
                "gangAffiliation": Counter(categories).most_common(1)[0][0] if categories else "Unclassified",
                "mugshotDesc": criminal.identifying_marks or criminal.mo_summary or "No biometric descriptor recorded",
            }
        )
    return sorted(rows, key=lambda row: row["riskScore"], reverse=True)


def _resolve_network_center(
    db: Session, person_id: str
) -> tuple[str | None, uuid.UUID | None]:
    """Resolve ``person_id`` ('criminal-<uuid>' / 'victim-<uuid>' or a name)."""
    pid = (person_id or "").strip()
    if not pid:
        return None, None
    lowered = pid.lower()
    if lowered.startswith("criminal-") or lowered.startswith("victim-"):
        kind, raw = lowered.split("-", 1)
        try:
            return kind, uuid.UUID(raw)
        except ValueError:
            return None, None
    criminal = (
        db.query(Criminal)
        .filter(or_(Criminal.full_name.ilike(f"%{pid}%"), Criminal.aliases.ilike(f"%{pid}%")))
        .order_by(Criminal.created_at.desc())
        .first()
    )
    if criminal is not None:
        return "criminal", criminal.id
    victim = (
        db.query(Victim)
        .filter(Victim.full_name.ilike(f"%{pid}%"))
        .order_by(Victim.created_at.desc())
        .first()
    )
    if victim is not None:
        return "victim", victim.id
    return None, None


def _filed_at_ts(fir: Any) -> float:
    ts = getattr(fir, "filed_at", None)
    if ts is None:
        return 0.0
    try:
        return ts.timestamp()
    except Exception:
        return 0.0


def _add_graph_edge(edges: list[dict[str, str]], seen: set, source: str, target: str, rel: str) -> None:
    key = (source, target, rel)
    if key not in seen:
        seen.add(key)
        edges.append({"source": source, "target": target, "relationship": rel})


def _column_id_counts(db: Session, model: Any, column: str, ids: set) -> dict[str, int]:
    if not ids:
        return {}
    entity_col = getattr(model, column)
    rows = (
        db.query(entity_col, func.count(model.id))
        .filter(entity_col.in_(ids))
        .group_by(entity_col)
        .all()
    )
    return {str(row[0]): int(row[1]) for row in rows}


def network_person(db: Session, person_id: str, depth: int = 1) -> dict[str, Any]:
    """Build a graph strictly centered on one person (criminal or victim).

    Only the target's own linked FIRs are included: the target node, its
    co-accused criminals, its victims, and each FIR's case location. Edges are
    added only where a real FIR join exists, so unrelated recent-FIR records
    no longer leak into the view.
    """
    del depth
    kind, entity_id = _resolve_network_center(db, person_id)
    if entity_id is None:
        return {"nodes": [], "edges": []}

    if kind == "victim":
        target = (
            db.query(Victim)
            .options(
                joinedload(Victim.fir_links).joinedload(FIRVictimLink.fir)
                .joinedload(FIR.crime_case).joinedload(CrimeCase.location),
                joinedload(Victim.fir_links).joinedload(FIRVictimLink.fir)
                .joinedload(FIR.criminal_links).joinedload(FIRCriminalLink.criminal),
                joinedload(Victim.fir_links).joinedload(FIRVictimLink.fir)
                .joinedload(FIR.victim_links).joinedload(FIRVictimLink.victim),
            )
            .filter(Victim.id == entity_id)
            .first()
        )
    else:
        target = (
            db.query(Criminal)
            .options(
                joinedload(Criminal.fir_links).joinedload(FIRCriminalLink.fir)
                .joinedload(FIR.crime_case).joinedload(CrimeCase.location),
                joinedload(Criminal.fir_links).joinedload(FIRCriminalLink.fir)
                .joinedload(FIR.criminal_links).joinedload(FIRCriminalLink.criminal),
                joinedload(Criminal.fir_links).joinedload(FIRCriminalLink.fir)
                .joinedload(FIR.victim_links).joinedload(FIRVictimLink.victim),
            )
            .filter(Criminal.id == entity_id)
            .first()
        )

    if target is None:
        return {"nodes": [], "edges": []}

    firs = [link.fir for link in target.fir_links if link.fir is not None]
    firs.sort(key=_filed_at_ts, reverse=True)
    firs = firs[:15]

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    def add_node(node_id: str, **payload) -> None:
        if node_id not in nodes:
            nodes[node_id] = {"id": node_id, **payload}

    center_id = f"{kind}-{str(target.id)}"
    if kind == "criminal":
        add_node(
            center_id,
            name=target.full_name,
            category="suspect" if target.status == "at_large" else "offender",
            riskScore=min(100, 45 + len(target.fir_links) * 12),
            details=target.mo_summary or target.identifying_marks or "Linked through FIR records",
            casesCount=len(target.fir_links),
        )
    else:
        add_node(
            center_id,
            name=target.full_name,
            category="victim",
            riskScore=10,
            details=target.statement or "Victim/complainant in FIR record",
            casesCount=len(target.fir_links),
        )

    co_ids = {
        link.criminal_id
        for fir in firs
        for link in fir.criminal_links
        if link.criminal_id is not None and str(link.criminal_id) != str(target.id)
    }
    victim_ids = {
        link.victim_id
        for fir in firs
        for link in fir.victim_links
        if link.victim_id is not None and str(link.victim_id) != str(target.id)
    }
    loc_ids = {
        fir.crime_case.location_id
        for fir in firs
        if fir.crime_case is not None and fir.crime_case.location_id is not None
    }

    co_counts = _column_id_counts(db, FIRCriminalLink, "criminal_id", co_ids)
    victim_counts = _column_id_counts(db, FIRVictimLink, "victim_id", victim_ids)
    loc_counts = _column_id_counts(db, CrimeCase, "location_id", loc_ids)

    for fir in firs:
        case = fir.crime_case
        if case is not None and case.location is not None:
            loc_id = f"location-{str(case.location_id)}"
            add_node(
                loc_id,
                name=case.location.station or case.location.district,
                category="location",
                riskScore=65,
                details=f"{case.location.district} jurisdiction linked to {fir.fir_number}",
                casesCount=loc_counts.get(str(case.location_id), len(case.location.crimes)),
            )
            _add_graph_edge(edges, seen, center_id, loc_id, "Linked crime location")

        for link in fir.criminal_links:
            co = link.criminal
            if co is None or str(co.id) == str(target.id):
                continue
            co_id = f"criminal-{str(co.id)}"
            add_node(
                co_id,
                name=co.full_name,
                category="suspect" if co.status == "at_large" else "offender",
                riskScore=min(100, 45 + co_counts.get(str(co.id), len(co.fir_links)) * 12),
                details=co.mo_summary or co.identifying_marks or "Named in same FIR",
                casesCount=co_counts.get(str(co.id), len(co.fir_links)),
            )
            _add_graph_edge(edges, seen, center_id, co_id, "Named in same FIR")

        for link in fir.victim_links:
            vict = link.victim
            if vict is None or str(vict.id) == str(target.id):
                continue
            vict_id = f"victim-{str(vict.id)}"
            add_node(
                vict_id,
                name=vict.full_name,
                category="victim",
                riskScore=10,
                details=vict.statement or "Victim/complainant in FIR record",
                casesCount=victim_counts.get(str(vict.id), len(vict.fir_links)),
            )
            _add_graph_edge(edges, seen, center_id, vict_id, "Named in same FIR")

    return {"nodes": list(nodes.values()), "edges": edges}


def chat_answer(db: Session, message: str) -> dict[str, Any]:
    summary = dashboard_summary(db)
    districts = district_comparison(db)[:5]
    categories = category_breakdown(db)[:5]
    answer = (
        f"Current backend records show {summary['total_crimes']} crime cases, "
        f"{summary['open_crimes']} open cases, {summary['total_firs']} FIRs, and "
        f"{summary['resolution_rate_percent']}% resolution."
    )
    return {
        "answer": answer,
        "data": [{"query": message, "summary": summary, "top_districts": districts, "top_categories": categories}],
        "sources": ["crime_cases", "firs", "criminals", "locations", "crime_categories"],
        "chart_suggestion": "bar" if districts else None,
    }


def season_breakdown(db: Session) -> dict[str, Any]:
    rows = db.query(CrimeCase.occurred_at).all()
    season_counts: Counter[str] = Counter()
    season_by_district: dict[str, Counter[str]] = defaultdict(Counter)
    total = 0

    for (occurred_at,) in rows:
        if not occurred_at:
            continue
        season = get_season(occurred_at.month)
        season_counts[season] += 1
        total += 1

    cases_with_location = (
        db.query(CrimeCase.occurred_at, Location.district)
        .join(Location, CrimeCase.location_id == Location.id)
        .all()
    )
    for occurred_at, district in cases_with_location:
        if occurred_at and district:
            season_by_district[get_season(occurred_at.month)][district] += 1

    result = []
    for season in SEASON_ORDER:
        count = season_counts.get(season, 0)
        pct = round((count / total) * 100, 1) if total else 0.0
        top_district = ""
        if season_by_district[season]:
            top_district = season_by_district[season].most_common(1)[0][0]
        result.append({
            "season": season,
            "count": count,
            "percentage": pct,
            "top_district": top_district,
        })

    return {
        "seasons": result,
        "total_cases": total,
        "karnataka_climate_note": "Karnataka seasons: Summer (Mar-May), Monsoon (Jun-Sep), Post-Monsoon (Oct-Nov), Winter (Dec-Feb)",
    }


def _age_from_dob(date_of_birth):
    if not date_of_birth:
        return 0
    today = datetime.now().date()
    return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))



def _within_days(value, days: int) -> bool:
    if not value:
        return False
    now = datetime.now(value.tzinfo) if value.tzinfo else datetime.now()
    return value >= now - timedelta(days=days)
