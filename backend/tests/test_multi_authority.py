"""Tests for Issue #286: SAKSHA Multi-Authority & Court Access Architecture."""
import uuid
import pytest
from datetime import datetime, timezone

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    AUTH_COURT,
    AUTH_LAW_ENFORCEMENT,
    CAP_CASE_READ,
    CAP_CASE_WRITE,
    CAP_COURT_CASE_READ,
    ROLE_ADMIN,
    ROLE_COURT_ADMIN,
    ROLE_JUDICIAL_AUTHORITY,
    ROLE_COURT_ANALYST,
    ROLE_INVESTIGATOR,
    has_capability,
    get_user_authority,
)
from app.auth.scope import check_case_access, is_court_user
from app.core.security import hash_password
from app.models.case_access import CaseAccess
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.evidence import Evidence
from app.models.location import Location
from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.services import audit_service
from app.services.organization_service import (
    create_organization,
    grant_case_access,
    list_organizations,
    revoke_case_access,
)


def _role(db_session, name: str) -> Role:
    role = db_session.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=name.title())
        db_session.add(role)
        db_session.flush()
    return role


def _make_category(db_session, name: str = "Theft") -> CrimeCategory:
    cat = db_session.query(CrimeCategory).filter_by(name=name).first()
    if cat is None:
        cat = CrimeCategory(name=name, severity="medium")
        db_session.add(cat)
        db_session.flush()
    return cat


