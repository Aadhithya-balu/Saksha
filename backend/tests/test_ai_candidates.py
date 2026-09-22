"""Review-gated knowledge candidate tests (issue #269, Phase 2).

Candidates must stay PROPOSED until a reviewer accepts/rejects; acceptance
materializes a real record only when the payload satisfies the target schema;
records are never fabricated from partial data.
"""
import uuid
from datetime import datetime, timezone

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.fir import FIR
from app.models.location import Location
from app.models.role import Role
from app.models.user import User
from app.services.ai_candidate_service import create_candidate

AI_C = "/api/v2/ai/candidates"


def _role(db_session, name, desc):
    role = db_session.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=desc)
        db_session.add(role)
        db_session.flush()
    return role


def _user(db_session, role, username):
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


def _category_location(db_session):
    category = db_session.query(CrimeCategory).filter_by(name="Theft & Burglaries").first()
    if category is None:
        category = CrimeCategory(name="Theft & Burglaries", section_code="IPC 379", severity="medium")
        db_session.add(category)
    location = db_session.query(Location).filter(Location.station == "KR Puram").first()
    if location is None:
        location = Location(district="Bengaluru Urban", station="KR Puram Police Station",
                            latitude=13.0, longitude=77.7)
        db_session.add(location)
    db_session.flush()
    return category, location


def _analyst(client, db_session):
    role = _role(db_session, "crime_analyst", "Crime Analyst")
    user = _user(db_session, role, "candidate-analyst")
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client, user


def _viewer(client, db_session):
    role = _role(db_session, "viewer", "Viewer")
    user = _user(db_session, role, "candidate-viewer")
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client, user


