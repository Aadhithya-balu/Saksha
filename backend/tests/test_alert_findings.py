"""Phase 5 alert-finding workflow: rule detection, dedup, review lifecycle,
district scoping, and RBAC (admin/analyst generate; REVIEW_ROLES review)."""
from datetime import datetime, timedelta

import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.alert_finding import AlertFinding
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink
from app.models.location import Location
from app.models.role import Role
from app.models.user import User
from app.services.alert_finding_service import (
    FINDING_TYPE_CRIME_SPIKE,
    FINDING_TYPE_REPEAT_OFFENDER,
    generate_candidate_findings,
    list_findings,
    review_finding,
)

API = "/api/v2"


def _role(db, name):
    role = db.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=name)
        db.add(role)
        db.flush()
    return role


def _user(db, username, role_name, district=None):
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.title(),
        hashed_password=hash_password("Password123!"),
        role_id=_role(db, role_name).id,
        district=district,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _login_as(client, user):
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client


def _seed_world(db, later_than: datetime):
    """Two districts; Mysuru spikes (3 FIRs, one 2x-recidivist), BLR spikes
    (3 FIRs, one 2x-recidivist) so scoping is observable in both directions."""
    cat_theft = CrimeCategory(name="Spike Theft", section_code="IPC-1", severity="high")
    cat_dacoity = CrimeCategory(name="Spike Dacoity", section_code="IPC-2", severity="high")
    db.add_all([cat_theft, cat_dacoity])
    loc_mys = Location(district="Mysuru", station="MYS PS", latitude=12.0, longitude=76.6)
    loc_blr = Location(district="Bengaluru Urban", station="BLR PS", latitude=12.9, longitude=77.6)
    db.add_all([loc_mys, loc_blr])
    db.flush()

    c_m1 = Criminal(full_name="Repeat Mysuru Suspect", status="at_large")
    c_m2 = Criminal(full_name="Single Mysuru Suspect", status="at_large")
    c_b1 = Criminal(full_name="Repeat Bengaluru Suspect", status="at_large")
    db.add_all([c_m1, c_m2, c_b1])
    db.flush()

    def fir(case_no, cat, loc, fir_no, criminal=None):
        case = CrimeCase(
            case_number=case_no,
            category_id=cat.id,
            location_id=loc.id,
            occurred_at=later_than,
            status="open",
            priority="high",
            progress=20,
        )
        db.add(case)
        db.flush()
        row = FIR(fir_number=fir_no, crime_case_id=case.id, complainant_name=f"Complainant {fir_no}", status="registered")
        db.add(row)
        db.flush()
        if criminal:
            db.add(FIRCriminalLink(fir_id=row.id, criminal_id=criminal.id, role="accused"))
        return row

    # Mysuru: 3 theft FIRs + a repeat offender across 2 of them
    r1 = fir("MS-1", cat_theft, loc_mys, "MYS-1", c_m1)
    fir("MS-2", cat_theft, loc_mys, "MYS-2", c_m1)
    fir("MS-3", cat_theft, loc_mys, "MYS-3", c_m2)
    # Bengaluru: 3 dacoity FIRs + a repeat offender across 2 of them
    fir("BL-1", cat_dacoity, loc_blr, "BLR-1", c_b1)
    fir("BL-2", cat_dacoity, loc_blr, "BLR-2", c_b1)
    fir("BL-3", cat_dacoity, loc_blr, "BLR-3", None)

    db.commit()
    return {"r1": r1, "c_m1": c_m1, "c_b1": c_b1}


@pytest.fixture
def world(db_session):
    recent = datetime.utcnow() - timedelta(days=1)
    return _seed_world(db_session, recent)


# ---------------------------------------------------------------------------
# Service-level: detection, dedup, district scoping, review lifecycle
# ---------------------------------------------------------------------------

