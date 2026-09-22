"""
Tests for Phase 4: Investigation Workspace & Evidence / Forensics.
Covers:
- Case Dossier & Enriched Entities (Vehicles, Locations, Organizations, Digital Accounts)
- Traceable Timeline with Evidence & Custody references
- Network Graph endpoint for case
- Evidence Vault SHA-256 Hashing and Integrity Verification
- Chain of Custody transfers
- Forensic Report creation, Human Verification gate, and Certified PDF Export
"""
import io
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.chain_of_custody import ChainOfCustody
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.evidence import Evidence
from app.models.evidence_metadata import EvidenceMetadata
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.forensic_report import ForensicReport
from app.models.location import Location
from app.models.officer import Officer
from app.models.role import Role
from app.models.user import User
from app.services.evidence_service import compute_file_sha256


def _get_or_create_role(db, role_name: str) -> Role:
    role = db.query(Role).filter_by(name=role_name).first()
    if not role:
        role = Role(name=role_name, description=f"{role_name} role")
        db.add(role)
        db.flush()
    return role


def _create_user(db, username: str, role_name: str, district: str = "Bengaluru Urban") -> User:
    role = _get_or_create_role(db, role_name)
    user = User(
        username=username,
        email=f"{username}@ksp.gov.in",
        full_name=username.replace("_", " ").title(),
        hashed_password=hash_password("Pass123!"),
        role_id=role.id,
        is_active=True,
        district=district,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def test_setup(client, db_session):
    # Create test investigator user with inspector role
    investigator = _create_user(db_session, "insp_kamat", "inspector")
    officer = Officer(
        badge_number="KA-INSP-1092",
        name="Inspector Kamat",
        rank="Inspector of Police",
        station="Indiranagar PS",
        user_id=investigator.id,
    )
    db_session.add(officer)

    # Category & Location
    cat = CrimeCategory(name="Armed Robbery", section_code="IPC 392", severity="critical")
    loc = Location(district="Bengaluru Urban", station="Indiranagar PS", address="100 Feet Rd, Indiranagar", latitude=12.9784, longitude=77.6408)
    db_session.add_all([cat, loc])
    db_session.flush()

    # Case
    case = CrimeCase(
        case_number="CC-BLR-2026-0042",
        description="Armed robbery targeting jewelry store by syndicate with KA-01-AB-1234 getaway car",
        mo_tags="night_operation, getaway_vehicle, armed",
        category_id=cat.id,
        location_id=loc.id,
        assigned_officer_id=officer.id,
        occurred_at=datetime.now(timezone.utc) - timedelta(days=2),
        reported_at=datetime.now(timezone.utc) - timedelta(days=1),
        status="under_investigation",
        priority="high",
        progress=45,
    )
    db_session.add(case)
    db_session.flush()

    # FIR
    fir = FIR(
        fir_number="FIR-IND-2026-0101",
        crime_case_id=case.id,
        investigating_officer_id=officer.id,
        complainant_name="Rajesh Sharma",
        complainant_contact="+91-9880011223",
        sections="IPC 392, IPC 397",
        status="registered",
        narrative="Suspect fled in a White Swift KA-01-AB-1234 towards Koramangala.",
        filed_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db_session.add(fir)
    db_session.flush()

    # Criminal
    criminal = Criminal(
        full_name="Ramesh Kumar",
        aliases="Snake Ramesh",
        status="at_large",
        mo_summary="Uses stolen Swift getaway car for jewelry heists with accomplice contact +91-9876543210",
        gang_affiliation="North Bangalore Syndicate",
    )
    db_session.add(criminal)
    db_session.flush()

    # Link criminal to FIR
    link = FIRCriminalLink(fir_id=fir.id, criminal_id=criminal.id, role="accused")
    db_session.add(link)

    # Evidence with a physical file for SHA-256 test
    dummy_content = b"EVIDENCE FILE DATA: CUSTODY SAMPLE CONTENT 2026"
    test_dir = os.path.join(os.getcwd(), "uploads", "test")
    os.makedirs(test_dir, exist_ok=True)
    test_file_path = os.path.join(test_dir, f"evidence_{uuid.uuid4().hex[:8]}.dat")
    with open(test_file_path, "wb") as f:
        f.write(dummy_content)
    test_sha256 = compute_file_sha256(test_file_path)

    evidence = Evidence(
        title="Store CCTV Footage DVR",
        evidence_type="cctv_footage",
        status="collected",
        case_id=case.id,
        created_by="Inspector Kamat",
        storage_path=test_file_path,
    )
    db_session.add(evidence)
    db_session.flush()

    # Metadata with sha256_hash
    meta = EvidenceMetadata(
        evidence_id=evidence.id,
        filename=os.path.basename(test_file_path),
        filepath=test_file_path,
        filesize=len(dummy_content),
        mime_type="video/mp4",
        storage_url=f"/uploads/test/{os.path.basename(test_file_path)}",
        extracted_data={"sha256_hash": test_sha256, "notes": "Initial seizure DVR"},
    )
    db_session.add(meta)

    # Initial chain of custody
    custody = ChainOfCustody(
        evidence_id=evidence.id,
        from_user=investigator.id,
        to_user=investigator.id,
        action="COLLECTED",
        location="Crime Scene Store Room",
        remarks="Initial seizure from scene",
        timestamp=datetime.now(timezone.utc) - timedelta(hours=12),
    )
    db_session.add(custody)

    db_session.commit()

    # Override auth dependency
    client.app.dependency_overrides[get_current_user] = lambda: investigator

    yield {
        "client": client,
        "db": db_session,
        "investigator": investigator,
        "officer": officer,
        "case": case,
        "fir": fir,
        "criminal": criminal,
        "evidence": evidence,
        "test_file_path": test_file_path,
        "test_sha256": test_sha256,
    }

    # Cleanup
    client.app.dependency_overrides.pop(get_current_user, None)
    if os.path.exists(test_file_path):
        try:
            os.remove(test_file_path)
        except OSError:
            pass


def test_investigation_dossier_and_entities(test_setup):
    """Verifies the unified investigation dashboard returns enriched entities and logs CASE_VIEW."""
    client = test_setup["client"]
    case_id = test_setup["case"].id
    db = test_setup["db"]

    resp = client.get(f"/api/v2/investigation/{case_id}")
    assert resp.status_code == 200
    data = resp.json()

    # Verify case details
    assert data["case"]["case_number"] == "CC-BLR-2026-0042"
    assert data["case"]["district"] == "Bengaluru Urban"
    assert data["case"]["station"] == "Indiranagar PS"
    assert data["case"]["crime_type"] == "Armed Robbery"

    # Verify entity extraction: Vehicle KA-01-AB-1234 from narrative/description
    assert len(data["vehicles"]) >= 1
    vehicle_regs = [v["registration"] for v in data["vehicles"]]
    assert "KA-01-AB-1234" in vehicle_regs

    # Verify timeline traceability
    assert len(data["timeline"]) >= 1
    events = data["timeline"]
    sources = [e.get("source") for e in events]
    assert any("Evidence" in str(s) or "FIR" in str(s) or "Case" in str(s) for s in sources)

    # Verify audit log recorded CASE_VIEW
    log = db.query(AuditLog).filter_by(action="CASE_VIEW", resource_id=str(case_id)).first()
    assert log is not None


def test_investigation_timeline_endpoint(test_setup):
    """Verifies the standalone timeline endpoint returns traceable events."""
    client = test_setup["client"]
    case_id = test_setup["case"].id

    resp = client.get(f"/api/v2/investigation/{case_id}/timeline")
    assert resp.status_code == 200
    timeline = resp.json()
    assert isinstance(timeline, list)
    assert len(timeline) >= 1
    assert "timestamp" in timeline[0]
    assert "event" in timeline[0]
    assert "source" in timeline[0]


def test_case_network_graph_endpoint(test_setup):
    """Verifies the case-centered graph endpoint returns nodes and links."""
    client = test_setup["client"]
    case_id = test_setup["case"].id
    fir_id = test_setup["fir"].id

    resp = client.get(f"/api/v2/network/case/{case_id}")
    assert resp.status_code == 200
    graph = resp.json()
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) >= 1
    node_ids = [n["id"] for n in graph["nodes"]]
    assert any(str(fir_id) in nid or str(case_id) in nid for nid in node_ids)


def test_evidence_hash_verification(test_setup):
    """Verifies SHA-256 cryptographic integrity verification."""
    client = test_setup["client"]
    evidence_id = test_setup["evidence"].id
    expected_hash = test_setup["test_sha256"]

    # Verify hash via endpoint
    resp = client.post(f"/api/v2/evidence/{evidence_id}/verify-hash")
    assert resp.status_code == 200
    result = resp.json()

    assert result["verified"] is True
    assert result["recorded_hash"] == expected_hash
    assert result["current_hash"] == expected_hash
    assert "verified" in result["message"].lower() or "matches" in result["message"].lower()


def test_evidence_custody_transfer(test_setup):
    """Verifies chain of custody transfer recording."""
    client = test_setup["client"]
    evidence_id = test_setup["evidence"].id

    payload = {
        "to_user": test_setup["investigator"].username,
        "action": "TRANSFERRED_TO_LAB",
        "to_state": "In Forensic Lab",
        "location": "State Forensic Science Laboratory (SFSL) Madiwala",
        "reason": "Forensic video enhancement and DVR extraction in sealed tamper-evident bag #KA-9912",
    }
    resp = client.post(f"/api/v2/evidence/{evidence_id}/custody/transfer", json=payload)
    assert resp.status_code == 200
    res = resp.json()
    assert res["action"] == "TRANSFERRED_TO_LAB"
    assert res["location"] == "State Forensic Science Laboratory (SFSL) Madiwala"

    # Check that the transfer appears in the evidence's custody logs
    db = test_setup["db"]
    transfers = db.query(ChainOfCustody).filter_by(evidence_id=evidence_id).all()
    assert len(transfers) >= 2
    latest = transfers[-1]
    assert latest.location == "State Forensic Science Laboratory (SFSL) Madiwala"
    assert latest.action == "TRANSFERRED_TO_LAB"


def test_forensic_report_lifecycle_and_pdf_export(test_setup):
    """Verifies forensic report creation, human verification gate, and certified PDF export."""
    client = test_setup["client"]
    case_id = test_setup["case"].id
    evidence_id = test_setup["evidence"].id
    db = test_setup["db"]

    # 1. Create Forensic Report
    create_payload = {
        "case_id": str(case_id),
        "evidence_id": str(evidence_id),
        "title": "SFSL Video Enhancement & Plate Recognition",
        "forensic_type": "digital",
        "examiner_name": "Dr. V. Rao",
        "lab_name": "State Forensic Science Laboratory, Karnataka Police",
        "ai_assisted": True,
        "ai_notes": "Saksha AI Vision v2.4 suggested license plate match with 0.94 confidence.",
        "findings": "Enhancement revealed license plate KA-01-AB-1234 with high clarity on rear bumper.",
        "methodology": "Frame de-interlacing, super-resolution filter, contrast equalization.",
    }
    resp = client.post("/api/v2/forensics", json=create_payload)
    assert resp.status_code == 201
    report_data = resp.json()
    report_id = report_data["id"]

    # Check human verification safeguards: newly created report must NOT have verified_by
    assert report_data["verified_by"] is None
    assert report_data["verified_at"] is None
    assert report_data["ai_assisted"] is True

    # 2. Human Verification Gate (Officer Sign-Off)
    verify_payload = {
        "status": "verified",
        "verification_notes": "Independently verified frame enhancements and corroborated with regional RTO database.",
    }
    verify_resp = client.post(f"/api/v2/forensics/{report_id}/verify", json=verify_payload)
    assert verify_resp.status_code == 200
    verified_data = verify_resp.json()
    assert verified_data["status"] == "verified"
    assert verified_data["verified_by"] is not None
    assert verified_data["verified_at"] is not None

    # 3. Certified PDF Export
    pdf_resp = client.get(f"/api/v2/forensics/{report_id}/export")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in pdf_resp.headers["content-disposition"]
    # Verify PDF magic bytes '%PDF'
    assert pdf_resp.content.startswith(b"%PDF")


def test_evidence_lifecycle_district_denied(test_setup):
    """Cross-district district-bound users are denied evidence item-level endpoints.

    Issue #275 §11: evidence access must respect jurisdiction server-side, not
    via frontend hiding. All Phase-4 add-ons (verify-hash, custody transfer,
    preview) plus the pre-existing item endpoints must fail closed.
    """
    client = test_setup["client"]
    db = test_setup["db"]
    evidence_id = test_setup["evidence"].id

    outsider = _create_user(db, "io_mysuru", "investigator", district="Mysuru")
    db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: outsider
    try:
        # detail read
        assert client.get(f"/api/v2/evidence/{evidence_id}").status_code == 403
        # SHA-256 verify (Phase 4)
        assert client.post(f"/api/v2/evidence/{evidence_id}/verify-hash").status_code == 403
        # chain of custody transfer (Phase 4)
        transfer = {"to_user": outsider.username, "action": "TRANSFERRED_TO_LAB", "location": "SFSL", "reason": "x"}
        assert client.post(f"/api/v2/evidence/{evidence_id}/custody/transfer", json=transfer).status_code == 403
        # safe preview (Phase 4)
        assert client.get(f"/api/v2/evidence/{evidence_id}/preview").status_code == 403
        # upload / download / summary
        assert client.get(f"/api/v2/evidence/{evidence_id}/download?format=pdf").status_code == 403
        files = {"file": ("exhibit.bin", b"data", "application/octet-stream")}
        assert client.post(f"/api/v2/evidence/{evidence_id}/upload", files=files).status_code == 403
        assert client.post(f"/api/v2/evidence/{evidence_id}/summary").status_code == 403
        # assign
        assert client.post(f"/api/v2/evidence/{evidence_id}/assign", params={"assigned_to": outsider.username}).status_code == 403
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_evidence_preview_inline_local_file(test_setup):
    """Same-district users can preview a locally stored evidence file inline."""
    client = test_setup["client"]
    db = test_setup["db"]
    evidence_id = test_setup["evidence"].id

    meta = db.query(EvidenceMetadata).filter_by(evidence_id=evidence_id).first()
    original_url = meta.storage_url
    meta.storage_url = None  # force local inline serving path
    db.commit()
    try:
        resp = client.get(f"/api/v2/evidence/{evidence_id}/preview")
        assert resp.status_code == 200
        assert resp.content == b"EVIDENCE FILE DATA: CUSTODY SAMPLE CONTENT 2026"
        assert resp.headers.get("content-type") == "video/mp4"
    finally:
        meta.storage_url = original_url
        db.commit()


def test_evidence_raw_download_local(test_setup):
    """Same-district users can fetch the raw evidence bytes for verified exhibits."""
    client = test_setup["client"]
    db = test_setup["db"]
    evidence_id = test_setup["evidence"].id

    meta = db.query(EvidenceMetadata).filter_by(evidence_id=evidence_id).first()
    original_url = meta.storage_url
    meta.storage_url = None  # force local file serving path
    db.commit()
    try:
        resp = client.get(f"/api/v2/evidence/{evidence_id}/download?format=raw")
        assert resp.status_code == 200
        assert resp.content == b"EVIDENCE FILE DATA: CUSTODY SAMPLE CONTENT 2026"
    finally:
        meta.storage_url = original_url
        db.commit()


def test_network_graph_cross_district_not_disclosed(test_setup):
    """District-bound users get no cross-district nodes from case/person graphs.

    AGENTS.md: network graphs filter incidents to the user's district so bound
    roles cannot discover links outside their jurisdiction.
    """
    client = test_setup["client"]
    db = test_setup["db"]
    case_id = test_setup["case"].id
    fir_id = test_setup["fir"].id
    criminal_id = test_setup["criminal"].id

    outsider = _create_user(db, "io_mysuru2", "investigator", district="Mysuru")
    db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: outsider
    try:
        case_graph = client.get(f"/api/v2/network/case/{case_id}")
        assert case_graph.status_code == 200
        node_ids = [n["id"] for n in case_graph.json().get("nodes", [])]
        assert not any(str(fir_id) in nid or str(case_id) in nid for nid in node_ids)

        person_graph = client.get(f"/api/v2/network/person/{criminal_id}")
        assert person_graph.status_code == 200
        pnode_ids = [n["id"] for n in person_graph.json().get("nodes", [])]
        assert not any(str(criminal_id) in nid for nid in pnode_ids)
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_forensics_cross_district_denied(test_setup):
    """Cross-district district-bound users are denied forensic create/list endpoints."""
    client = test_setup["client"]
    db = test_setup["db"]
    case_id = test_setup["case"].id
    evidence_id = test_setup["evidence"].id

    outsider = _create_user(db, "for_mysuru", "forensic", district="Mysuru")
    db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: outsider
    try:
        assert client.get(f"/api/v2/forensics/case/{case_id}").status_code == 403

        payload = {
            "case_id": str(case_id),
            "evidence_id": str(evidence_id),
            "title": "Cross District Test",
            "forensic_type": "digital",
            "findings": "should never persist",
            "methodology": "not applicable",
        }
        assert client.post("/api/v2/forensics", json=payload).status_code == 403
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_investigation_dossier_cross_district_denied(test_setup):
    """Cross-district district-bound users cannot read case dossiers or timelines."""
    client = test_setup["client"]
    db = test_setup["db"]
    case_id = test_setup["case"].id

    outsider = _create_user(db, "io_mysuru3", "investigator", district="Mysuru")
    db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: outsider
    try:
        assert client.get(f"/api/v2/investigation/{case_id}").status_code == 403
        assert client.get(f"/api/v2/investigation/{case_id}/timeline").status_code == 403
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)
