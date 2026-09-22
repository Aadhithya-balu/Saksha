import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    require_roles,
)
from app.auth.scope import enforce_district_scope
from app.core.exceptions import ForbiddenException, NotFoundException
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.knowledge_graph import (
    KGFragmentOut,
    KGNodeOut,
    KGRelationshipCreate,
    KGRelationshipOut,
    KGSearchOut,
    KGStatsOut,
)
from app.services import audit_service
from app.services.knowledge_graph_service import (
    MAX_DEPTH,
    build_fragment,
    create_relationship,
    get_node,
    get_node_by_ref,
    rebuild_graph,
    search_nodes,
    stats,
)

router = APIRouter(prefix="/knowledge-graph", tags=["Knowledge Graph"])

REBUILD_ROLES = Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST))
REVIEW_ROLES = Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR))


def _scope_filter(user: User, requested: str | None, db: Session):
    """Effective district for a read; multi-district may pass None (all)."""
    try:
        return enforce_district_scope(user, requested, db)
    except ForbiddenException as exc:
        raise HTTPException(403, str(exc))


@router.post("/rebuild", response_model=dict, dependencies=[REBUILD_ROLES])
def rebuild(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rebuild the derived knowledge graph from authoritative tables."""
    result = rebuild_graph(db)
    audit_service.log_action(db, current_user, "UPDATE", "KnowledgeGraph", "graph",
                             details=f"rebuilt: {result}")
    return result


@router.get("/stats", response_model=KGStatsOut)
def graph_stats(
    district: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _scope_filter(current_user, district, db)
    return stats(db)


@router.get("/nodes", response_model=KGSearchOut)
def search_kg_nodes(
    q: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=200),
    district: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    eff = _scope_filter(current_user, district, db)
    result = search_nodes(db, q, limit=200)
    items = result["items"]
    if eff:
        items = [n for n in items if eff in (n.districts or [])]
    return {"items": items[:limit], "total": len(items)}


@router.get("/fragment/by-ref/{ref_type}/{ref_id}", response_model=KGFragmentOut)
def fragment_by_ref(
    ref_type: str,
    ref_id: uuid.UUID,
    depth: int = Query(2, ge=1, le=MAX_DEPTH),
    district: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    eff = _scope_filter(current_user, district, db)
    try:
        node = get_node_by_ref(db, ref_type, ref_id)
    except NotFoundException:
        raise HTTPException(404, "No knowledge-graph node for that record (rebuild the graph first)")
    return _fragment(db, node, depth, eff)


@router.get("/fragment/{node_id}", response_model=KGFragmentOut)
def fragment_by_node(
    node_id: uuid.UUID,
    depth: int = Query(2, ge=1, le=MAX_DEPTH),
    district: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    eff = _scope_filter(current_user, district, db)
    try:
        node = get_node(db, node_id)
    except NotFoundException:
        raise HTTPException(404, "Knowledge-graph node not found")
    return _fragment(db, node, depth, eff)


def _fragment(db: Session, node, depth: int, eff: str | None) -> dict:
    if eff is not None and eff not in (node.districts or []):
        raise HTTPException(403, "This record belongs to another district and is outside your scope.")

    def allowed(other):
        if eff is None:
            return True
        return eff in (other.districts or [])
    return build_fragment(db, node, depth=depth, allowed=allowed)


@router.post("/relationships", response_model=KGRelationshipOut, dependencies=[REVIEW_ROLES])
def add_relationship(
    payload: KGRelationshipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manual, human-reviewed edge (a knowledge update; audited)."""
    try:
        rel = create_relationship(
            db, payload.source_node_id, payload.target_node_id,
            payload.relationship_type, payload.direction, payload.strength,
            payload.basis, payload.provenance,
        )
    except NotFoundException as exc:
        raise HTTPException(404, str(exc))
    audit_service.log_action(
        db, current_user, "CREATE", "KGRelationship", str(rel.id),
        details=f"{payload.direction} {payload.relationship_type}",
    )
    return rel