"""End-to-end district scoping: district-bound roles must never see or open
another district's cases, FIRs, criminals, victims or evidence.
"""
from datetime import datetime, timezone

import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.location import Location
from app.models.role import Role
from app.models.user import User
from app.models.victim import Victim

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


def _seed_district(db, district: str, tag: str):
    category = CrimeCategory(name=f"Theft-{tag}", section_code=f"IPC-{tag}", severity="medium")
    location = Location(district=district, station=f"{tag} PS", latitude=12.0, longitude=77.0)
    db.add_all([category, location])
    db.flush()

    case = CrimeCase(
        case_number=f"CR-{tag}",
        category_id=category.id,
        location_id=location.id,
        occurred_at=datetime.now(timezone.utc),
        status="open",
        priority="high",
        progress=10,
    )
    db.add(case)
    db.flush()

    fir = FIR(
        fir_number=f"FIR-{tag}",
        crime_case_id=case.id,
        complainant_name=f"Complainant {tag}",
        status="registered",
    )
    db.add(fir)
    db.flush()

    criminal = Criminal(full_name=f"Criminal {tag}", status="at_large")
    victim = Victim(full_name=f"Victim {tag}")
    db.add_all([criminal, victim])
    db.flush()

    db.add_all(
        [
            FIRCriminalLink(fir_id=fir.id, criminal_id=criminal.id, role="accused"),
            FIRVictimLink(fir_id=fir.id, victim_id=victim.id),
        ]
    )
    evidence = Evidence(
        case_id=case.id,
        title=f"Evidence {tag}",
        evidence_type="document",
        status="collected",
        created_by="seed",
    )
    db.add(evidence)
    db.commit()

    return {"case": case, "fir": fir, "criminal": criminal, "victim": victim, "evidence": evidence}


@pytest.fixture
def seeded(client, db_session):
    blr = _seed_district(db_session, "Bengaluru Urban", "BLR")
    mys = _seed_district(db_session, "Mysuru", "MYS")
    return blr, mys


def _login_as(client, user):
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client


def test_investigator_is_scoped_to_own_district(client, db_session, seeded):
    blr, mys = seeded
    io = _user(db_session, "scope-e2e-io", "investigator", district="Bengaluru Urban")
    db_session.commit()
    _login_as(client, io)

    cases = client.get(f"{API}/crime-cases").json()
    assert [c["case_number"] for c in cases["results"]] == ["CR-BLR"]

    # Explicitly asking for another district must not widen scope.
    forced = client.get(f"{API}/crime-cases", params={"district": "Mysuru"}).json()
    assert [c["case_number"] for c in forced["results"]] == ["CR-BLR"]

    firs = client.get(f"{API}/firs").json()
    assert [f["fir_number"] for f in firs["results"]] == ["FIR-BLR"]

    assert client.get(f"{API}/crime-cases/{mys['case'].id}").status_code == 403
    assert client.get(f"{API}/firs/{mys['fir'].id}").status_code == 403
    assert client.get(f"{API}/criminals/{mys['criminal'].id}").status_code == 403
    assert client.get(f"{API}/victims/{mys['victim'].id}").status_code == 403
    assert client.get(f"{API}/evidence/{mys['evidence'].id}").status_code == 403

    assert [c["full_name"] for c in client.get(f"{API}/criminals").json()["results"]] == ["Criminal BLR"]
    assert [v["full_name"] for v in client.get(f"{API}/victims").json()["results"]] == ["Victim BLR"]
    assert [e["title"] for e in client.get(f"{API}/evidence").json()["results"]] == ["Evidence BLR"]


def test_scoped_role_without_district_is_denied(client, db_session, seeded):
    viewer = _user(db_session, "scope-e2e-viewer", "viewer", district=None)
    db_session.commit()
    _login_as(client, viewer)

    assert client.get(f"{API}/crime-cases").status_code == 403
    assert client.get(f"{API}/firs").status_code == 403


def test_multi_district_role_sees_all(client, db_session, seeded):
    admin = _user(db_session, "scope-e2e-admin", "admin", district=None)
    db_session.commit()
    _login_as(client, admin)

    case_numbers = {c["case_number"] for c in client.get(f"{API}/crime-cases").json()["results"]}
    assert case_numbers == {"CR-BLR", "CR-MYS"}
