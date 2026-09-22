"""Knowledge graph (issue #269, Phase 3).

The graph is a derived, idempotently-rebuildable projection of authoritative
data: nodes point at real records (criminals, victims, cases, FIRs, locations)
via ``(ref_type, ref_id)``, and edges are labelled DIRECT when attested in the
source data (FIR accused link, case location, FIR->case) or DERIVED when
inferred (co-listed people, shared location, proposed identity) with an explicit
basis and reduced strength. Nothing here fabricates a fact.
"""
import logging
import uuid
from collections import defaultdict, deque
from typing import Callable

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundException
from app.models.crime import CrimeCase
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.identity import (
    ENTITY_KIND_CRIMINAL,
    ENTITY_KIND_VICTIM,
    IdentityRelationship,
)
from app.models.knowledge_graph import KGNode, KGRelationship
from app.models.location import Location
from app.models.victim import Victim
from app.services.ttl_cache import invalidate_ttl_cache_prefix  # noqa: F401  (re-exported for routes)

logger = logging.getLogger(__name__)

MAX_DEPTH = 3

NODE_TYPE_BY_REF = {
    ENTITY_KIND_CRIMINAL: "CRIMINAL",
    ENTITY_KIND_VICTIM: "VICTIM",
    "crime_case": "CASE",
    "fir": "FIR",
    "location": "LOCATION",
}


