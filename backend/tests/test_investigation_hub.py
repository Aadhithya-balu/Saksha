"""Tests for the Investigation Hub (issue #200) — officer-centric unified search,
natural-language/Kannada interpretation, and honest image-search fallback.
"""
from datetime import datetime, timezone

import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR
from app.models.location import Location
from app.models.role import Role
from app.models.user import User

HUB = "/api/v2/investigation-hub"


def _make_user(db_session, role_name: str) -> User:
    role = db_session.query(Role).filter_by(name=role_name).first()
    if role is None:
        role = Role(name=role_name, description=role_name)
        db_session.add(role)
        db_session.flush()
    user = User(
        username=f"hub-{role_name}",
        email=f"hub-{role_name}@example.com",
        full_name="Hub User",
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        district="Bengaluru Urban",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def hub_data(db_session):
    """Seed one criminal, one case, one FIR and one location into the request DB."""
    category = CrimeCategory(name="Murder", section_code="BNS 302", severity="critical")
    location = Location(district="Bengaluru Urban", station="Kempegowda Nagar", latitude=12.97, longitude=77.59)
    db_session.add_all([category, location])
    db_session.flush()

    crook = Criminal(
        full_name="Ramu Swamy",
        aliases="Ramu",
        status="at_large",
        mo_summary="Assault committed near Kempegowda Nagar using a sharp weapon targeting the neck.",
        gang_affiliation="Local Syndicate",
    )
    db_session.add(crook)
    db_session.flush()

    case = CrimeCase(
        case_number="CR-2026-TEST-001", category_id=category.id, location_id=location.id,
        occurred_at=datetime(2026, 6, 1, tzinfo=timezone.utc), status="open",
        description="Murder investigation with a neck-cut wound in Bengaluru Urban.",
        mo_tags="murder,neck,cut",
    )
    db_session.add(case)
    db_session.flush()

    fir = FIR(
        fir_number="2025/999", crime_case_id=case.id,
        complainant_name="Ramu Swamy", sections="302",
        narrative="Called about a murder with a neck injury.",
    )
    db_session.add(fir)
    db_session.flush()

    from app.models.fir import FIRCriminalLink

    db_session.add(FIRCriminalLink(fir_id=fir.id, criminal_id=crook.id))
    db_session.flush()
    db_session.commit()
    return {"criminal": crook, "case": case}


@pytest.fixture
def investigator_client(client, db_session, hub_data):
    user = _make_user(db_session, "investigator")
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_client(client, db_session, hub_data):
    user = _make_user(db_session, "viewer")
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


def test_search_returns_grouped_real_results(investigator_client):
    """A broad term returns real persons/cases/FIRs from the authorised DB."""
    c = investigator_client
    r = c.get(f"{HUB}/search", params={"q": "Ramu", "limit": 20})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "persons" in body
    assert "cases" in body
    assert "firs" in body
    assert body["provenance"] == "LIVE"
    assert any("Ramu" in p["name"] for p in body["persons"])


def test_search_finds_case_by_number(investigator_client):
    c = investigator_client
    r = c.get(f"{HUB}/search", params={"q": "CR-2026-TEST-001"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert any("CR-2026-TEST-001" in cs["name"] for cs in body["cases"])


def test_search_mo_available_for_investigator(investigator_client):
    c = investigator_client
    r = c.get(f"{HUB}/search", params={"q": "neck cut murder", "limit": 20})
    assert r.status_code == 200
    body = r.json()
    assert body["mo_intelligence"] is True
    assert isinstance(body["mo_matches"], list)


def test_search_mo_hidden_for_viewer(viewer_client):
    v = viewer_client
    rv = v.get(f"{HUB}/search", params={"q": "neck cut murder", "limit": 20})
    assert rv.status_code == 200
    assert rv.json()["mo_intelligence"] is False


def test_interpret_english(investigator_client):
    c = investigator_client
    r = c.get(f"{HUB}/interpret", params={"q": "Find murders in Bengaluru Urban involving a cut to the neck"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["detected_language"] == "english"
    assert body["crime_type"].lower() == "murder"
    assert "neck" in body["mo_keywords"]


def test_interpret_kannada(investigator_client):
    c = investigator_client
    q = "ಬೆಂಗಳೂರು ಅರ್ಬನ್‌ನಲ್ಲಿ ಕುತ್ತಿಗೆ ಕತ್ತರಿಸಿ ನಡೆದ ಕೊಲೆ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ"
    r = c.get(f"{HUB}/interpret", params={"q": q})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["detected_language"] in ("kannada", "mixed")
    assert body["crime_type"].lower() == "murder"
    assert "neck" in body["mo_keywords"] or "cut" in body["mo_keywords"]
    assert body["district"] is not None


def test_interpret_mixed_kannada(investigator_client):
    c = investigator_client
    r = c.get(f"{HUB}/interpret", params={"q": "Kempegowda Nagar police station alli similar cases yavudu?"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["detected_language"] in ("kannada", "mixed", "english")
    assert body["station"] is not None


def test_image_search_is_honest_fallback(investigator_client):
    """No face-matching engine ships with SAKSHA, so the endpoint must not fabricate."""
    c = investigator_client
    r = c.post(f"{HUB}/image-search")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "unavailable"
    assert body["matches"] == []
    assert body["capability"] == "none"
    assert body["safe_fallback"]
