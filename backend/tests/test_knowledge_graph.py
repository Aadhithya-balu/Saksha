"""Knowledge graph tests (issue #269, Phase 3).

The graph must be an honest derived projection: DIRECT edges only for data
attested in the source records, DERIVED edges (co-listing, identity proposals)
explicitly weaker with a basis, district-scoped reads, and a depth cap of 3.
"""
import uuid
from datetime import date, datetime, timezone

from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.identity import (
    ASSESSMENT_REQUIRES_REVIEW,
    REL_STATUS_OPEN,
    IdentityRelationship,
)
from app.models.location import Location
from app.models.role import Role
from app.models.user import User
from app.models.victim import Victim
from app.services.knowledge_graph_service import rebuild_graph

KG = "/api/v2/knowledge-graph"


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


def _category_location(db_session, station="KR Puram Police Station", district="Bengaluru Urban"):
    category = db_session.query(CrimeCategory).filter_by(name="Theft & Burglaries").first()
    if category is None:
        category = CrimeCategory(name="Theft & Burglaries", section_code="IPC 379", severity="medium")
        db_session.add(category)
    location = db_session.query(Location).filter(Location.station == station).first()
    if location is None:
        location = Location(district=district, station=station, latitude=13.0, longitude=77.7)
        db_session.add(location)
    db_session.flush()
    return category, location


def _criminal(db_session, name):
    cr = Criminal(full_name=name, date_of_birth=date(1992, 6, 11),
                  address="14, 5th Main, Whitefield, Bengaluru",
                  mo_summary="No specifics recorded.", status="at_large")
    db_session.add(cr)
    db_session.flush()
    return cr


def _victim(db_session, name):
    vt = Victim(full_name=name, contact_number="9876543210", address="Somewhere")
    db_session.add(vt)
    db_session.flush()
    return vt


def _case_fir(db_session, category, location, case_no, fir_no, acc, victims):
    case = CrimeCase(
        case_number=case_no, category_id=category.id, location_id=location.id,
        occurred_at=datetime(2026, 5, 1, tzinfo=timezone.utc), description="narrative",
        status="open",
    )
    db_session.add(case)
    db_session.flush()
    fir = FIR(fir_number=fir_no, crime_case_id=case.id, complainant_name="Complainant",
              sections="379", status="registered",
              filed_at=datetime(2026, 5, 1, 3, 0, tzinfo=timezone.utc), narrative="narrative")
    db_session.add(fir)
    db_session.flush()
    for c in acc:
        db_session.add(FIRCriminalLink(fir_id=fir.id, criminal_id=c.id, role="accused"))
    for v in victims:
        db_session.add(FIRVictimLink(fir_id=fir.id, victim_id=v.id))
    db_session.flush()
    return case, fir


def test_rebuild_creates_attested_nodes_and_direct_edges(client, db_session):
    _analyst(client, db_session)
    category, location = _category_location(db_session)
    acc = _criminal(db_session, "Ramu Kumar")
    vit = _victim(db_session, "Smt. Lakshmi")
    case, fir = _case_fir(db_session, category, location, "CR-1", "FIR-001/BNG/2026", [acc], [vit])

    r = client.post(f"{KG}/rebuild")
    assert r.status_code == 200, r.text
    s = client.get(f"{KG}/stats").json()
    assert s["node_total"] >= 5
    assert s["nodes_by_type"]["CASE"] >= 1
    assert s["nodes_by_type"]["FIR"] >= 1
    assert s["edges_by_direction"]["DIRECT"] >= 3  # CASE_LOCATION + CASE_FIR + PERSON_FIR x2

    # Attested hops are DIRECT.
    frag = client.get(f"{KG}/fragment/by-ref/crime_case/{case.id}?depth=2").json()
    edge_types = {(e["relationship_type"], e["direction"]) for e in frag["edges"]}
    assert ("CASE_LOCATION", "DIRECT") in edge_types
    assert ("CASE_FIR", "DIRECT") in edge_types
    assert ("PERSON_FIR", "DIRECT") in edge_types
    assert ("PERSON_CASE", "DERIVED") in edge_types
    assert any(n["ref_type"] == "criminal" for n in frag["nodes"])


def test_fragment_honors_depth_cap(client, db_session):
    _analyst(client, db_session)
    category, location = _category_location(db_session)
    acc = _criminal(db_session, "Babu Rao")
    vit = _victim(db_session, "Victim Two")
    case, fir = _case_fir(db_session, category, location, "CR-2", "FIR-002/BNG/2026", [acc], [vit])
    client.post(f"{KG}/rebuild")

    d1 = client.get(f"{KG}/fragment/by-ref/criminal/{acc.id}?depth=1").json()
    assert d1["depth"] == 1
    # Direct neighbors: the FIR + co-listed victim (KNOWN_ASSOCIATE) + the
    # derived PERSON_CASE hop. Locations only appear at depth >= 2.
    assert all(n["node_type"] in {"CRIMINAL", "FIR", "CASE", "VICTIM"} for n in d1["nodes"])
    assert all(n["node_type"] != "LOCATION" for n in d1["nodes"])

    d3 = client.get(f"{KG}/fragment/by-ref/criminal/{acc.id}?depth=3").json()
    assert d3["depth"] == 3
    assert any(n["node_type"] == "LOCATION" for n in d3["nodes"])

    # Depths beyond MAX_DEPTH are rejected at the API boundary.
    assert client.get(f"{KG}/fragment/by-ref/criminal/{acc.id}?depth=10").status_code == 422


