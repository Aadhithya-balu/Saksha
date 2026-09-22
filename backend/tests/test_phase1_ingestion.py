"""Phase 1 (issue #269) ingestion tests: lifecycle, provenance, API, RBAC.

These cover *universal* ingestion (``/api/v2/ingestion``), which is distinct
from the existing data-import pipeline (/data-import) that reconciles tabular
rows into live records.
"""
import io
import json
import uuid
from datetime import datetime

import pytest
from fastapi import UploadFile

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.ingestion import DataSource, IngestionJob
from app.models.role import Role
from app.models.user import User
from app.services.ingestion.ingestion_service import _store_artifact, process_ingestion_job

ING = "/api/v2/ingestion"


def _pdf_bytes() -> bytes:
    """A minimal, structurally valid single-page PDF with searchable text."""
    objects: list[bytes] = [b"", b"<</Type/Catalog/Pages 2 0 R>>"]
    objects.append(b"<</Type/Pages/Kids[3 0 R]/Count 1>>")
    objects.append(
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>"
    )
    stream = b"BT /F1 24 Tf 100 700 Td (SUSPECT RAJU seen near gateway. Vehicle KA-01-AB-1234.) Tj ET"
    objects.append(b"<</Length %d>>stream\n" % len(stream) + stream + b"\nendstream")
    objects.append(b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>")

    body = bytearray()
    offsets = []
    for obj_num in range(1, len(objects)):
        offsets.append(len(body))
        body.extend(f"{obj_num} 0 obj\n".encode())
        body.extend(objects[obj_num])
        body.extend(b"\nendobj\n")
    xref_pos = len(body)
    body.extend(f"xref\n0 {len(objects)}\n".encode())
    body.extend(b"0000000000 65535 f \n")
    for off in offsets:
        body.extend(f"{off:010d} 00000 n \n".encode())
    body.extend(f"trailer<</Size {len(objects)}/Root 1 0 R>>\nstartxref\n{xref_pos}\n%%EOF\n".encode())
    return bytes(body)


def _in_memory_upload(filename: str, data: bytes):
    uf = UploadFile(filename=filename, file=io.BytesIO(data))
    return uf


def _base_job(user, *, kind="csv", filename="data.csv", data=b"", storage_ref=None):
    path = None
    if storage_ref is None and data:
        uf = _in_memory_upload(filename, data)
        path, ref, size = _store_artifact(uf, uuid.uuid4())
        storage_ref = ref
    else:
        size = 0
    return IngestionJob(
        id=uuid.uuid4(),
        status="RECEIVED",
        artifact_kind=kind,
        original_filename=filename,
        storage_ref=storage_ref,
        mime_type=None,
        size_bytes=size,
        content_hash="unit-hash",
        provenance={"origin": "unit", "jurisdiction": {"state": "Karnataka"}},
        created_by_id=user.id,
        received_at=datetime.utcnow(),
    ), path


def _make_role(db_session, name: str, desc: str):
    role = db_session.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=desc)
        db_session.add(role)
        db_session.flush()
    return role


