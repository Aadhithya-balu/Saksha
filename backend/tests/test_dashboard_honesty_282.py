"""Issue #282 honesty pass: dashboard endpoints never fabricate values.

Covers the derived/analytic envelope contracts introduced here:
- officer-stats exposes real counts only (no invented on_duty/off_duty split)
- forecast returns a real trailing-14-day series with an honest
  available/reason envelope instead of seeded numbers
- risk-prediction is rule-based (RULE-SQL-V2) with sample-derived confidence
  and a fully-null unavailable envelope for an empty database
- summary exposes resolved/investigating counters
- recent-incidents returns real ids/districts with nullable optional fields
"""
from datetime import datetime, timedelta

from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.location import Location
from app.models.officer import Officer
from app.services.dashboard.dashboard_service import (
    get_filtered_summary,
    get_forecast_data,
    get_officer_stats,
    get_recent_incidents,
    get_risk_prediction,
)


def _category(db_session, name: str = "Theft & Burglaries") -> CrimeCategory:
    cat = db_session.query(CrimeCategory).filter_by(name=name).first()
    if cat is None:
        cat = CrimeCategory(name=name, section_code="IPC 379", severity="high")
        db_session.add(cat)
        db_session.flush()
    return cat


def _location(db_session, district: str = "Bengaluru Urban") -> Location:
    loc = db_session.query(Location).filter_by(district=district).first()
    if loc is None:
        loc = Location(district=district, station="Whitefield", latitude=12.96, longitude=77.72)
        db_session.add(loc)
        db_session.flush()
    return loc


def _officer(db_session, badge: str = "HON-282-1") -> Officer:
    officer = Officer(
        badge_number=badge,
        name="Honesty Inspector",
        rank="Inspector",
        station="Whitefield",
        district="Bengaluru Urban",
        status="active",
    )
    db_session.add(officer)
    db_session.flush()
    return officer


def _case(db_session, number: str, occurred_at: datetime, status: str = "open", **kw) -> CrimeCase:
    case = CrimeCase(
        case_number=number,
        category_id=_category(db_session).id,
        location_id=_location(db_session).id,
        occurred_at=occurred_at,
        status=status,
        **kw,
    )
    db_session.add(case)
    db_session.flush()
    return case


# ---------------------------------------------------------------------------
# Officer stats
# ---------------------------------------------------------------------------


def test_officer_stats_expose_real_counts_only(db_session):
    _officer(db_session)
    stats = get_officer_stats(db_session)
    assert set(stats) == {"total_officers", "active_officers", "investigating_officers"}
    # Nothing may be derived from several cases again (regression guard):
    assert "on_duty" not in stats and "off_duty" not in stats


def test_officer_stats_empty_database(db_session):
    stats = get_officer_stats(db_session)
    assert stats["total_officers"] == 0
    assert stats["active_officers"] == 0
    assert stats["investigating_officers"] == 0


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------


def test_forecast_empty_database_is_honestly_unavailable(db_session):
    data = get_forecast_data(db_session)
    assert data["available"] is False
    assert data["reason"] == "insufficient historical data"
    assert data["next_day_forecast"] is None
    assert data["next_week_forecast"] is None
    assert data["sample_size"] == 0
    # Series is the real trailing 14 calendar days — empty means zeros, never placeholders.
    assert len(data["series"]) == 14
    assert all(p["type"] in {"historical", "today"} for p in data["series"])
    assert all(p["value"] == 0 for p in data["series"])


def test_forecast_with_low_volume_stays_unavailable(db_session):
    now = datetime.utcnow()
    for i in range(10):
        _case(db_session, f"CR-HON-LOW-{i}", now - timedelta(days=i))
    db_session.commit()

    data = get_forecast_data(db_session)
    assert data["available"] is False
    assert data["reason"] == "insufficient historical data"
    assert data["next_day_forecast"] is None
    assert data["sample_size"] == 10
    # Values must be genuine per-day counts summing to the seeded rows.
    assert sum(p["value"] for p in data["series"]) == 10