def rebuild_graph(db: Session) -> dict:
    """Rebuild the whole graph from authoritative tables (idempotent)."""
    db.query(KGRelationship).delete()
    db.query(KGNode).delete()
    db.flush()

    nodes: dict[tuple[str, str], KGNode] = {}
    relations: list[KGRelationship] = []

    def node(ref_type: str, ref_id, node_type: str, label: str, attributes: dict,
             districts: list[str], provenance: dict | None = None) -> KGNode:
        key = (ref_type, str(ref_id))
        existing = nodes.get(key)
        if existing:
            existing.districts = sorted(set(existing.districts) | set(districts))
            return existing
        n = KGNode(
            ref_type=ref_type, ref_id=ref_id, node_type=node_type, label=label,
            attributes=attributes, districts=sorted(set(districts)),
            provenance=provenance,
        )
        db.add(n)
        db.flush()
        nodes[key] = n
        return n

    def edge(src: KGNode, tgt: KGNode, rel_type: str, direction: str, strength: float,
             basis: str | None, provenance: dict | None = None) -> None:
        relations.append(KGRelationship(
            source_node_id=src.id, target_node_id=tgt.id, relationship_type=rel_type,
            direction=direction, strength=strength, basis=basis, provenance=provenance,
        ))

    # ---- cases + locations (attested by case.location) -------------------
    cases = (
        db.query(CrimeCase)
        .options(selectinload(CrimeCase.location))
        .all()
    )
    case_node_by_id: dict[uuid.UUID, KGNode] = {}
    for case in cases:
        loc = case.location
        districts = [loc.district] if loc and loc.district else []
        loc_node = node("location", loc.id, "LOCATION", _location_label(loc),
                        _location_attrs(loc), districts, {"source": "case.location"})
        case_node = node("crime_case", case.id, "CASE", case.case_number,
                         _case_attrs(case), districts, {"source": "crime_cases"})
        case_node_by_id[case.id] = case_node
        edge(case_node, loc_node, "CASE_LOCATION", "DIRECT", 1.0, "case.location")

    # ---- FIRs + accused/victims (attested links) -------------------------
    firs = (
        db.query(FIR)
        .options(
            selectinload(FIR.crime_case),
            selectinload(FIR.criminal_links).selectinload(FIRCriminalLink.criminal),  # type: ignore[name-defined]
            selectinload(FIR.victim_links).selectinload(FIRVictimLink.victim),  # type: ignore[name-defined]
        )
        .all()
    )
    fir_node_by_id: dict[uuid.UUID, KGNode] = {}
    fir_case_by_id: dict[uuid.UUID, uuid.UUID] = {}
    people_by_fir: dict[uuid.UUID, list[KGNode]] = defaultdict(list)

    for fir in firs:
        case_node = case_node_by_id.get(fir.crime_case_id)
        districts = list(case_node.districts) if case_node else []
        fir_node = node("fir", fir.id, "FIR", fir.fir_number, _fir_attrs(fir),
                        districts, {"source": "firs"})
        fir_node_by_id[fir.id] = fir_node
        fir_case_by_id[fir.id] = fir.crime_case_id
        if case_node:
            edge(fir_node, case_node, "CASE_FIR", "DIRECT", 1.0, "fir.crime_case_id")

        for link in fir.criminal_links or []:
            crim = link.criminal
            if crim is None:
                continue
            crim_node = node(ENTITY_KIND_CRIMINAL, crim.id, "CRIMINAL", crim.full_name,
                             _person_attrs(crim), districts, {"source": "criminals"})
            edge(crim_node, fir_node, "PERSON_FIR", "DIRECT", 1.0,
                 f"fir accused ({link.role or 'accused'})")
            people_by_fir[fir.id].append(crim_node)

        for link in fir.victim_links or []:
            vit = link.victim
            if vit is None:
                continue
            vit_node = node(ENTITY_KIND_VICTIM, vit.id, "VICTIM", vit.full_name,
                            _person_attrs(vit), districts, {"source": "victims"})
            edge(vit_node, fir_node, "PERSON_FIR", "DIRECT", 1.0, "fir victim")
            people_by_fir[fir.id].append(vit_node)

    # ---- derived: co-listed people, person->case hops --------------------
    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    seen_person_case: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for fir_id, people in people_by_fir.items():
        case_node = case_node_by_id.get(fir_case_by_id[fir_id])
        for i, a in enumerate(people):
            for b in people[i + 1:]:
                key = (a.id, b.id) if a.id < b.id else (b.id, a.id)
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                edge(a, b, "KNOWN_ASSOCIATE", "DERIVED", 0.6, "co-listed on same FIR",
                     {"fir_id": str(fir_id)})
            if case_node is not None:
                pkey = (a.id, case_node.id)
                if pkey not in seen_person_case:
                    seen_person_case.add(pkey)
                    edge(a, case_node, "PERSON_CASE", "DERIVED", 0.75, "via FIR link")

    # ---- derived: proposed identity relationships ------------------------
    identity_rels = db.query(IdentityRelationship).filter(
        IdentityRelationship.source_entity_type == ENTITY_KIND_CRIMINAL,
        IdentityRelationship.target_entity_type == ENTITY_KIND_CRIMINAL,
    ).all()
    for rel in identity_rels:
        src = nodes.get((ENTITY_KIND_CRIMINAL, str(rel.source_entity_id)))
        tgt = nodes.get((ENTITY_KIND_CRIMINAL, str(rel.target_entity_id)))
        if not src or not tgt:
            continue
        key = (src.id, tgt.id) if src.id < tgt.id else (tgt.id, src.id)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        edge(src, tgt, rel.relationship_type, "DERIVED",
             min(1.0, max(0.0, rel.confidence / 100.0)), rel.assessment,
             {"identity_status": rel.status})

    db.add_all(relations)
    db.commit()
    invalidate_ttl_cache_prefix("knowledge_graph")
    return {"nodes": len(nodes), "edges": len(relations)}


def build_fragment(
    db: Session,
    start: KGNode,
    depth: int = 2,
    allowed: Callable | None = None,
) -> dict:
    """BFS around ``start`` up to ``depth`` (capped at MAX_DEPTH)."""
    depth = max(1, min(int(depth or 0), MAX_DEPTH))

    all_nodes: dict[uuid.UUID, KGNode] = {n.id: n for n in db.query(KGNode).all()}
    adjacency: dict[uuid.UUID, list[KGRelationship]] = defaultdict(list)
    for r in db.query(KGRelationship).filter(KGRelationship.status == "ACTIVE").all():
        adjacency[r.source_node_id].append(r)
        adjacency[r.target_node_id].append(r)

    if not allowed:
        allowed = lambda n: True  # noqa: E731

    visited: set[uuid.UUID] = {start.id}
    seen_edges: dict[uuid.UUID, KGRelationship] = {}
    queue = deque([(start, 0)])
    while queue:
        cur, d = queue.popleft()
        if d >= depth:
            continue
        for r in adjacency.get(cur.id, []):
            other_id = r.target_node_id if r.source_node_id == cur.id else r.source_node_id
            other = all_nodes.get(other_id)
            if other is None or not allowed(other):
                continue
            seen_edges[r.id] = r
            if other_id not in visited:
                visited.add(other_id)
                queue.append((other, d + 1))

    included_edges = [e for e in seen_edges.values()
                      if e.source_node_id in visited and e.target_node_id in visited]
    return {
        "nodes": [n for n in all_nodes.values() if n.id in visited],
        "edges": included_edges,
        "depth": depth,
    }