def _make_user(
    db_session,
    username: str,
    role_name: str = "investigator",
    org_id: uuid.UUID | None = None,
    designation: str | None = None,
    jurisdiction: str | None = None,
    scope_level: str = "DISTRICT",
    district: str = "Central",
) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.replace("-", " ").title(),
        hashed_password=hash_password("Password123!"),
        role_id=_role(db_session, role_name).id,
        organization_id=org_id,
        designation=designation,
        jurisdiction=jurisdiction,
        scope_level=scope_level,
        district=district,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _make_location(db_session, district: str = "Central") -> Location:
    loc = Location(
        station=f"{district} Station",
        district=district,
        address=f"{district} Central Road",
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(loc)
    db_session.commit()
    return loc


def _make_case(db_session, location: Location) -> CrimeCase:
    cat = _make_category(db_session)
    case = CrimeCase(
        case_number=f"CC-{uuid.uuid4().hex[:6].upper()}",
        category_id=cat.id,
        description="Case for multi-authority testing",
        status="open",
        priority="medium",
        location_id=location.id,
        occurred_at=datetime.now(timezone.utc),
    )
    db_session.add(case)
    db_session.commit()
    return case


def _make_evidence(db_session, case: CrimeCase) -> Evidence:
    ev = Evidence(
        case_id=case.id,
        title="Test Physical Evidence",
        evidence_type="Document",
        description="Legal records",
        status="Secured",
        storage_path="C:\\secret\\internal\\disk\\path\\file.pdf",
    )
    db_session.add(ev)
    db_session.commit()
    return ev


# ---------------------------------------------------------------------------
# Unit & Service Tests
# ---------------------------------------------------------------------------


def test_organization_crud(db_session):
    """Verify organization creation, retrieval, and listing."""
    org = create_organization(
        db_session,
        name="High Court of Karnataka",
        code="HCK-01",
        authority_type=AUTH_COURT,
        jurisdiction="Statewide",
        contact_email="registrar@hck.gov.in",
    )
    assert org.id is not None
    assert org.name == "High Court of Karnataka"
    assert org.authority_type == AUTH_COURT

    orgs = list_organizations(db_session)
    assert len(orgs) == 1
    assert orgs[0].code == "HCK-01"


def test_role_capabilities():
    """Verify capabilities correctly partition court vs police authority."""
    admin_role = Role(name=ROLE_ADMIN)
    judge_role = Role(name=ROLE_JUDICIAL_AUTHORITY)
    io_role = Role(name=ROLE_INVESTIGATOR)

    admin_user = User(role=admin_role)
    judge_user = User(role=judge_role)
    io_user = User(role=io_role)

    # Admin has all capabilities
    assert has_capability(admin_user, CAP_CASE_READ)
    assert has_capability(admin_user, CAP_CASE_WRITE)

    # Judicial authority has read capability but NOT operational write
    assert has_capability(judge_user, CAP_CASE_READ)
    assert has_capability(judge_user, CAP_COURT_CASE_READ)
    assert not has_capability(judge_user, CAP_CASE_WRITE)

    # Investigator has case write capability but NOT judicial authority role
    assert has_capability(io_user, CAP_CASE_WRITE)
    assert is_court_user(judge_user)
    assert not is_court_user(io_user)


def test_case_access_scoping(db_session):
    """Verify court user only accesses cases with an active CaseAccess grant."""
    court_org = create_organization(
        db_session,
        name="City Sessions Court",
        code="CSC-01",
        authority_type=AUTH_COURT,
    )
    judge = _make_user(
        db_session,
        username="judge_smith",
        role_name=ROLE_JUDICIAL_AUTHORITY,
        org_id=court_org.id,
        designation="Sessions Judge",
        jurisdiction="Bengaluru Urban",
    )

    loc = _make_location(db_session, district="Bengaluru Urban")
    case_1 = _make_case(db_session, loc)
    case_2 = _make_case(db_session, loc)

    # Initially, court user has NO access to either case
    assert not check_case_access(judge, case_1.id, db_session)
    assert not check_case_access(judge, case_2.id, db_session)

    # Grant access to case_1
    grant = grant_case_access(
        db_session,
        case_id=case_1.id,
        organization_id=court_org.id,
        granted_by=judge.id,
        access_level="read_only",
        purpose="Trial proceedings",
    )
    assert grant.status == "active"

    # Now case_1 is accessible, case_2 is still denied
    assert check_case_access(judge, case_1.id, db_session)
    assert not check_case_access(judge, case_2.id, db_session)

    # Revoke access to case_1
    revoke_case_access(db_session, grant.id)
    assert not check_case_access(judge, case_1.id, db_session)


def test_audit_logging_with_organization(db_session):
    """Audit logs must record organization_id and authority_type."""
    court_org = create_organization(
        db_session,
        name="District Magistrate Court",
        code="DMC-01",
        authority_type=AUTH_COURT,
    )
    judge = _make_user(
        db_session,
        username="magistrate_rao",
        role_name=ROLE_JUDICIAL_AUTHORITY,
        org_id=court_org.id,
    )

    log = audit_service.log_action(
        db_session,
        current_user=judge,
        action="VIEW_DOSSIER",
        resource_type="CrimeCase",
        resource_id=str(uuid.uuid4()),
        details="Judicial dossier review",
    )

    assert log.organization_id == court_org.id
    assert log.authority_type == AUTH_COURT


# ---------------------------------------------------------------------------
# Endpoint & RBAC Integration Tests
# ---------------------------------------------------------------------------


def test_court_user_read_case_endpoint(client, db_session):
    """Verify endpoint-level access: granted case succeeds, ungranted case returns 403."""
    court_org = create_organization(
        db_session,
        name="High Court",
        code="HC-01",
        authority_type=AUTH_COURT,
    )
    judge = _make_user(
        db_session,
        username="justice_kumar",
        role_name=ROLE_JUDICIAL_AUTHORITY,
        org_id=court_org.id,
    )

    loc = _make_location(db_session, district="Central")
    case_granted = _make_case(db_session, loc)
    case_denied = _make_case(db_session, loc)

    grant_case_access(
        db_session,
        case_id=case_granted.id,
        organization_id=court_org.id,
        granted_by=judge.id,
    )

    client.app.dependency_overrides[get_current_user] = lambda: judge

    # Read granted case -> 200 OK
    resp_granted = client.get(f"/api/v2/crime-cases/{case_granted.id}")
    assert resp_granted.status_code == 200
    assert resp_granted.json()["id"] == str(case_granted.id)

    # Read ungranted case -> 403 Forbidden
    resp_denied = client.get(f"/api/v2/crime-cases/{case_denied.id}")
    assert resp_denied.status_code == 403

    client.app.dependency_overrides.clear()


def test_court_user_evidence_sanitization(client, db_session):
    """Verify court user accessing evidence gets sanitized storage paths."""
    court_org = create_organization(
        db_session,
        name="Sessions Court",
        code="SC-02",
        authority_type=AUTH_COURT,
    )
    judge = _make_user(
        db_session,
        username="judge_anita",
        role_name=ROLE_JUDICIAL_AUTHORITY,
        org_id=court_org.id,
    )

    loc = _make_location(db_session, district="Central")
    case = _make_case(db_session, loc)
    ev = _make_evidence(db_session, case)

    grant_case_access(
        db_session,
        case_id=case.id,
        organization_id=court_org.id,
        granted_by=judge.id,
    )

    client.app.dependency_overrides[get_current_user] = lambda: judge

    resp = client.get(f"/api/v2/evidence/{ev.id}")
    assert resp.status_code == 200
    data = resp.json()

    # Storage path must be sanitized to basename only, never full server path
    assert data["storage_path"] == "file.pdf"
    assert "C:\\secret" not in data["storage_path"]

    client.app.dependency_overrides.clear()


def test_court_user_mutation_blocked(client, db_session):
    """Strict read-only guard: Court user cannot create cases, update cases, or create evidence."""
    court_org = create_organization(
        db_session,
        name="Commercial Court",
        code="CC-01",
        authority_type=AUTH_COURT,
    )
    court_user = _make_user(
        db_session,
        username="clerk_roy",
        role_name=ROLE_COURT_ANALYST,
        org_id=court_org.id,
    )

    loc = _make_location(db_session, district="Central")
    case = _make_case(db_session, loc)

    client.app.dependency_overrides[get_current_user] = lambda: court_user

    # Attempt to create case -> 403 Forbidden
    create_resp = client.post(
        "/api/v2/crime-cases",
        json={
            "case_number": "CC-ILLEGAL",
            "title": "Unauthorized Case",
            "status": "Open",
            "priority": "High",
            "location_id": str(loc.id),
        },
    )
    assert create_resp.status_code == 403

    # Attempt to update case -> 403 Forbidden
    update_resp = client.put(
        f"/api/v2/crime-cases/{case.id}",
        json={"title": "Modified Title"},
    )
    assert update_resp.status_code == 403

    # Attempt to delete case -> 403 Forbidden
    delete_resp = client.delete(f"/api/v2/crime-cases/{case.id}")
    assert delete_resp.status_code == 403

    client.app.dependency_overrides.clear()


def test_admin_organization_endpoints(client, db_session):
    """Admin can list organizations, authority types, and capabilities."""
    admin_user = _make_user(db_session, username="admin_sys", role_name=ROLE_ADMIN)
    client.app.dependency_overrides[get_current_user] = lambda: admin_user

    # List authority types
    resp_auth = client.get("/api/v2/admin/authority-types")
    assert resp_auth.status_code == 200
    types = resp_auth.json()
    assert AUTH_LAW_ENFORCEMENT in types
    assert AUTH_COURT in types

    # List capabilities
    resp_cap = client.get("/api/v2/admin/capabilities")
    assert resp_cap.status_code == 200
    caps = resp_cap.json()
    assert CAP_COURT_CASE_READ in caps
    assert CAP_CASE_WRITE in caps

    # Create organization
    resp_org = client.post(
        "/api/v2/admin/organizations",
        json={
            "name": "State Forensic Science Lab",
            "code": "SFSL-01",
            "authority_type": "FORENSIC",
            "jurisdiction": "Statewide",
        },
    )
    assert resp_org.status_code == 201
    assert resp_org.json()["code"] == "SFSL-01"

    client.app.dependency_overrides.clear()