class TestGenerateFindings:
    def test_detects_spike_and_repeat(self, db_session, world):
        stats = generate_candidate_findings(db_session)
        assert stats["generated"] >= 4
        assert stats["total_open"] == stats["generated"]

        findings = list_findings(db_session)
        spike = [f for f in findings if f["finding_type"] == FINDING_TYPE_CRIME_SPIKE]
        repeat = [f for f in findings if f["finding_type"] == FINDING_TYPE_REPEAT_OFFENDER]
        assert {f["district"] for f in spike} == {"Mysuru", "Bengaluru Urban"}
        assert spike[0]["current_count"] == 3
        assert spike[0]["spike_ratio"] >= 1.5
        assert len(repeat) == 2
        by_district = {f["district"]: f for f in repeat}
        assert by_district["Mysuru"]["entity_id"] == str(world["c_m1"].id)
        assert by_district["Bengaluru Urban"]["entity_id"] == str(world["c_b1"].id)

    def test_dedup_persists(self, db_session, world):
        first = generate_candidate_findings(db_session)
        second = generate_candidate_findings(db_session)
        assert second["generated"] == 0
        assert second["total_open"] == first["total_open"]

    def test_scoped_generation_only_own_district(self, db_session, world):
        stats = generate_candidate_findings(db_session, district="Mysuru")
        findings = list_findings(db_session)
        assert {f["district"] for f in findings} == {"Mysuru"}
        assert stats["total_open"] == len(findings)


class TestReviewLifecycle:
    def test_confirm_investigate_dismiss(self, db_session, world):
        user = _user(db_session, "af-reviewer", "investigator", district="Mysuru")
        generate_candidate_findings(db_session)
        confirmed = review_finding(db_session, _first_open(db_session, FINDING_TYPE_CRIME_SPIKE),
                                   "confirm", user, note="legit spike")
        assert confirmed.status == "reviewed"
        assert confirmed.review_decision == "confirm"
        assert confirmed.reviewed_by_id == user.id

        second = _first_open(db_session, FINDING_TYPE_REPEAT_OFFENDER)
        reviewed = review_finding(db_session, second, "investigate", user)
        assert reviewed.status == "in_review"

        dismissed = review_finding(db_session, _first_open(db_session), "dismiss", user, note="false pattern")
        assert dismissed.status == "dismissed"
        db_session.commit()

    def test_invalid_decision_rejected(self, db_session, world):
        user = _user(db_session, "af-bad", "crime_analyst")
        generate_candidate_findings(db_session, district="Mysuru")
        with pytest.raises(ValueError):
            review_finding(db_session, _first_open(db_session), "auto_confirm", user)


def _first_open(db, finding_type=None):
    q = db.query(AlertFinding).filter(AlertFinding.status == "open")
    if finding_type:
        q = q.filter(AlertFinding.finding_type == finding_type)
    return q.first()


# ---------------------------------------------------------------------------
# API-level: district scoping + RBAC
# ---------------------------------------------------------------------------

class TestApiScoping:
    def test_bound_user_sees_only_own_district(self, client, db_session, world):
        io = _user(db_session, "af-e2e-io", "investigator", district="Mysuru")
        db_session.commit()
        _login_as(client, io)

        resp = client.get(f"{API}/alerts/findings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 2
        for f in body["results"]:
            assert f["district"] == "Mysuru"

    def test_bound_user_cannot_review_other_district(self, client, db_session, world):
        admin = _user(db_session, "af-e2e-admin", "admin")
        db_session.commit()
        _login_as(client, admin)
        admin_resp = client.get(f"{API}/alerts/findings")
        blr_finding = next(f for f in admin_resp.json()["results"] if f["district"] == "Bengaluru Urban")

        io = _user(db_session, "af-e2e-io2", "investigator", district="Mysuru")
        db_session.commit()
        _login_as(client, io)
        resp = client.post(f"{API}/alerts/findings/{blr_finding['id']}/review", params={"decision": "confirm"})
        assert resp.status_code == 403

    def test_admin_can_review_any_district(self, client, db_session, world):
        admin = _user(db_session, "af-e2e-admin2", "admin")
        db_session.commit()
        _login_as(client, admin)
        findings = client.get(f"{API}/alerts/findings").json()["results"]
        target = next(f for f in findings if f["district"] == "Mysuru")
        resp = client.post(f"{API}/alerts/findings/{target['id']}/review",
                           params={"decision": "confirm", "note": "verified"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "reviewed"
        assert resp.json()["review_decision"] == "confirm"
        assert resp.json()["review_note"] == "verified"