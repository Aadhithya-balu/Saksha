"""Issue 3 — AI Processing lifecycle, RBAC, and path-confinement tests.

Covers:
- Job creation / enqueue / listing / retrieval
- Lifecycle states (QUEUED → COMPLETED / FAILED)
- RBAC: enqueue/retry require ADMIN | INVESTIGATOR | CRIME_ANALYST
- RBAC: read is open to all authenticated roles
- Retry: only FAILED or QUEUED jobs can be retried
- Path confinement: ai_anomaly model_path
- Path confinement: face repository resolve_image_bytes
"""
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_FORENSIC,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    ROLE_VIEWER,
    REVIEW_ROLES,
)
from app.core.security import hash_password
from app.models.ai_processing import AIProcessingJob
from app.models.role import Role
from app.models.user import User

AI = "/api/v2/ai"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _role(db, name: str) -> Role:
    r = db.query(Role).filter_by(name=name).first()
    if r is None:
        r = Role(name=name, description=name.title())
        db.add(r)
        db.flush()
    return r


def _user(db, role_name: str, username: str) -> User:
    u = User(
        username=username,
        email=f"{username}@test.local",
        full_name=username.title(),
        hashed_password=hash_password("Password123!"),
        role_id=_role(db, role_name).id,
        is_active=True,
    )
    db.add(u)
    db.commit()
    return u


def _as(client, user: User):
    client.app.dependency_overrides[get_current_user] = lambda: user


def _clear(client):
    client.app.dependency_overrides.pop(get_current_user, None)


def _spawn_payload(job_type: str = "OCR") -> dict:
    return {
        "target_type": "evidence",
        "target_id": str(uuid.uuid4()),
        "job_type": job_type,
    }


# ---------------------------------------------------------------------------
# Job creation / enqueue
# ---------------------------------------------------------------------------

def test_enqueue_as_admin_creates_queued_job(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "proc-admin")
    _as(client, admin)
    try:
        with patch("app.services.ai_processing_service.threading.Thread"):
            r = client.post(f"{AI}/jobs", json=_spawn_payload())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "QUEUED"
        assert body["job_type"] == "OCR"
        assert body["target_entity_type"] == "evidence"
        assert body["retry_count"] == 0
    finally:
        _clear(client)


def test_enqueue_as_investigator_allowed(client, db_session):
    io = _user(db_session, ROLE_INVESTIGATOR, "proc-io")
    _as(client, io)
    try:
        with patch("app.services.ai_processing_service.threading.Thread"):
            r = client.post(f"{AI}/jobs", json=_spawn_payload())
        assert r.status_code == 200
    finally:
        _clear(client)


