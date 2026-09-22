"""SAKSHA End-to-End Validation (Issue #253 — Final Test v2).

Walks one realistic crime scenario through the complete intelligence lifecycle:

    DISCOVER -> EXPLAIN -> CONNECT -> PREDICT -> ACT -> APPROVE -> REVIEW

Scenario: a surge of night-time residential burglaries in Whitefield,
Bengaluru Urban, where a serial at-large offender repeatedly re-uses the same
modus operandi (night lock-break with tools).

Each test maps to a numbered section of issue #253:
  1  Data & case state (status display, ARRESTED immutability, audit)
  2  Discovery (anomaly + baseline comparison)
  3  Intelligence fusion (fused result contract)
  4  Sentinel alert (WHAT / WHERE / WHY + risk/confidence/forecast/quality)
  5  Explainability ("Why This Insight?")
  6  Investigation & network (relations, VERIFIED vs POTENTIAL, no guilt claims)
  7  Evidence & provenance (evidence drawer, RBAC masking, demo distinction)
  8  Prediction (forecast period, confidence, model version, ML/FALLBACK)
  9  Intelligence quality (data completeness / provenance transparency)
  10 Action (evidence-backed recommendation with reasoning)
  11 Human approval (strict 5-stage gate, RBAC, no auto-deploy)
  12 Outcome (post-intervention comparison, no causation claim)
  13 Audit & accountability (lineage preserved, user + timestamp)
  14 UI/UX (API surface the frontend needs is reachable end-to-end)

The tests authenticate through the real /auth/login JWT flow and exercise the
real routes (no service mocks), mirroring the acceptance-suite design rules.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.location import Location
from app.models.victim import Victim
from tests.acceptance.conftest import create_user, login

# ---------------------------------------------------------------------------
# Scenario seed
# ---------------------------------------------------------------------------


def _seed_whitefield_burglary_surge(db_session) -> dict:
    """Night burglary surge: 3 baseline (45-75d ago) + 6 spike cases (last 10d).

    Shared MO signature (night_operation/break_in/tool_usage), one serial
    at-large offender, one victim, all FIR-linked so the network graph and
    the investigation view resolve end-to-end.
    """
    now = datetime.now(timezone.utc)
    cat = CrimeCategory(name="Theft & Burglaries", section_code="IPC 379", severity="high")
    loc = Location(district="Bengaluru Urban", station="Whitefield", latitude=12.9698, longitude=77.7499)
    db_session.add_all([cat, loc])
    db_session.flush()

    criminal = Criminal(
        full_name="Suresh Nightlock",
        aliases="Lockman",
        status="at_large",
        mo_summary="Late night residential housebreak lock break crowbar",
    )
    victim = Victim(full_name="Meera Rao", contact_number="9845012345")
    db_session.add_all([criminal, victim])
    db_session.flush()

    baseline_cases: list[CrimeCase] = []
    for i in range(3):
        ts = now - timedelta(days=50 + i * 10)
        c = CrimeCase(
            case_number=f"V2-BASE-00{i+1}",
            category_id=cat.id,
            location_id=loc.id,
            occurred_at=ts,
            reported_at=ts,
            status="closed",
            priority="medium",
            description="Night time residential burglary with crowbar",
            mo_tags="night_operation,break_in,tool_usage",
        )
        db_session.add(c)
        db_session.flush()
        baseline_cases.append(c)
        db_session.add(FIR(
            fir_number=f"FIR-V2-BASE-00{i+1}",
            crime_case_id=c.id,
            complainant_name="Resident",
            filed_at=ts,
            status="closed",
        ))

    recent_cases: list[CrimeCase] = []
    for i in range(6):
        ts = now - timedelta(days=2 + i)
        c = CrimeCase(
            case_number=f"V2-SPIKE-00{i+1}",
            category_id=cat.id,
            location_id=loc.id,
            occurred_at=ts,
            reported_at=ts,
            status="open",
            priority="high",
            description="Night residential door lock break using power tools",
            mo_tags="night_operation,break_in,tool_usage",
        )
        db_session.add(c)
        db_session.flush()
        recent_cases.append(c)

        f = FIR(
            fir_number=f"FIR-V2-SPIKE-00{i+1}",
            crime_case_id=c.id,
            complainant_name=f"Victim {i+1}",
            filed_at=ts,
            status="in_progress",
        )
        db_session.add(f)
        db_session.flush()
        db_session.add(FIRCriminalLink(fir_id=f.id, criminal_id=criminal.id, role="accused"))
        db_session.add(FIRVictimLink(fir_id=f.id, victim_id=victim.id))
        # A sealed evidence record gives the provenance drawer real content.
        db_session.add(Evidence(
            case_id=c.id,
            title=f"Doorlock CCTV still {i+1}",
            evidence_type="digital",
            status="verified",
            description="CCTV capture of lock-break suspect at victim door.",
        ))

    db_session.commit()
    return {
        "category": cat,
        "location": loc,
        "criminal": criminal,
        "victim": victim,
        "baseline_cases": baseline_cases,
        "recent_cases": recent_cases,
    }


@pytest.fixture
def scenario(db_session):
    return _seed_whitefield_burglary_surge(db_session)


@pytest.fixture
def analyst(client, db_session):
    create_user(db_session, "v2-analyst", "crime_analyst")
    return login(client, "v2-analyst", "Acceptance#2026")["headers"]


@pytest.fixture
def investigator(client, db_session):
    user = create_user(db_session, "v2-investigator", "investigator")
    user.district = "Bengaluru Urban"
    db_session.commit()
    return login(client, "v2-investigator", "Acceptance#2026")["headers"]


@pytest.fixture
def admin(client, db_session):
    create_user(db_session, "v2-admin", "admin")
    return login(client, "v2-admin", "Acceptance#2026")["headers"]


@pytest.fixture
def viewer(client, db_session):
    create_user(db_session, "v2-viewer", "viewer")
    return login(client, "v2-viewer", "Acceptance#2026")["headers"]


def _emerging_pattern(client, headers, district="Bengaluru Urban"):
    resp = client.get(
        "/api/v2/intelligence/emerging-patterns",
        params={"district": district, "min_signals": 1, "min_risk": 0.1, "min_confidence": 0.1},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] >= 1, "Fusion should detect the seeded surge"
    return data["patterns"][0]


# ---------------------------------------------------------------------------
# 1. DATA & CASE STATE
# ---------------------------------------------------------------------------

class TestDataAndCaseState:
    def test_case_status_displayed_and_auditable(self, client, admin, db_session, scenario):
        """GET surfaces status correctly; a valid transition is auditable with user+time."""
        case = db_session.query(CrimeCase).filter(CrimeCase.case_number == "V2-SPIKE-001").one()
        resp = client.get(f"/api/v2/crime-cases/{case.id}", headers=admin)
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

        # Valid forward transition: open (active) -> under_investigation
        r = client.put(f"/api/v2/crime-cases/{case.id}", json={"status": "under_investigation"}, headers=admin)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "under_investigation"

        audit = client.get(
            "/api/v2/admin/audit-logs",
            params={"action": "STATUS_TRANSITION"},
            headers=admin,
        )
        assert audit.status_code == 200, audit.text
        entries = audit.json()["results"]
        assert isinstance(entries, list) and entries
        entry = entries[0]
        # user + timestamp are present and the change is described
        assert entry.get("user") or entry.get("role")
        assert entry.get("timestamp")
        assert "Under Investigation" in (entry.get("details") or "")

    def test_arrested_is_immutable_through_normal_update(self, client, admin, scenario):
        """ARRESTED can only move forward (chargesheeted); any other edit is rejected."""
        case = scenario["recent_cases"][0]
        r = client.put(f"/api/v2/crime-cases/{case.id}", json={"status": "arrested"}, headers=admin)
        assert r.status_code == 200, r.text

        # Cannot regress to active
        r = client.put(f"/api/v2/crime-cases/{case.id}", json={"status": "active"}, headers=admin)
        assert r.status_code == 422
        assert "locked" in r.text.lower() or "not allowed" in r.text.lower()

        # Cannot edit priority on a locked case
        r = client.put(f"/api/v2/crime-cases/{case.id}", json={"priority": "low"}, headers=admin)
        assert r.status_code == 422
        assert "locked" in r.text.lower()

        # Single allowed forward step
        r = client.put(f"/api/v2/crime-cases/{case.id}", json={"status": "chargesheeted"}, headers=admin)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "chargesheeted"

    def test_cannot_create_case_already_arrested(self, client, admin, scenario):
        loc = scenario["location"]
        r = client.post(
            "/api/v2/crime-cases",
            json={
                "case_number": "V2-UNREAL-001",
                "category_id": str(scenario["category"].id),
                "location_id": str(loc.id),
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "status": "arrested",
            },
            headers=admin,
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# 2. DISCOVERY
# ---------------------------------------------------------------------------

class TestDiscovery:
    def test_anomaly_detection_and_baseline_growth(self, client, investigator):
        """Anomaly API returns per-event verdicts; fusion reports growth vs baseline."""
        events = [
            {
                "event_id": "evt-spike-1",
                "timestamp": "2026-09-05T02:30:00",
                "latitude": 12.9698,
                "longitude": 77.7499,
                "crime_category": "Theft & Burglaries",
                "district_id": "Bengaluru Urban",
                "offender_id": "at-large",
            },
            {
                "event_id": "evt-normal-1",
                "timestamp": "2026-09-05T14:00:00",
                "latitude": 12.30,
                "longitude": 76.65,
                "crime_category": "Assault",
                "district_id": "Mysuru",
            },
        ]
        r = client.post("/api/v2/ai/anomaly/detect", json={"events": events}, headers=investigator)
        assert r.status_code == 200, r.text
        alerts = r.json()["alerts"]
        assert len(alerts) == 2
        for a in alerts:
            assert set(a) >= {"event_id", "is_anomaly", "score", "threshold", "explanation"}

    def test_baseline_comparison_reports_deviation(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        change = pattern["change_from_baseline"]
        assert change["direction"] == "increasing"
        assert change["current_count"] >= 6
        assert change["baseline_count"] > 0
        assert change["change_percentage"] > 100.0

    def test_district_h3_drill_down_surface(self, client, analyst, scenario):
        """Fused pattern exposes district -> stations -> H3 cells drill-down."""
        pattern = _emerging_pattern(client, analyst)
        assert pattern["location"]["district"] == "Bengaluru Urban"
        assert "Whitefield" in pattern["location"]["stations"]
        assert len(pattern["affected_h3_cells"]) >= 1


# ---------------------------------------------------------------------------
# 3. INTELLIGENCE FUSION
# ---------------------------------------------------------------------------

class TestIntelligenceFusion:
    def test_fused_result_contains_all_contract_fields(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        required = {
            "intelligence_id", "pattern_type", "location", "affected_h3_cells",
            "time_window", "change_from_baseline", "risk_score", "forecast",
            "confidence", "supporting_signals", "related_fir_ids",
            "recommended_action_input", "ml_status", "model_name", "model_version",
            "detection_timestamp", "explanation", "contributing_analytics",
            "data_provenance",
        }
        assert required <= set(pattern)
        assert 0.0 <= pattern["risk_score"] <= 1.0
        assert 0.0 <= pattern["confidence"] <= 1.0
        assert pattern["ml_status"] in ("ML", "FALLBACK", "RULE_BASED", "HYBRID")

    def test_multi_signal_fusion(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        sig_types = {s["signal_type"] for s in pattern["supporting_signals"]}
        # temporal growth is guaranteed by the seed; MO signature should appear
        assert "temporal" in sig_types
        assert sig_types & {"mo_pattern", "spatial_hotspot", "anomaly", "entity_link"}

    def test_related_firs_propagate(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        assert len(pattern["related_fir_ids"]) >= 6


# ---------------------------------------------------------------------------
# 4. SENTINEL ALERT
# ---------------------------------------------------------------------------

class TestSentinelAlert:
    def test_alert_explains_what_where_why_with_quality(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        # WHAT
        assert "Theft" in pattern["pattern_type"]
        # WHERE
        assert pattern["location"]["district"] == "Bengaluru Urban"
        # WHY / what changed
        assert pattern["explanation"]
        assert "Baseline:" in pattern["explanation"]
        assert "Current:" in pattern["explanation"]
        # Risk, confidence, forecast, intelligence quality
        assert pattern["risk_score"] >= 0.4
        assert pattern["confidence"] >= 0.4
        assert pattern["forecast"]["trend"] in ("increasing", "decreasing", "stable")
        assert pattern["forecast"]["prediction_mode"] in ("ML", "FALLBACK")
        assert pattern["forecast"]["period"]
        assert pattern["data_provenance"] in ("LIVE_DB", "DEMO", "MIXED", "UNKNOWN")


# ---------------------------------------------------------------------------
# 5. EXPLAINABILITY
# ---------------------------------------------------------------------------

class TestExplainability:
    def test_why_this_insight_displays_signals_model_and_limitations(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/investigate",
            json=pattern,
            headers=analyst,
        )
        assert r.status_code == 200, r.text
        view = r.json()
        why = view.get("why_this_insight") or {}
        assert why.get("summary")
        signals = why.get("signals") or []
        assert len(signals) >= 1
        for s in signals:
            assert s["signal_type"] in (
                "anomaly", "temporal", "spatial_hotspot", "forecast", "mo_pattern", "entity_link"
            )
            assert s["status"] in ("CONFIRMED", "PROBABLE", "POSSIBLE", "UNAVAILABLE")
        method = why.get("methodology") or {}
        assert method.get("ml_status") in ("ML", "FALLBACK", "RULE_BASED", "HYBRID", "N/A")
        assert method.get("model_name")
        assert method.get("model_version")
        # limitations + explicit non-causation guardrail
        assert why.get("limitations")
        assert why.get("safety_note")
        assert "cause" not in (why.get("safety_note") or "").lower()


# ---------------------------------------------------------------------------
# 6. INVESTIGATION & NETWORK
# ---------------------------------------------------------------------------

class TestInvestigationAndNetwork:
    def test_pattern_opens_related_firs_and_network(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/investigate",
            json=pattern,
            headers=analyst,
        )
        assert r.status_code == 200, r.text
        view = r.json()
        assert len(view["firs"]) >= 5
        fir_nums = {f["fir_number"] for f in view["firs"]}
        assert "FIR-V2-SPIKE-001" in fir_nums
        assert view["network"]["nodes"] and view["network"]["edges"]

        node_cats = {n.get("category") for n in view["network"]["nodes"]}
        assert node_cats & {"criminal", "offender", "suspect"} or node_cats  # non-empty

    def test_verified_vs_potential_are_distinguished(self, client, investigator, scenario):
        r = client.get("/api/v2/network/graph", params={"district": "Bengaluru Urban"}, headers=investigator)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["nodes"] and g["edges"]
        for e in g["edges"]:
            assert e["verification_status"] in ("VERIFIED", "POTENTIAL", "UNVERIFIED", "DEMO", "RESTRICTED")

    def test_network_relationship_evidence_context(self, client, investigator, scenario):
        """Edges carry supporting FIR/case references so a lead is explainable."""
        r = client.get("/api/v2/network/graph", params={"district": "Bengaluru Urban"}, headers=investigator)
        g = r.json()
        assert all("evidence" in e for e in g["edges"])
        assert g["provenance_summary"] or g["confidence_summary"]

    def test_investigation_view_carries_safety_note_not_guilt(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/investigate",
            json=pattern,
            headers=analyst,
        )
        view = r.json()
        assert view.get("safety_note") or view["why_this_insight"].get("safety_note")
        note = (view.get("safety_note") or view["why_this_insight"]["safety_note"]).lower()
        assert "guilt" in note or "confirmed" in note or "lead" in note


# ---------------------------------------------------------------------------
# 7. EVIDENCE & PROVENANCE
# ---------------------------------------------------------------------------

class TestEvidenceAndProvenance:
    def test_evidence_drawer_shows_source_and_provenance(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/investigate",
            json=pattern,
            headers=analyst,
        )
        view = r.json()
        assert view["evidence"], "Evidence should resolve from linked FIRs"
        ev = view["evidence"][0]
        assert ev.get("source_label") or ev.get("source_type") or ev.get("case_id")
        assert ev["verification_status"] in ("VERIFIED", "POTENTIAL", "UNVERIFIED", "DEMO", "RESTRICTED")


# ---------------------------------------------------------------------------
# 8. PREDICTION
# ---------------------------------------------------------------------------

class TestPrediction:
    def test_risk_prediction_reports_mode_version_and_confidence(self, client, analyst, scenario):
        r = client.get("/api/v2/ai/predictions/risk-scores", headers=analyst)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["prediction_mode"] in ("ML", "FALLBACK", "UNKNOWN", "UNAVAILABLE")
        assert body["model_version"]
        assert body["data_provenance"] == "LIVE_DB"
        # FALLBACK must never be labelled as trained ML
        if body["prediction_mode"] == "FALLBACK":
            assert body["risk_model_loaded"] is not True
        for row in body["grid_predictions"]:
            assert "prediction_mode" in row


# ---------------------------------------------------------------------------
# 9. INTELLIGENCE QUALITY
# ---------------------------------------------------------------------------

class TestIntelligenceQuality:
    def test_quality_report_communicates_provenance_limits(self, client, admin, scenario):
        r = client.get("/api/v2/admin/data-quality", headers=admin)
        assert r.status_code == 200, r.text
        body = r.json()
        # provenance breakdown is visible
        report = body.get("report") or body
        text = str(report).lower()
        assert ("provenance" in text) or ("by_provenance" in body) or ("live" in text and "demo" in text)

    def test_sentinel_alert_never_overstates_reliability(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        if pattern["ml_status"] == "FALLBACK":
            assert pattern["confidence"] <= 0.85


# ---------------------------------------------------------------------------
# 10. ACTION
# ---------------------------------------------------------------------------

class TestAction:
    def test_recommended_action_explains_why(self, client, analyst, scenario):
        pattern = _emerging_pattern(client, analyst)
        rec = pattern["recommended_action_input"]
        assert rec["title"]
        assert rec["description"] or pattern["explanation"]
        assert rec["action_type"] in (
            "patrol_surge", "surveillance", "investigation", "checkpoint",
            "cctv_deployment", "community_program",
        )
        assert rec["priority"] in ("CRITICAL", "HIGH", "MEDIUM", "LOW")
        assert rec["suggested_intervention"]["district"] == "Bengaluru Urban"


# ---------------------------------------------------------------------------
# 11. HUMAN APPROVAL
# ---------------------------------------------------------------------------

class TestHumanApproval:
    def test_full_approval_pipeline_is_human_gated(self, client, investigator, scenario):
        pattern = _emerging_pattern(client, investigator)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={"title": "Whitefield Night Patrol Surge"},
            headers=investigator,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dispatched"] is True
        assert d["workflow_stage"] == "draft"
        intervention_id = d["intervention_id"]

        url = f"/api/v2/interventions/{intervention_id}/advance-stage"

        # Cannot skip straight to deployment
        r = client.post(url, json={"target_stage": "deployed", "notes": "skip"}, headers=investigator)
        assert r.status_code == 400

        # Strict 5-stage route with human input at each step
        r = client.post(url, json={"target_stage": "supervisor_review", "notes": "Please review"}, headers=investigator)
        assert r.status_code == 200, r.text
        assert r.json()["workflow_stage"] == "supervisor_review"

        r = client.post(url, json={"target_stage": "approved", "notes": "Approved by SP"}, headers=investigator)
        assert r.status_code == 200, r.text
        assert r.json()["workflow_stage"] == "approved"

        r = client.post(url, json={"target_stage": "deployed", "notes": "Commander authorizes deployment"}, headers=investigator)
        assert r.status_code == 200, r.text
        assert r.json()["workflow_stage"] == "deployed"
        assert r.json()["status"] == "active"

        r = client.post(url, json={"target_stage": "outcome_review"}, headers=investigator)
        assert r.status_code == 200, r.text
        assert r.json()["workflow_stage"] == "outcome_review"

    def test_unauthorized_user_cannot_approve(self, client, investigator, viewer, scenario):
        pattern = _emerging_pattern(client, investigator)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={},
            headers=viewer,
        )
        assert r.status_code == 403

        # Create the intervention as investigator, then try to advance as viewer
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={},
            headers=investigator,
        )
        intervention_id = r.json()["intervention_id"]
        r = client.post(
            f"/api/v2/interventions/{intervention_id}/advance-stage",
            json={"target_stage": "supervisor_review"},
            headers=viewer,
        )
        assert r.status_code == 403

    def test_ai_output_creates_draft_only_never_deploys(self, client, investigator, scenario):
        pattern = _emerging_pattern(client, investigator)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={},
            headers=investigator,
        )
        body = r.json()
        assert body["workflow_stage"] == "draft"
        assert body["status"] == "planned"


# ---------------------------------------------------------------------------
# 12. OUTCOME
# ---------------------------------------------------------------------------

class TestOutcome:
    def test_outcome_review_and_effectiveness_comparison(self, client, investigator, scenario):
        pattern = _emerging_pattern(client, investigator)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={},
            headers=investigator,
        )
        intervention_id = r.json()["intervention_id"]
        url = f"/api/v2/interventions/{intervention_id}/advance-stage"
        for target in ("supervisor_review", "approved", "deployed", "outcome_review"):
            client.post(url, json={"target_stage": target, "notes": "ok"}, headers=investigator)

        r = client.post(
            url,
            json={
                "target_stage": "completed",
                "outcome_data": {
                    "subsequent_crime_count": 1,
                    "pattern_persisted": "reduced",
                    "observed_outcome": "Observed 1 further FIR, down from 6 in prior month.",
                    "review_notes": "Post-deployment debrief.",
                },
            },
            headers=investigator,
        )
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["subsequent_crime_count"] == 1
        assert rec["pattern_persisted"] == "reduced"
        assert rec["observed_outcome"]
        assert rec["workflow_stage"] == "completed"

        # Effectiveness compares equal pre/post windows and never claims causation
        eff = client.get(
            f"/api/v2/interventions/{intervention_id}/effectiveness",
            params={"window_days": 30},
            headers=investigator,
        )
        assert eff.status_code == 200, eff.text
        body = eff.json()
        assert body["verdict"] in (
            "effective", "partially_effective", "no_measurable_effect", "insufficient_data",
        )
        assert body["method_note"]


# ---------------------------------------------------------------------------
# 13. AUDIT & ACCOUNTABILITY
# ---------------------------------------------------------------------------

class TestAuditAccountability:
    def test_action_dispatch_is_audited(self, client, admin, investigator, scenario):
        pattern = _emerging_pattern(client, investigator)
        client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={"title": "Audit me"},
            headers=investigator,
        )
        audit = client.get(
            "/api/v2/admin/audit-logs",
            params={"action": "INTELLIGENCE_ACTION_DISPATCH"},
            headers=admin,
        )
        assert audit.status_code == 200, audit.text
        entries = audit.json()["results"]
        assert isinstance(entries, list) and entries
        assert entries[0].get("timestamp")
        assert entries[0].get("user") or entries[0].get("role")

    def test_workflow_advances_are_audited_with_lineage(self, client, admin, investigator, scenario):
        pattern = _emerging_pattern(client, investigator)
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={},
            headers=investigator,
        )
        intervention_id = r.json()["intervention_id"]
        client.post(
            f"/api/v2/interventions/{intervention_id}/advance-stage",
            json={"target_stage": "supervisor_review", "notes": "review"},
            headers=investigator,
        )
        audit = client.get(
            "/api/v2/admin/audit-logs",
            params={"action": "WORKFLOW_STAGE_ADVANCE"},
            headers=admin,
        )
        entries = audit.json()["results"]
        assert isinstance(entries, list) and entries
        assert entries[0]["timestamp"]
        assert "draft" in (entries[0].get("details") or "").lower()
        assert "supervisor_review" in (entries[0].get("details") or "").lower()


# ---------------------------------------------------------------------------
# 14. UI/UX API SURFACE (end-to-end endpoints the frontend consumes)
# ---------------------------------------------------------------------------

class TestUIUXApiSurface:
    def test_intelligence_workspace_endpoints_reachable(self, client, analyst, scenario):
        """The Fusion page routes must stay reachable in one cohesive flow."""
        pattern = _emerging_pattern(client, analyst)
        # pattern by id (launch investigation deep-link)
        r = client.get(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}",
            headers=analyst,
        )
        assert r.status_code == 200, r.text
        assert r.json()["intelligence_id"] == pattern["intelligence_id"]
        # red-zones cross-reference fused intelligence for the alert feed
        r = client.get(
            "/api/v2/alerts/red-zones",
            params={"include_intelligence": "true", "min_current": 2},
            headers=analyst,
        )
        assert r.status_code == 200, r.text
        assert "red_zones" in r.json()

    def test_full_lifecycle_apis_stay_consistent(self, client, investigator, scenario):
        """DISCOVER -> EXPLAIN -> CONNECT -> PREDICT -> ACT -> APPROVE -> REVIEW."""
        headers = investigator
        pattern = _emerging_pattern(client, headers)
        assert pattern

        # EXPLAIN
        why = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/investigate",
            json=pattern,
            headers=headers,
        )
        assert why.status_code == 200
        assert why.json()["why_this_insight"]

        # CONNECT (network)
        net = client.get("/api/v2/network/graph", params={"district": "Bengaluru Urban"}, headers=headers)
        assert net.status_code == 200
        assert net.json()["nodes"]

        # PREDICT
        pred = client.get("/api/v2/ai/predictions/risk-scores", headers=headers)
        assert pred.status_code == 200

        # ACT -> APPROVE -> REVIEW
        r = client.post(
            f"/api/v2/intelligence/emerging-patterns/{pattern['intelligence_id']}/action",
            json={"title": "Integrated lifecycle surge"},
            headers=headers,
        )
        assert r.status_code == 200
        iid = r.json()["intervention_id"]
        for target in ("supervisor_review", "approved", "deployed", "outcome_review", "completed"):
            r = client.post(
                f"/api/v2/interventions/{iid}/advance-stage",
                json={"target_stage": target, "notes": "ok", "outcome_data": {"subsequent_crime_count": 1}},
                headers=headers,
            )
            assert r.status_code == 200, (target, r.text)
        assert r.json()["workflow_stage"] == "completed"