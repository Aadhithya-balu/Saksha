"""Scenario 2 + 11 acceptance: dashboard endpoints return real DB-backed data.

Values are asserted against the deterministic acceptance fixture dataset —
never hardcoded production figures.
"""
import pytest

pytestmark = pytest.mark.acceptance


def test_dashboard_summary_matches_seeded_database(client, crime_dataset, analyst_headers):
    r = client.get("/api/v2/dashboard/summary", headers=analyst_headers)
    assert r.status_code == 200, r.text
    body = r.json()

    # Dataset: 3 cases (1 closed), 2 FIRs, 3 criminals.
    assert body["total_crimes"] == 3
    assert body["open_crimes"] == 2
    assert body["total_firs"] == 2
    assert body["total_criminals"] == 3
    expected_resolution = round((1 / 3) * 100, 2)
    assert body["resolution_rate_percent"] == expected_resolution


def test_dashboard_district_filter_is_database_backed(client, crime_dataset, analyst_headers):
    r = client.get(
        "/api/v2/dashboard/summary",
        params={"district": "Mysuru"},
        headers=analyst_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_crimes"] == 1  # only the DEMO Mysuru case


def test_dashboard_trends_and_breakdown_contract(client, crime_dataset, analyst_headers):
    trends = client.get("/api/v2/dashboard/crime-trends", headers=analyst_headers)
    assert trends.status_code == 200
    trend_rows = trends.json()
    assert isinstance(trend_rows, list) and len(trend_rows) >= 2
    for row in trend_rows:
        assert set(row) == {"date", "count", "solved"}
        assert isinstance(row["count"], int)
        assert isinstance(row["solved"], int)
        assert 0 <= row["solved"] <= row["count"]

    breakdown = client.get("/api/v2/dashboard/category-breakdown", headers=analyst_headers)
    assert breakdown.status_code == 200
    cats = {row["category"]: row["count"] for row in breakdown.json()}
    assert cats.get("Theft & Burglaries") == 2
    assert cats.get("Assault") == 1

    districts = client.get("/api/v2/dashboard/district-comparison", headers=analyst_headers)
    assert districts.status_code == 200
    district_rows = {row["district"]: row["count"] for row in districts.json()}
    assert district_rows["Bengaluru Urban"] == 2
    assert district_rows["Mysuru"] == 1


def test_dashboard_date_range_filters_work(client, crime_dataset, analyst_headers):
    r = client.get(
        "/api/v2/dashboard/summary",
        params={
            "date_from": "2026-06-01T00:00:00Z",
            "date_to": "2026-06-30T23:59:59Z",
        },
        headers=analyst_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_crimes"] == 1  # only CR-ACC-0001 occurred in June 2026
    assert body["total_firs"] == 1


def test_dashboard_recent_incidents_reference_real_cases(client, crime_dataset, analyst_headers):
    r = client.get("/api/v2/dashboard/recent-incidents", headers=analyst_headers)
    assert r.status_code == 200
    incidents = r.json()
    assert isinstance(incidents, list) and len(incidents) == 3
    numbers = {i["case_number"] for i in incidents}
    assert numbers == {"CR-ACC-0001", "CR-ACC-0002", "CR-ACC-DEMO-0003"}
    for incident in incidents:
        assert {"case_number", "crime_type", "location", "time", "status", "priority"} <= set(incident)


def test_unauthenticated_dashboard_request_rejected(client):
    r = client.get("/api/v2/dashboard/summary")
    assert r.status_code == 401


def test_dashboard_empty_state_for_authenticated_user(client, analyst_headers):
    r = client.get("/api/v2/dashboard/summary", headers=analyst_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_crimes"] == 0
    assert body["total_firs"] == 0
    assert body["total_criminals"] == 0
    assert body["resolution_rate_percent"] == 0.0

    incidents = client.get("/api/v2/dashboard/recent-incidents", headers=analyst_headers).json()
    assert incidents == []


def test_dashboard_malformed_parameters_rejected(client, crime_dataset, analyst_headers):
    bad_date = client.get(
        "/api/v2/dashboard/summary",
        params={"date_from": "not-a-date"},
        headers=analyst_headers,
    )
    assert bad_date.status_code == 422
    # Controlled error schema (FastAPI validation detail), no stack trace.
    assert "detail" in bad_date.json()


def test_demo_provenance_visible_through_case_listing(client, crime_dataset, analyst_headers):
    """Scenario 11: DEMO provenance survives DB -> service -> API boundary.

    The case registry itself does not expose provenance fields; the lineage
    API is the authoritative provenance boundary for production records.
    """
    cases = client.get(
        "/api/v2/crime-cases",
        params={"page_size": 50},
        headers=analyst_headers,
    )
    assert cases.status_code == 200
    payload = cases.json()
    results = payload.get("results") or payload.get("items") or payload
    by_number = {c["case_number"]: c for c in results}
    assert "CR-ACC-DEMO-0003" in by_number

    base = "/api/v2/data-import/lineage/crime_cases"
    demo = client.get(f"{base}/{by_number['CR-ACC-DEMO-0003']['id']}", headers=analyst_headers)
    assert demo.status_code == 200, demo.text
    demo_body = demo.json()
    assert demo_body["dataset_provenance"] == "demo"

    live = client.get(f"{base}/{by_number['CR-ACC-0001']['id']}", headers=analyst_headers)
    assert live.status_code == 200
    live_body = live.json()
    assert live_body["dataset_provenance"] != "demo"


def test_crime_case_insights_are_database_backed(client, crime_dataset, analyst_headers):
    """Crime Insights telemetry is computed from the whole DB dataset."""
    r = client.get("/api/v2/crime-cases/insights", headers=analyst_headers)
    assert r.status_code == 200, r.text
    body = r.json()

    # Dataset: 3 cases (2 open, 1 closed).
    assert body["total_cases"] == 3
    assert body["open"] == 2
    assert body["closed"] == 1
    assert body["investigating"] == 0
    assert body["charge_sheet"] == 0
    # Priority counts: 1 high (CR-ACC-0001), 2 medium (0002 + DEMO default), 0 critical/low.
    assert body["high"] == 1
    assert body["medium"] == 2
    assert body["critical"] == 0
    assert body["low"] == 0
    assert body["clearance_rate"] == round((1 / 3) * 100)

    # District filter narrows to the single Mysuru case.
    filtered = client.get(
        "/api/v2/crime-cases/insights",
        params={"district": "Mysuru"},
        headers=analyst_headers,
    )
    assert filtered.status_code == 200
    assert filtered.json()["total_cases"] == 1

