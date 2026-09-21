"""FIR attachments: real binary upload/download/delete (no metadata-only stubs).

Covers:
  * multipart upload writes bytes to disk and records public metadata only
    (internal `stored_name`/`storage_url` must never leak to the client),
  * download streams the exact bytes back with the original filename,
  * delete removes the file from disk and the record from the FIR,
  * viewer role is forbidden from mutating attachments.
"""
import json
from datetime import datetime, timezone

import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.fir import FIR
from app.models.location import Location
from app.models.role import Role
from app.models.user import User

ATTACH = "/api/v2/firs"

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n"


def _make_role(db_session, name):
    role = db_session.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=name)
        db_session.add(role)
        db_session.flush()
    return role


def _make_user(db_session, username, role_name):
    role = _make_role(db_session, role_name)
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.title(),
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


def _seed_fir(db_session):
    category = CrimeCategory(name="Theft", section_code="IPC 379", severity="medium")
    location = Location(district="Bengaluru Urban", station="Whitefield", latitude=12.9716, longitude=77.5946)
    db_session.add_all([category, location])
    db_session.flush()
    case = CrimeCase(
        case_number="CR-FIR-ATT-0001",
        category_id=category.id,
        location_id=location.id,
        occurred_at=datetime.now(timezone.utc),
        status="open",
        priority="high",
        progress=10,
    )
    db_session.add(case)
    db_session.flush()
    fir = FIR(
        fir_number="FIR-ATT-0001",
        crime_case_id=case.id,
        complainant_name="Test Complainant",
        status="registered",
    )
    db_session.add(fir)
    db_session.commit()
    return fir


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    import app.routes.firs as firs_module
    import app.services.evidence_service as evidence_service

    target = tmp_path / "uploads"
    target.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(evidence_service, "UPLOAD_DIR", target)
    monkeypatch.setattr(firs_module, "UPLOAD_DIR", target)
    return target


@pytest.fixture
def investigator_client(client, db_session):
    user = _make_user(db_session, "fir-att-inv", "investigator")
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client, user
    client.app.dependency_overrides.pop(get_current_user, None)


def test_upload_download_delete_roundtrip(investigator_client, db_session, upload_dir):
    client, _ = investigator_client
    fir = _seed_fir(db_session)

    resp = client.post(
        f"{ATTACH}/{fir.id}/attachments",
        files={"file": ("scene-report.pdf", PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 200, resp.text
    records = resp.json()
    assert len(records) == 1

    record = records[0]
    assert record["name"] == "scene-report.pdf"
    assert record["size"] == len(PDF_BYTES)
    assert record["has_file"] is True
    # Internal storage details must be stripped from the response.
    assert "stored_name" not in record
    assert "storage_url" not in record

    # The raw JSON on the FIR still holds the internal field for download.
    db_session.refresh(fir)
    stored = json.loads(fir.attachments)
    assert stored[0]["stored_name"].endswith(".pdf")
    assert (upload_dir / stored[0]["stored_name"]).read_bytes() == PDF_BYTES

    download = client.get(f"{ATTACH}/{fir.id}/attachments/{record['id']}/download")
    assert download.status_code == 200, download.text
    assert download.content == PDF_BYTES

    delete = client.delete(f"{ATTACH}/{fir.id}/attachments/{record['id']}")
    assert delete.status_code == 200, delete.text
    assert delete.json() == []

    db_session.refresh(fir)
    assert json.loads(fir.attachments or "[]") == []
    assert not (upload_dir / stored[0]["stored_name"]).exists()


def test_viewer_cannot_upload(investigator_client, db_session, upload_dir):
    client, _ = investigator_client
    viewer = _make_user(db_session, "fir-att-viewer", "viewer")
    db_session.commit()
    fir = _seed_fir(db_session)

    client.app.dependency_overrides[get_current_user] = lambda: viewer
    resp = client.post(
        f"{ATTACH}/{fir.id}/attachments",
        files={"file": ("scene-report.pdf", PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 403