def _make_user(db_session, role, username: str):
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.title().replace("-", " "),
        hashed_password=hash_password("Password123!"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def analyst(client, db_session):
    role = _make_role(db_session, "crime_analyst", "Crime Analyst")
    user = _make_user(db_session, role, "phase1-analyst")
    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client, user
    client.app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------- lifecycle
def test_csv_normalizes_and_completes(db_session, analyst):
    _, user = analyst
    job, _ = _base_job(user, kind="csv", filename="data.csv",
                       data=b"\xef\xbb\xbfname,age\nRaju,34\nMohan,29\n")
    db_session.add(job)
    db_session.commit()

    process_ingestion_job(job.id, session=db_session)
    db_session.refresh(job)
    assert job.status == "COMPLETED"
    assert job.record_count == 2
    assert job.normalized_payload["headers"] == ["name", "age"]
    assert job.parsed_metadata["row_count"] == 2


def test_pdf_extracts_ai_eligible_text(db_session, analyst):
    _, user = analyst
    job, _ = _base_job(user, kind="document", filename="scan.pdf", data=_pdf_bytes())
    db_session.add(job)
    db_session.commit()

    process_ingestion_job(job.id, session=db_session)
    db_session.refresh(job)
    assert job.status == "COMPLETED"
    assert job.parsed_metadata["format"] == "pdf"
    assert "RAJU" in job.normalized_payload["text"]
    # Phase 2 handoff happened: an AI job processed the artifact's text.
    assert job.ai_job_spawned is True
    assert job.ai_job_id is not None
    from app.models.ai_processing import AIEntity, AIProcessingJob

    ai_job = db_session.query(AIProcessingJob).filter(AIProcessingJob.id == job.ai_job_id).first()
    assert ai_job is not None
    assert ai_job.target_entity_type == "ingestion_job"
    assert ai_job.status in ("COMPLETED", "REQUIRES_REVIEW")
    entities = db_session.query(AIEntity).filter(
        AIEntity.source_entity_type == "ingestion_job",
        AIEntity.source_entity_id == job.id,
    ).all()
    assert any(e.entity_type == "VEHICLE" for e in entities)
    assert all(e.verification_status == "PENDING" for e in entities)


def test_structured_kind_without_file_completes_stateless(db_session, analyst):
    _, user = analyst
    job, _ = _base_job(user, kind="json", filename=None)
    job.storage_ref = None
    db_session.add(job)
    db_session.commit()
    process_ingestion_job(job.id, session=db_session)
    db_session.refresh(job)
    assert job.status == "COMPLETED"


# ---------------------------------------------------------------------- API
def test_upload_txt_via_api_then_pipeline(analyst, db_session):
    c, _ = analyst
    r = c.post(
        f"{ING}/upload",
        files={"file": ("narration.txt", b"A masked man fled with jewellery.\n", "text/plain")},
        data={"jurisdiction": json.dumps({"state": "Karnataka", "legal_framework": "BNS-2023"}), "origin": "demo"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "RECEIVED"
    assert body["artifact_kind"] == "document"
    assert body["content_hash"]
    assert "provenance" not in body  # detail endpoint carries provenance, not the list view

    job = db_session.query(IngestionJob).filter(IngestionJob.id == uuid.UUID(body["id"])).first()
    process_ingestion_job(job.id, session=db_session)
    db_session.refresh(job)
    assert job.status == "COMPLETED"
    assert job.record_count == 1
    assert job.parsed_metadata["format"] == "text"
    assert job.ai_job_spawned is True
    assert job.ai_job_id is not None


def test_provenance_endpoint_hides_storage(analyst):
    c, _ = analyst
    r = c.post(
        f"{ING}/upload",
        files={"file": ("evidence.csv", b"full_name,gender\nDeepak,Male\n", "text/csv")},
        data={"jurisdiction": json.dumps({"district": "Bengaluru"}), "origin": "department-export"},
    )
    assert r.status_code == 200, r.text
    job_id = r.json()["id"]

    p = c.get(f"{ING}/jobs/{job_id}")
    assert p.status_code == 200, p.text
    assert "storage_ref" not in p.json()

    prov = c.get(f"{ING}/jobs/{job_id}/provenance")
    assert prov.status_code == 200, prov.text
    body = prov.json()
    assert body["provenance"]["origin"] == "department-export"
    assert body["provenance"]["jurisdiction"]["district"] == "Bengaluru"
    assert body["content_hash"]
    serialized = json.dumps(body)
    assert "storage" not in serialized
    assert "uploads" not in serialized


def test_source_crud_rbac(analyst, db_session):
    c, _ = analyst
    r = c.post(
        f"{ING}/sources",
        json={"name": "CCTNS Regional Feed", "source_type": "API", "jurisdiction": {"state": "Karnataka"}},
    )
    assert r.status_code == 200, r.text
    src = r.json()
    assert src["name"] == "CCTNS Regional Feed"

    lst = c.get(f"{ING}/sources")
    assert lst.status_code == 200
    assert any(s["id"] == src["id"] for s in lst.json())

    upd = c.put(f"{ING}/sources/{src['id']}", json={"description": "hourly pull"})
    assert upd.status_code == 200
    assert upd.json()["description"] == "hourly pull"

    kinds = c.get(f"{ING}/kinds")
    assert kinds.status_code == 200
    by_value = {k["value"]: k for k in kinds.json()}
    assert by_value["document"]["ai_eligible"] is True
    assert by_value["csv"]["ai_eligible"] is False

    statuses = c.get(f"{ING}/jobs/status")
    assert statuses.status_code == 200
    assert set(statuses.json()) >= {"total", "received", "ready_for_ai", "failed"}


def test_viewer_cannot_upload_or_manage_sources(client, db_session):
    role = _make_role(db_session, "viewer", "Viewer")
    viewer = _make_user(db_session, role, "phase1-viewer")
    client.app.dependency_overrides[get_current_user] = lambda: viewer
    try:
        up = client.post(
            f"{ING}/upload",
            files={"file": ("x.txt", b"hello", "text/plain")},
        )
        assert up.status_code == 403
        src = client.post(f"{ING}/sources", json={"name": "nope", "source_type": "MANUAL"})
        assert src.status_code == 403
        # Read surfaces remain visible to every authenticated role.
        assert client.get(f"{ING}/kinds").status_code == 200
        assert client.get(f"{ING}/jobs").status_code == 200
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_manual_job_completes_immediately(analyst):
    c, _ = analyst
    r = c.post(
        f"{ING}/jobs/manual",
        data={
            "artifact_kind": "manual",
            "manifest": json.dumps({"case_number": "CR-LOCAL-1", "note": "field interview"}),
            "jurisdiction": json.dumps({"district": "Mysuru"}),
            "origin": "officer-entry",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "COMPLETED"
    d = c.get(f"{ING}/jobs/{body['id']}").json()
    assert d["normalized_payload"]["case_number"] == "CR-LOCAL-1"
    assert d["ai_job_spawned"] is False


def test_rejects_html_masquerade(client, db_session):
    role = _make_role(db_session, "investigator", "Investigator")
    user = _make_user(db_session, role, "phase1-io")
    client.app.dependency_overrides[get_current_user] = lambda: user
    try:
        r = client.post(
            f"{ING}/upload",
            files={"file": ("notes.txt", b"<html><script>alert(1)</script></html>", "text/plain")},
        )
        assert r.status_code == 400
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_identical_content_yields_identical_hash(analyst):
    c, _ = analyst
    payload = b"Ka-01-AB-1234 spotted near KR Puram market.\n"
    r1 = c.post(f"{ING}/upload", files={"file": ("a.txt", payload, "text/plain")})
    r2 = c.post(f"{ING}/upload", files={"file": ("b.txt", payload, "text/plain")})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["content_hash"] == r2.json()["content_hash"]