def get_node_by_ref(db: Session, ref_type: str, ref_id: uuid.UUID) -> KGNode:
    node = db.query(KGNode).filter(
        KGNode.ref_type == ref_type, KGNode.ref_id == ref_id
    ).first()
    if not node:
        raise NotFoundException("No knowledge-graph node for that record (rebuild the graph first)")
    return node


def get_node(db: Session, node_id: uuid.UUID) -> KGNode:
    node = db.query(KGNode).filter(KGNode.id == node_id).first()
    if not node:
        raise NotFoundException("Knowledge-graph node not found")
    return node


def search_nodes(db: Session, q: str, limit: int = 20) -> dict:
    search = q.strip()
    query = db.query(KGNode).filter(KGNode.status == "ACTIVE")
    if search:
        query = query.filter(KGNode.label.ilike(f"%{search}%"))
    items = query.order_by(KGNode.label).limit(min(limit, 100)).all()
    return {"items": items, "total": len(items)}


def stats(db: Session) -> dict:
    node_total = db.query(KGNode).filter(KGNode.status == "ACTIVE").count()
    edge_total = db.query(KGRelationship).filter(KGRelationship.status == "ACTIVE").count()
    by_type = dict(db.query(KGNode.node_type, func.count()).filter(KGNode.status == "ACTIVE").group_by(KGNode.node_type).all())
    by_direction = dict(db.query(KGRelationship.direction, func.count()).filter(KGRelationship.status == "ACTIVE").group_by(KGRelationship.direction).all())
    return {
        "node_total": node_total,
        "edge_total": edge_total,
        "nodes_by_type": by_type,
        "edges_by_direction": by_direction,
    }


def create_relationship(
    db: Session,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    relationship_type: str,
    direction: str,
    strength: float,
    basis: str | None,
    provenance: dict,
) -> KGRelationship:
    get_node(db, source_id)
    get_node(db, target_id)
    rel = KGRelationship(
        source_node_id=source_id, target_node_id=target_id,
        relationship_type=relationship_type, direction=direction,
        strength=strength, basis=basis, provenance=provenance,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    invalidate_ttl_cache_prefix("knowledge_graph")
    return rel


# ------------------------------------------------------------- attribute mappers
def _location_label(loc: Location) -> str:
    return loc.station or loc.district or "Unknown location"


def _location_attrs(loc: Location) -> dict:
    return {"district": loc.district, "station": loc.station, "address": loc.address}


def _case_attrs(case: CrimeCase) -> dict:
    return {
        "status": case.status,
        "priority": case.priority,
        "occurred_at": case.occurred_at.isoformat() if case.occurred_at else None,
        "description": (case.description or "")[:280],
    }


def _fir_attrs(fir: FIR) -> dict:
    return {
        "sections": fir.sections,
        "complainant_name": fir.complainant_name,
        "status": fir.status,
    }


def _person_attrs(obj) -> dict:
    attrs: dict = {}
    label = getattr(obj, "full_name", None)
    if isinstance(label, str) and ", " in label:
        first, rest = label.split(", ", 1)
        attrs["first_name"], attrs["rest"] = first, rest
    if getattr(obj, "date_of_birth", None):
        attrs["date_of_birth"] = obj.date_of_birth.isoformat()
    if getattr(obj, "aliases", None):
        attrs["aliases"] = obj.aliases
    if getattr(obj, "address", None):
        attrs["address"] = obj.address
    if getattr(obj, "contact_number", None):
        attrs["contact_number"] = obj.contact_number
    return attrs