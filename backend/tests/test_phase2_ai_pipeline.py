"""Phase 2 hardening (issue #269) tests: local providers + hardened /ai routes.

Covers the honest-provider pipeline (no fabricated OCR/vision output) and the
RBAC'd, audited AI processing API.
"""
import io
import uuid
from datetime import datetime

import pytest

from app.ai.providers.local_providers import (
    LocalTextOCRProvider,
    OpenCVVisionProvider,
    RuleBasedNERProvider,
)
from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.ingestion import IngestionJob
from app.models.role import Role
from app.models.user import User
from app.services.ingestion.ingestion_service import process_ingestion_job

AI = "/api/v2/ai"
ING = "/api/v2/ingestion"


def _pdf_bytes() -> bytes:
    stream = b"BT /F1 24 Tf 100 700 Td (Mr. Raju Kumar with KA-01-AB-1234 and phone 9876543210.) Tj ET"
    objs = [b"", b"<</Type/Catalog/Pages 2 0 R>>", b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
            b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
            b"<</Length %d>>stream\n" % len(stream) + stream + b"\nendstream",
            b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"]
    body = bytearray()
    offsets = []
    for n in range(1, len(objs)):
        offsets.append(len(body))
        body.extend(f"{n} 0 obj\n".encode() + objs[n] + b"\nendobj\n")
    xref = len(body)
    body.extend(f"xref\n0 {len(objs)}\n".encode() + b"0000000000 65535 f \n")
    for off in offsets:
        body.extend(f"{off:010d} 00000 n \n".encode())
    body.extend(f"trailer<</Size {len(objs)}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(body)


def _png_bytes() -> bytes:
    import struct
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = zlib.compress(b"\x00\x00\x00\x00")
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


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
    user = _make_user(db_session, role, "phase2-analyst")
    client.app.dependency_overrides[get_current_user] = lambda: user
    yield client, user
    client.app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------- providers
def test_local_text_ocr_extracts_real_pdf_text():
    import asyncio

    provider = LocalTextOCRProvider()
    results = asyncio.run(provider.process_document(_pdf_bytes(), "scan.pdf"))
    assert len(results) == 1
    assert "Raju" in results[0].raw_text
    assert results[0].provider == "local_text_ocr"


def test_local_text_ocr_image_returns_nothing():
    import asyncio

    provider = LocalTextOCRProvider()
    assert asyncio.run(provider.process_document(_png_bytes(), "photo.png")) == []


def test_rule_based_ner_extracts_reviewable_entities():
    import asyncio

    provider = RuleBasedNERProvider()
    entities = asyncio.run(provider.extract_entities(
        "Mr. Raju Kumar arrived with Rs. 50000. Vehicle KA-01-AB-1234. Phone 9876543210."
    ))
    types = {e.entity_type for e in entities}
    assert "PERSON" in types
    assert "VEHICLE" in types
    assert "PHONE_NUMBER" in types
    assert "MONEY" in types
    vehicle = next(e for e in entities if e.entity_type == "VEHICLE")
    assert vehicle.attributes["value"] == "KA-01-AB-1234"


def test_opencv_vision_no_fabricated_detections():
    import asyncio

    provider = OpenCVVisionProvider()
    # A blank PNG has no faces → no events. Never invent a PERSON_DETECTED.
    assert asyncio.run(provider.process_media(_png_bytes(), "photo.png")) == []


# --------------------------------------------------------- full pipeline + api
def test_full_ingestion_to_ai_results_via_storage(db_session, analyst):
    c, user = analyst
    from fastapi import UploadFile

    from app.services.ingestion.ingestion_service import _store_artifact

    uf = UploadFile(filename="scan.pdf", file=io.BytesIO(_pdf_bytes()))
    path, ref, size = _store_artifact(uf, uuid.uuid4())
    job = IngestionJob(
        id=uuid.uuid4(), status="RECEIVED", artifact_kind="document",
        original_filename="scan.pdf", storage_ref=ref, mime_type="application/pdf",
        size_bytes=size, content_hash="hash", provenance={"origin": "test"},
        created_by_id=user.id, received_at=datetime.utcnow(),
    )
    db_session.add(job)
    db_session.commit()
    process_ingestion_job(job.id, session=db_session)
    db_session.refresh(job)
    assert job.status == "COMPLETED"
    assert job.ai_job_id is not None

    # Read surfaces for the hardened /ai routes.
    ai_job_resp = c.get(f"{AI}/jobs/{job.ai_job_id}")
    assert ai_job_resp.status_code == 200, ai_job_resp.text
    assert ai_job_resp.json()["target_entity_type"] == "ingestion_job"

    results = c.get(f"{AI}/jobs/{job.ai_job_id}/results")
    assert results.status_code == 200, results.text
    body = results.json()
    assert any("Raju" in o["raw_text"] for o in body["ocr_results"])
    assert any(e["entity_type"] == "VEHICLE" for e in body["entities"])
    assert body["status"] in ("COMPLETED", "REQUIRES_REVIEW")

    entities = c.get(f"{AI}/jobs/{job.ai_job_id}/entities")
    assert entities.status_code == 200, entities.text
    assert any(e["verification_status"] == "PENDING" for e in entities.json())

    jobs = c.get(f"{AI}/jobs")
    assert jobs.status_code == 200
    assert any(j["id"] == str(job.ai_job_id) for j in jobs.json())


def test_ai_spawn_and_verify_require_review_roles(client, db_session):
    role = _make_role(db_session, "viewer", "Viewer")
    viewer = _make_user(db_session, role, "phase2-viewer")
    client.app.dependency_overrides[get_current_user] = lambda: viewer
    try:
        assert client.get(f"{AI}/jobs").status_code == 200
        assert client.post(
            f"{AI}/jobs",
            json={"target_type": "ingestion_job", "target_id": str(uuid.uuid4()), "job_type": "OCR"},
        ).status_code == 403
        assert client.get(f"{AI}/matches").status_code == 200
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_matches_list_supports_status_filter(client, db_session):
    role = _make_role(db_session, "crime_analyst", "Crime Analyst")
    user = _make_user(db_session, role, "phase2-matches")
    client.app.dependency_overrides[get_current_user] = lambda: user
    try:
        r = client.get(f"{AI}/matches", params={"status_filter": "PENDING"})
        assert r.status_code == 200
        assert r.json() == []
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)