def test_co_accused_people_link_is_derived_known_associate(client, db_session):
    _analyst(client, db_session)
    category, location = _category_location(db_session)
    a = _criminal(db_session, "Ramu Kumar")
    b = _criminal(db_session, "Balu Swamy")
    _case_fir(db_session, category, location, "CR-3", "FIR-003/BNG/2026", [a, b], [])

    client.post(f"{KG}/rebuild")
    frag = client.get(f"{KG}/fragment/by-ref/criminal/{a.id}?depth=2").json()
    associates = [e for e in frag["edges"] if e["relationship_type"] == "KNOWN_ASSOCIATE"]
    assert len(associates) == 1
    assert associates[0]["direction"] == "DERIVED"
    assert associates[0]["strength"] < 1.0
    assert associates[0]["basis"] == "co-listed on same FIR"
    assert any(n["label"] == "Balu Swamy" for n in frag["nodes"])


def test_proposed_identity_edge_is_derived_and_weak(client, db_session):
    _analyst(client, db_session)
    category, location = _category_location(db_session)
    a = _criminal(db_session, "Ramu Kumar")
    b = _criminal(db_session, "Ramu Kumar Jr")
    _case_fir(db_session, category, location, "CR-4", "FIR-004/BNG/2026", [a], [])
    _case_fir(db_session, category, location, "CR-5", "FIR-005/BNG/2026", [b], [])

    rel = IdentityRelationship(
        source_entity_type="criminal", source_entity_id=a.id,
        target_entity_type="criminal", target_entity_id=b.id,
        relationship_type="SAME_PERSON_PROBABLE",
        assessment=ASSESSMENT_REQUIRES_REVIEW, confidence=75.0,
        status=REL_STATUS_OPEN,
    )
    db_session.add(rel)
    db_session.commit()

    client.post(f"{KG}/rebuild")
    frag = client.get(f"{KG}/fragment/by-ref/criminal/{a.id}?depth=1").json()
    edges = [e for e in frag["edges"] if e["relationship_type"] == "SAME_PERSON_PROBABLE"]
    assert len(edges) == 1
    assert edges[0]["direction"] == "DERIVED"
    assert edges[0]["strength"] == 0.75
    assert edges[0]["status"] == "ACTIVE"


def test_search_and_manual_relationship_audit(client, db_session):
    analyst = _analyst(client, db_session)
    category, location = _category_location(db_session)
    acc = _criminal(db_session, "Searchable Ramu")
    vit = _victim(db_session, "Searchable Victim")
    _, fir = _case_fir(db_session, category, location, "CR-6", "FIR-006/BNG/2026", [acc], [vit])

    client.post(f"{KG}/rebuild")
    search = client.get(f"{KG}/nodes", params={"q": "Searchable"}).json()
    assert search["total"] >= 1
    ramu = next(n for n in search["items"] if n["label"] == "Searchable Ramu")

    r = client.post(f"{KG}/relationships", json={
        "source_node_id": ramu["id"],
        "target_node_id": ramu["id"],
        "relationship_type": "OWNER_SELF",
        "direction": "DIRECT",
        "strength": 1.0,
        "basis": "reviewer override",
    })
    assert r.status_code == 200, r.text
    assert r.json()["relationship_type"] == "OWNER_SELF"

    from app.models.audit_log import AuditLog
    logs = db_session.query(AuditLog).filter(
        AuditLog.resource_type == "KGRelationship",
        AuditLog.action == "CREATE",
    ).all()
    assert len(logs) == 1


def test_kg_rbac_and_district_fail_closed(client, db_session):
    from app.auth.scope import MULTI_DISTRICT_ROLES
    assert MULTI_DISTRICT_ROLES  # sanity: constants exist
    _viewer(client, db_session)
    assert client.post(f"{KG}/rebuild").status_code == 403
    assert client.post(f"{KG}/relationships", json={
        "source_node_id": str(uuid.uuid4()), "target_node_id": str(uuid.uuid4()),
        "relationship_type": "X", "direction": "DIRECT",
    }).status_code == 403
    # A district-bound user with no district fails closed on reads too.
    assert client.get(f"{KG}/stats").status_code == 403
    assert client.get(f"{KG}/nodes").status_code == 403
    assert client.get(f"{KG}/fragment/00000000-0000-0000-0000-000000000000").status_code == 403


def _analyst(client, db_session):
    role = _role(db_session, "crime_analyst", "Crime Analyst")
    user = _user(db_session, role, "kg-analyst")
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client, user


def _viewer(client, db_session):
    role = _role(db_session, "viewer", "Viewer")
    user = _user(db_session, role, "kg-viewer")
    client.app.dependency_overrides[get_current_user] = lambda: user
    return client, user