def test_enqueue_as_crime_analyst_allowed(client, db_session):
    ca = _user(db_session, ROLE_CRIME_ANALYST, "proc-ca")
    _as(client, ca)
    try:
        with patch("app.services.ai_processing_service.threading.Thread"):
            r = client.post(f"{AI}/jobs", json=_spawn_payload())
        assert r.status_code == 200
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# Unauthorized enqueue
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("role,username", [
    (ROLE_INSPECTOR, "proc-inspector"),
    (ROLE_FORENSIC, "proc-forensic"),
    (ROLE_VIEWER, "proc-viewer"),
    (ROLE_POLICYMAKER, "proc-policy"),
])
def test_enqueue_unauthorized_roles_rejected(client, db_session, role, username):
    u = _user(db_session, role, username)
    _as(client, u)
    try:
        r = client.post(f"{AI}/jobs", json=_spawn_payload())
        assert r.status_code == 403, f"Expected 403 for role={role}, got {r.status_code}"
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# Job listing / retrieval — open to all authenticated roles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("role,username", [
    (ROLE_ADMIN, "read-admin"),
    (ROLE_INVESTIGATOR, "read-io"),
    (ROLE_CRIME_ANALYST, "read-ca"),
    (ROLE_INSPECTOR, "read-insp"),
    (ROLE_FORENSIC, "read-for"),
    (ROLE_VIEWER, "read-viewer"),
])
def test_list_jobs_open_to_all_authenticated(client, db_session, role, username):
    u = _user(db_session, role, username)
    _as(client, u)
    try:
        r = client.get(f"{AI}/jobs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    finally:
        _clear(client)


def test_get_job_by_id(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "getjob-admin")
    _as(client, admin)
    try:
        with patch("app.services.ai_processing_service.threading.Thread"):
            created = client.post(f"{AI}/jobs", json=_spawn_payload()).json()
        r = client.get(f"{AI}/jobs/{created['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == created["id"]
    finally:
        _clear(client)


def test_get_nonexistent_job_returns_404(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "getjob404-admin")
    _as(client, admin)
    try:
        r = client.get(f"{AI}/jobs/{uuid.uuid4()}")
        assert r.status_code == 404
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# Lifecycle states
# ---------------------------------------------------------------------------

def test_job_starts_in_queued_state(db_session):
    from app.services.ai_processing_service import AIProcessingService
    with patch("app.services.ai_processing_service.threading.Thread"):
        job = AIProcessingService.spawn_job(
            db_session, "evidence", uuid.uuid4(), "OCR", background=True
        )
    assert job.status == "QUEUED"
    assert job.retry_count == 0
    assert job.error_details is None


def test_completed_job_visible_in_listing(db_session, client):
    admin = _user(db_session, ROLE_ADMIN, "lifecycle-admin")
    _as(client, admin)
    try:
        job = AIProcessingJob(
            target_entity_type="evidence",
            target_entity_id=uuid.uuid4(),
            job_type="NER",
            status="COMPLETED",
        )
        db_session.add(job)
        db_session.commit()

        r = client.get(f"{AI}/jobs")
        assert r.status_code == 200
        ids = [j["id"] for j in r.json()]
        assert str(job.id) in ids
    finally:
        _clear(client)


def test_failed_job_visible_in_listing(db_session, client):
    admin = _user(db_session, ROLE_ADMIN, "failed-admin")
    _as(client, admin)
    try:
        job = AIProcessingJob(
            target_entity_type="evidence",
            target_entity_id=uuid.uuid4(),
            job_type="VISION",
            status="FAILED",
            error_details="Provider timeout",
        )
        db_session.add(job)
        db_session.commit()

        r = client.get(f"{AI}/jobs/{job.id}")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "FAILED"
        assert body["error_details"] == "Provider timeout"
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# Retry
# ---------------------------------------------------------------------------

def test_retry_failed_job_resets_to_queued(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "retry-admin")
    _as(client, admin)
    try:
        job = AIProcessingJob(
            target_entity_type="evidence",
            target_entity_id=uuid.uuid4(),
            job_type="OCR",
            status="FAILED",
            error_details="timeout",
            retry_count=1,
        )
        db_session.add(job)
        db_session.commit()

        with patch("app.services.ai_processing_service.threading.Thread"):
            r = client.post(f"{AI}/jobs/{job.id}/retry")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "QUEUED"
        assert body["retry_count"] == 2
        assert body["error_details"] is None
    finally:
        _clear(client)


def test_retry_completed_job_returns_400(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "retry400-admin")
    _as(client, admin)
    try:
        job = AIProcessingJob(
            target_entity_type="evidence",
            target_entity_id=uuid.uuid4(),
            job_type="OCR",
            status="COMPLETED",
        )
        db_session.add(job)
        db_session.commit()

        r = client.post(f"{AI}/jobs/{job.id}/retry")
        assert r.status_code == 400
    finally:
        _clear(client)


def test_retry_unauthorized_role_rejected(client, db_session):
    viewer = _user(db_session, ROLE_VIEWER, "retry-viewer")
    _as(client, viewer)
    try:
        job = AIProcessingJob(
            target_entity_type="evidence",
            target_entity_id=uuid.uuid4(),
            job_type="OCR",
            status="FAILED",
        )
        db_session.add(job)
        db_session.commit()

        r = client.post(f"{AI}/jobs/{job.id}/retry")
        assert r.status_code == 403
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# AI Review — REVIEW_ROLES contract
# ---------------------------------------------------------------------------

def test_review_roles_definition():
    """REVIEW_ROLES must include admin, crime_analyst, investigator, inspector."""
    assert ROLE_ADMIN in REVIEW_ROLES
    assert ROLE_CRIME_ANALYST in REVIEW_ROLES
    assert ROLE_INVESTIGATOR in REVIEW_ROLES
    assert ROLE_INSPECTOR in REVIEW_ROLES


def test_verify_match_requires_review_role(client, db_session):
    viewer = _user(db_session, ROLE_VIEWER, "match-viewer")
    _as(client, viewer)
    try:
        r = client.post(
            f"{AI}/matches/{uuid.uuid4()}/verify",
            json={"decision": "CONFIRM"},
        )
        assert r.status_code == 403
    finally:
        _clear(client)


def test_verify_match_allowed_for_review_role(client, db_session):
    """Reviewer gets 404 (no match) not 403 — authorization passes."""
    analyst = _user(db_session, ROLE_CRIME_ANALYST, "match-analyst")
    _as(client, analyst)
    try:
        r = client.post(
            f"{AI}/matches/{uuid.uuid4()}/verify",
            json={"decision": "CONFIRM"},
        )
        assert r.status_code == 404  # authorized but match not found
    finally:
        _clear(client)


def test_forensic_cannot_verify_match(client, db_session):
    forensic = _user(db_session, ROLE_FORENSIC, "match-forensic")
    _as(client, forensic)
    try:
        r = client.post(
            f"{AI}/matches/{uuid.uuid4()}/verify",
            json={"decision": "CONFIRM"},
        )
        assert r.status_code == 403
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# Path confinement — ai_anomaly model_path
# ---------------------------------------------------------------------------

def test_anomaly_valid_model_path_inside_root(client, db_session):
    """A path inside the models root is accepted (may 500 if file absent, not 400)."""
    admin = _user(db_session, ROLE_ADMIN, "anom-admin")
    _as(client, admin)
    try:
        models_root = Path(__file__).resolve().parents[1] / "app" / "models"
        valid_path = str(models_root / "anomaly" / "anomaly_model.json")
        r = client.post(
            f"{AI}/anomaly/detect",
            json={"events": [], "model_path": valid_path},
        )
        # 200 (model loaded) or 500 (file absent) — NOT 400 path rejection
        assert r.status_code in (200, 500), r.text
    finally:
        _clear(client)


def test_anomaly_traversal_path_rejected(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "anom-trav")
    _as(client, admin)
    try:
        r = client.post(
            f"{AI}/anomaly/detect",
            json={"events": [], "model_path": "../../etc/passwd"},
        )
        assert r.status_code == 400
        body = r.json()
        # Response may use {"detail": ...} or {"error": {"message": ...}}
        msg = (body.get("detail") or body.get("error", {}).get("message", "")).lower()
        assert "model" in msg or "path" in msg
    finally:
        _clear(client)


def test_anomaly_absolute_outside_root_rejected(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "anom-abs")
    _as(client, admin)
    try:
        r = client.post(
            f"{AI}/anomaly/detect",
            json={"events": [], "model_path": "C:/Windows/System32/config.json"},
        )
        assert r.status_code == 400
    finally:
        _clear(client)


def test_anomaly_non_json_extension_rejected(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "anom-ext")
    _as(client, admin)
    try:
        models_root = Path(__file__).resolve().parents[1] / "app" / "models"
        bad_path = str(models_root / "anomaly" / "model.pkl")
        r = client.post(
            f"{AI}/anomaly/detect",
            json={"events": [], "model_path": bad_path},
        )
        assert r.status_code == 400
        body = r.json()
        msg = body.get("detail") or body.get("error", {}).get("message", "")
        assert ".json" in msg
    finally:
        _clear(client)


def test_anomaly_no_model_path_uses_default(client, db_session):
    admin = _user(db_session, ROLE_ADMIN, "anom-default")
    _as(client, admin)
    try:
        r = client.post(f"{AI}/anomaly/detect", json={"events": []})
        assert r.status_code == 200
        body = r.json()
        assert "alerts" in body
        assert body["alerts"] == []
    finally:
        _clear(client)


def test_anomaly_unauthorized_role_rejected(client, db_session):
    viewer = _user(db_session, ROLE_VIEWER, "anom-viewer")
    _as(client, viewer)
    try:
        r = client.post(f"{AI}/anomaly/detect", json={"events": []})
        assert r.status_code == 403
    finally:
        _clear(client)


# ---------------------------------------------------------------------------
# Path confinement — face repository resolve_image_bytes
# ---------------------------------------------------------------------------

def test_face_repo_traversal_ref_returns_none():
    from app.ai.face.repository import resolve_image_bytes
    assert resolve_image_bytes("../../../etc/passwd") is None


def test_face_repo_unknown_person_returns_none():
    from app.ai.face.repository import resolve_image_bytes
    assert resolve_image_bytes("UNKNOWN-999/frontal") is None


def test_face_repo_no_slash_returns_none():
    from app.ai.face.repository import resolve_image_bytes
    assert resolve_image_bytes("DEMO-001") is None


def test_face_repo_empty_var_returns_none():
    from app.ai.face.repository import resolve_image_bytes
    assert resolve_image_bytes("DEMO-001/") is None


def test_face_repo_path_separator_in_var_is_stripped():
    """Path traversal in var is confined: only the last component is used.

    DEMO-001/../../other/frontal → var stripped to 'frontal' → resolves to
    DEMO-001/frontal.png (inside the person dir), never to 'other/frontal'.
    The confinement guarantee is that the resolved path stays under the
    person's own directory — not that it returns None.
    """
    from app.ai.face.repository import resolve_image_bytes, _DEMO_IDS
    import os
    from app.ai.face import synthetic

    # Verify the person is a known DEMO identity (confinement gate 1)
    assert "DEMO-001" in _DEMO_IDS

    # A crafted var with traversal components must resolve to the same bytes
    # as the plain 'frontal' ref — proving it was stripped to the last component
    # and never escaped to a different directory.
    traversal_result = resolve_image_bytes("DEMO-001/../../other/frontal")
    plain_result = resolve_image_bytes("DEMO-001/frontal")
    # Both must be identical (both resolve to DEMO-001/frontal.png)
    assert traversal_result == plain_result
