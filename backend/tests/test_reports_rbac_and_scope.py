"""Comprehensive tests for Reports RBAC, district scoping, date validation, and delete."""
from datetime import datetime, timedelta, timezone
import pytest
from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.intervention import Intervention
from app.models.location import Location
from app.models.officer import Officer
from app.models.report import Report, REPORT_STATUS_GENERATED
from app.models.role import Role
from app.models.user import User
from app.models.victim import Victim

REPORTS = "/api/v2/reports"


def _get_or_create_role(db, role_name):
    role = db.query(Role).filter_by(name=role_name).first()
    if role is None:
        role = Role(name=role_name, description=role_name)
        db.add(role)
        db.flush()
    return role


def _create_user(db, username, role_name, district=None):
    role = _get_or_create_role(db, role_name)
    user = User(
        username=username,
        email=f"{username}@ksp.gov.in",
        full_name=username.replace("_", " ").title(),
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        district=district,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def seeded_env(db_session):
    cat = CrimeCategory(name="Robbery", section_code="IPC 392", severity="high")
    loc_blr = Location(district="Bengaluru Urban", station="Indiranagar", latitude=12.9784, longitude=77.6408)
    loc_mys = Location(district="Mysuru", station="Devaraja", latitude=12.3051, longitude=76.6551)
    db_session.add_all([cat, loc_blr, loc_mys])
    db_session.flush()

    case_blr = CrimeCase(
        case_number="CR-BLR-001",
        category_id=cat.id,
        location_id=loc_blr.id,
        occurred_at=datetime.now(timezone.utc) - timedelta(days=2),
        status="open",
        priority="high",
        progress=30,
    )
    case_mys = CrimeCase(
        case_number="CR-MYS-001",
        category_id=cat.id,
        location_id=loc_mys.id,
        occurred_at=datetime.now(timezone.utc) - timedelta(days=3),
        status="under_investigation",
        priority="medium",
        progress=50,
    )
    db_session.add_all([case_blr, case_mys])

    intervention = Intervention(
        district="Bengaluru Urban",
        intervention_type="patrol_surge",
        title="Night Patrol Surge",
        started_at=datetime.now(timezone.utc) - timedelta(days=5),
        status="active",
        workflow_stage="deployed",
        estimated_coverage=85.0,
    )
    crook = Criminal(
        full_name="Raju Gowda",
        gang_affiliation="Brigade Syndicate",
        status="wanted",
    )
    victim = Victim(
        full_name="Pooja Sharma",
        gender="female",
        age=32,
    )
    db_session.add_all([intervention, crook, victim])
    db_session.commit()
    return {
        "cat": cat,
        "loc_blr": loc_blr,
        "loc_mys": loc_mys,
        "case_blr": case_blr,
        "case_mys": case_mys,
    }


def test_reports_rbac_access_allowed(client, db_session, seeded_env):
    """Allowed roles: admin, crime_analyst, investigator, inspector, policymaker."""
    from sqlalchemy.orm import joinedload
    for role in ["admin", "crime_analyst", "investigator", "inspector", "policymaker"]:
        user = _create_user(db_session, f"user_{role}", role, district="Bengaluru Urban")
        db_session.commit()
        uid = user.id
        client.app.dependency_overrides[get_current_user] = lambda u=uid: db_session.query(User).options(joinedload(User.role)).filter_by(id=u).first()
        resp = client.get(f"{REPORTS}/statistics/summary")
        assert resp.status_code == 200, f"Role {role} should be allowed on /reports (got {resp.status_code})"


def test_reports_rbac_access_denied(client, db_session):
    """Denied roles: forensic_officer, viewer."""
    from sqlalchemy.orm import joinedload
    for role in ["forensic_officer", "viewer"]:
        user = _create_user(db_session, f"denied_{role}", role, district="Bengaluru Urban")
        db_session.commit()
        uid = user.id
        client.app.dependency_overrides[get_current_user] = lambda u=uid: db_session.query(User).options(joinedload(User.role)).filter_by(id=u).first()
        resp = client.get(f"{REPORTS}/statistics/summary")
        assert resp.status_code == 403, f"Role {role} should be denied with 403 (got {resp.status_code})"


def test_date_range_validation_422(client, db_session, seeded_env):
    """Passing date_from > date_to must return 422."""
    from sqlalchemy.orm import joinedload
    user = _create_user(db_session, "analyst_date", "crime_analyst")
    db_session.commit()
    uid = user.id
    client.app.dependency_overrides[get_current_user] = lambda: db_session.query(User).options(joinedload(User.role)).filter_by(id=uid).first()

    bad_params = {
        "date_from": "2026-06-10T00:00:00Z",
        "date_to": "2026-06-01T00:00:00Z",
    }
    # Test preview
    r = client.get(f"{REPORTS}/cases", params=bad_params)
    assert r.status_code == 422
    assert "date_from must be before or equal to date_to" in r.text

    # Test export
    r = client.get(f"{REPORTS}/cases/export/csv", params=bad_params)
    assert r.status_code == 422

    # Test list
    r = client.get(f"{REPORTS}", params=bad_params)
    assert r.status_code == 422


def test_district_scoping_enforcement(client, db_session, seeded_env):
    """District-bound role (investigator) is forced to their own district."""
    from sqlalchemy.orm import joinedload
    io_user = _create_user(db_session, "io_blr", "investigator", district="Bengaluru Urban")
    db_session.commit()
    uid = io_user.id
    client.app.dependency_overrides[get_current_user] = lambda: db_session.query(User).options(joinedload(User.role)).filter_by(id=uid).first()

    # Attempt to request Mysuru - must be ignored/scoped to Bengaluru Urban
    r = client.get(f"{REPORTS}/cases?district=Mysuru")
    assert r.status_code == 200
    data = r.json()
    assert data["filters"]["district"] == "Bengaluru Urban"
    for row in data["results"]:
        assert row["district"] == "Bengaluru Urban"


def test_delete_report_lifecycle(client, db_session):
    """Test DELETE /reports/{report_id} with authorization and audit."""
    from sqlalchemy.orm import joinedload
    creator = _create_user(db_session, "report_creator", "crime_analyst")
    other_user = _create_user(db_session, "other_analyst", "crime_analyst")
    admin_user = _create_user(db_session, "admin_user", "admin")
    db_session.commit()
    c_id = creator.id
    o_id = other_user.id

    report = Report(
        template="cases_report",
        title="Test Delete Report",
        report_type="cases",
        requested_by_id=creator.id,
        status=REPORT_STATUS_GENERATED,
        format="pdf",
    )
    db_session.add(report)
    db_session.commit()
    report_id = str(report.id)

    # 1. Other analyst tries to delete -> 403 Forbidden
    client.app.dependency_overrides[get_current_user] = lambda: db_session.query(User).options(joinedload(User.role)).filter_by(id=o_id).first()
    r = client.delete(f"{REPORTS}/{report_id}")
    assert r.status_code == 403

    # 2. Creator deletes their report -> 200 OK
    client.app.dependency_overrides[get_current_user] = lambda: db_session.query(User).options(joinedload(User.role)).filter_by(id=c_id).first()
    r = client.delete(f"{REPORTS}/{report_id}")
    assert r.status_code == 200
    assert r.json()["success"] is True

    # 3. Report is gone -> 404
    r = client.get(f"{REPORTS}/{report_id}")
    assert r.status_code == 404


def test_all_templates_preview_and_export(client, db_session, seeded_env):
    """Verify all templates and export formats function without errors."""
    from sqlalchemy.orm import joinedload
    analyst = _create_user(db_session, "analyst_templates", "crime_analyst")
    db_session.commit()
    uid = analyst.id
    client.app.dependency_overrides[get_current_user] = lambda: db_session.query(User).options(joinedload(User.role)).filter_by(id=uid).first()

    templates = ["cases", "hotspots", "interventions", "network", "victimology", "strategic", "dossier"]
    for t in templates:
        r = client.get(f"{REPORTS}/{t}")
        assert r.status_code == 200, f"Template {t} failed preview: {r.text}"
        body = r.json()
        assert isinstance(body["headers"], list)
        assert isinstance(body["results"], list)

    for fmt in ["csv", "xlsx", "docx", "txt", "pdf"]:
        r = client.get(f"{REPORTS}/cases/export/{fmt}?classification=RESTRICTED")
        assert r.status_code == 200, f"Format {fmt} export failed: {r.text}"
        assert len(r.content) > 50