def _propose_case(client, db_session):
    category, location = _category_location(db_session)
    payload = {
        "candidate_type": "CRIME_CASE",
        "source_entity_type": "ai_entity",
        "proposed_payload": {
            "case_number": "CR-2026-0999",
            "category_id": str(category.id),
            "location_id": str(location.id),
            "occurred_at": "2026-09-01T10:00:00",
            "description": "Recorded entry-theft linked to a vehicle plate extracted from a document.",
            "status": "open",
        },
        "confidence": 0.82,
        "provenance": {"provider": "rule_based_ner", "job_type": "NER"},
    }
    r = client.post(AI_C, json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def test_accept_crime_case_candidate_materializes_real_case(client, db_session):
    _analyst(client, db_session)
    created = _propose_case(client, db_session)
    assert created["status"] == "PROPOSED"
    assert created["resolved_record_id"] is None

    r = client.post(f"{AI_C}/{created['id']}/accept", json={"review_note": "matches FIR text"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ACCEPTED"
    assert body["resolved_record_type"] == "CRIME_CASE"
    assert body["reviewed_by_id"] is not None

    case = db_session.query(CrimeCase).filter(CrimeCase.id == uuid.UUID(body["resolved_record_id"])).first()
    assert case is not None
    assert case.case_number == "CR-2026-0999"
    assert case.description.startswith("Recorded entry-theft")

    from app.models.audit_log import AuditLog
    logs = db_session.query(AuditLog).filter(
        AuditLog.resource_type == "AICandidateRecord",
        AuditLog.resource_id == created["id"],
    ).all()
    assert any("accepted" in (log.details or "") for log in logs)


def test_accept_reject_is_idempotent_guard(client, db_session):
    _analyst(client, db_session)
    created = _propose_case(client, db_session)
    assert client.post(f"{AI_C}/{created['id']}/accept", json={}).status_code == 200
    # Re-accepting a settled candidate is rejected with 422, not duplicated.
    r = client.post(f"{AI_C}/{created['id']}/accept", json={})
    assert r.status_code == 422
    assert db_session.query(CrimeCase).filter(CrimeCase.case_number == "CR-2026-0999").count() == 1


def test_accept_rejects_partial_payload_without_fabrication(client, db_session):
    _analyst(client, db_session)
    payload = {
        "candidate_type": "CRIME_CASE",
        "source_entity_type": "ai_entity",
        "proposed_payload": {"description": "Somebody broke in overnight."},
        "confidence": 0.4,
        "provenance": {"provider": "rule_based_ner"},
    }
    r = client.post(AI_C, json=payload)
    assert r.status_code == 200
    cid = r.json()["id"]

    r = client.post(f"{AI_C}/{cid}/accept", json={})
    assert r.status_code == 422  # missing category/location/occurred_at — must not auto-create

    r = client.get(f"{AI_C}/{cid}")
    assert r.json()["status"] == "PROPOSED"
    assert db_session.query(CrimeCase).filter(CrimeCase.description == "Somebody broke in overnight.").count() == 0


def test_accept_fir_candidate_materializes_fir(client, db_session):
    _analyst(client, db_session)
    category, location = _category_location(db_session)
    case = CrimeCase(
        case_number="CR-2026-1000", category_id=category.id, location_id=location.id,
        occurred_at=datetime(2026, 9, 1, tzinfo=timezone.utc), description="docket",
    )
    db_session.add(case)
    db_session.flush()

    payload = {
        "candidate_type": "FIR",
        "source_entity_type": "ingestion_job",
        "proposed_payload": {
            "fir_number": "FIR-045/BNG/2026",
            "crime_case_id": str(case.id),
            "complainant_name": "Smt. Lakshmi",
            "sections": "379",
            "narrative": "Theft reported; vehicle KA-01-AB-1234 implicated.",
        },
        "confidence": 0.78,
        "provenance": {"provider": "rule_based_ner", "job_type": "OCR"},
    }
    r = client.post(AI_C, json=payload)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]

    r = client.post(f"{AI_C}/{cid}/accept", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ACCEPTED"
    assert body["resolved_record_type"] == "FIR"

    fir = db_session.query(FIR).filter(FIR.id == uuid.UUID(body["resolved_record_id"])).first()
    assert fir is not None
    assert fir.fir_number == "FIR-045/BNG/2026"
    assert fir.complainant_name == "Smt. Lakshmi"


def test_reject_candidate(client, db_session):
    _analyst(client, db_session)
    created = _propose_case(client, db_session)
    r = client.post(f"{AI_C}/{created['id']}/reject", json={"review_note": "duplicate of CR-2026-01"})
    assert r.status_code == 200
    assert r.json()["status"] == "REJECTED"
    assert r.json()["review_note"].startswith("duplicate")
    # Nothing materialized.
    assert db_session.query(CrimeCase).filter(CrimeCase.case_number == "CR-2026-0999").count() == 0


def test_viewer_can_browse_but_not_review(client, db_session):
    _viewer(client, db_session)
    assert client.get(AI_C).status_code == 200
    assert client.get(AI_C, params={"status": "PROPOSED"}).json()["items"] == []
    created = _propose_to_db(client, db_session)
    assert client.get(f"{AI_C}/{created.id}").status_code == 200
    assert client.post(AI_C, json={"candidate_type": "CRIME_CASE", "source_entity_type": "x",
                                   "proposed_payload": {}}).status_code == 403
    assert client.post(f"{AI_C}/{created.id}/accept", json={}).status_code == 403
    assert client.post(f"{AI_C}/{created.id}/reject", json={}).status_code == 403


def _propose_to_db(client, db_session):
    category, location = _category_location(db_session)
    return create_candidate(
        db_session,
        candidate_type="CRIME_CASE",
        source_entity_type="ai_entity",
        source_entity_id=None,
        proposed_payload={
            "case_number": "CR-2026-1001",
            "category_id": str(category.id),
            "location_id": str(location.id),
            "occurred_at": "2026-09-02T08:00:00",
            "description": "Another candidate.",
        },
        confidence=0.6,
        provenance={"provider": "rule_based_ner"},
    )