def test_forecast_series_is_database_backed_counts(db_session):
    now = datetime.utcnow()
    today = f"{now.date().isoformat()}"
    _case(db_session, "CR-HON-T-1", now)
    _case(db_session, "CR-HON-T-2", now - timedelta(hours=1))
    _case(db_session, "CR-HON-Y-1", now - timedelta(days=1))
    db_session.commit()

    data = get_forecast_data(db_session)
    by_day = {p["day"]: p["value"] for p in data["series"]}
    assert by_day[today] == 2
    assert by_day[(now - timedelta(days=1)).date().isoformat()] == 1
    # The most recent active day is the "today" anchor type.
    today_points = [p for p in data["series"] if p["type"] == "today"]
    assert today_points and today_points[0]["day"] == today
    assert data["sample_size"] == 3


# ---------------------------------------------------------------------------
# Risk prediction
# ---------------------------------------------------------------------------


def test_risk_prediction_empty_database_is_honestly_unavailable(db_session):
    pred = get_risk_prediction(db_session)
    assert pred["available"] is False
    assert pred["method"] == "rule-based"
    assert pred["method_version"] == "RULE-SQL-V2"
    assert pred["sample_size"] == 0
    for nullable in ("crime_risk_percent", "threat_level", "trend", "confidence_score"):
        assert pred[nullable] is None


def test_risk_prediction_confidence_is_sample_derived(db_session):
    now = datetime.utcnow()
    cases = {"open": 2, "closed": 1}
    for status, count in cases.items():
        for i in range(count):
            _case(db_session, f"CR-HON-RISK-{status}-{i}", now - timedelta(days=i), status=status)
    db_session.commit()

    pred = get_risk_prediction(db_session)
    assert pred["available"] is True
    assert pred["method_version"] == "RULE-SQL-V2"
    assert pred["sample_size"] == 3
    # deterministic confidence = min(1.0, 3/100) rounded to 2dp.
    assert pred["confidence_score"] == 0.03
    assert pred["crime_risk_percent"] is not None
    assert pred["threat_level"] in {"Low", "Medium", "High", "Critical"}


# ---------------------------------------------------------------------------
# Summary + recent incidents
# ---------------------------------------------------------------------------


def test_summary_exposes_resolved_and_investigating_counts(db_session):
    now = datetime.utcnow()
    _case(db_session, "CR-HON-S-1", now, status="closed")
    _case(db_session, "CR-HON-S-2", now - timedelta(days=1), status="open")
    _case(db_session, "CR-HON-S-3", now - timedelta(days=2), status="open")
    db_session.commit()

    summary = get_filtered_summary(db_session)
    assert summary["total_crimes"] == 3
    assert summary["resolved_crimes"] == 1
    assert summary["investigating_crimes"] == 0
    assert summary["open_crimes"] == 2


def test_recent_incidents_carry_real_ids_and_nullable_fields(db_session):
    now = datetime.utcnow()
    place = _location(db_session, "Mysuru")
    cat = _category(db_session)
    no_priority = CrimeCase(
        case_number="CR-HON-RI-1",
        category_id=cat.id,
        location_id=place.id,
        occurred_at=now,
        status="open",
        priority="high",
    )
    db_session.add(no_priority)
    db_session.commit()
    # Explicit NULL must survive to the API verbatim (no ORM default re-fire).
    no_priority.priority = None
    db_session.commit()

    incidents = get_recent_incidents(db_session, limit=5)
    assert len(incidents) == 1
    inc = incidents[0]
    assert inc["id"] == str(no_priority.id)
    assert inc["case_number"] == "CR-HON-RI-1"
    assert inc["district"] == "Mysuru"
    assert inc["priority"] is None
    assert inc["status"] == "open"
    assert set(inc) >= {"id", "case_number", "crime_type", "location", "time", "status", "priority", "district"}