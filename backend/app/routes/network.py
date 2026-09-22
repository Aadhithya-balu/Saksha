"""
FastAPI Router for Graph-Based Criminal Intelligence, Neo4j Graph Queries,
Link Analysis, Gang Networks, Shortest Path Analysis, and AI Graph Insights.
"""

from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, require_roles
from app.auth.scope import enforce_district_scope, is_multi_district
from app.database.postgres import get_db
from app.models.network import (
    AIGraphInsight,
    GangNetworkSummary,
    LinkAnalysisResponse,
    NetworkGraphResponse,
    NetworkPathResponse,
    ShortestPathRequest,
    ShortestPathResponse,
)
from app.services.neo4j.client import sync_postgres_to_neo4j, is_neo4j_available
from app.services.network import network_service

router = APIRouter(prefix="/network", tags=["Network Graph Intelligence"], dependencies=[Depends(require_roles(*ALL_ROLES))])


def _parse_network_date(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    """Parse an optional date filter (YYYY-MM-DD or ISO 8601) into a naive UTC datetime.

    ``end_of_day`` widens a bare date to 23:59:59.999999 so date ranges are inclusive.
    Invalid values are rejected with 422 rather than silently ignored.
    """
    if not value:
        return None
    text = value.strip()
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Invalid date value '{value}'. Expected YYYY-MM-DD or ISO 8601 "
                "e.g. 2026-06-01 or 2026-06-01T14:30:00."
            ),
        )
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    if end_of_day and parsed.hour == 0 and parsed.minute == 0 and parsed.second == 0:
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed


@router.get("/graph", response_model=NetworkGraphResponse)
def get_full_graph(
    category_filter: str | None = Query(None),
    min_risk: float = Query(0.0, ge=0.0, le=100.0),
    provenance_filter: str | None = Query(None),
    exclude_demo: bool = Query(False),
    limit: int = Query(500, ge=1, le=2000, description="Max nodes returned. Large values may be slow."),
    criminal_name: str | None = Query(None, max_length=255, description="Filter by criminal/suspect name (substring, case-insensitive)."),
    crime_type: str | None = Query(None, max_length=500, description="Comma-separated crime types (OR)."),
    district: str | None = Query(None, max_length=500, description="Comma-separated districts (OR, case-insensitive)."),
    police_station: str | None = Query(None, max_length=500, description="Comma-separated police station jurisdictions (OR)."),
    fir_number: str | None = Query(None, max_length=500, description="Comma-separated FIR or case numbers (OR)."),
    victim_name: str | None = Query(None, max_length=255, description="Filter by victim name (substring, case-insensitive)."),
    date_from: str | None = Query(None, description="Only incidents on/after this date (YYYY-MM-DD or ISO 8601)."),
    date_to: str | None = Query(None, description="Only incidents on/before this date (YYYY-MM-DD or ISO 8601)."),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Retrieve full criminal relationship network graph.

    Multi-parameter filters (issue #226) are combined with AND semantics; values
    within a single comma-separated parameter are OR-ed. All filters are optional,
    so existing unfiltered queries are unchanged.
    """
    if not is_multi_district(current_user):
        district = enforce_district_scope(current_user, None, db)
    return network_service.get_full_network_graph(
        db,
        category_filter=category_filter,
        min_risk=min_risk,
        provenance_filter=provenance_filter,
        exclude_demo=exclude_demo,
        limit=limit,
        criminal_name=criminal_name,
        crime_type=crime_type,
        district=district,
        police_station=police_station,
        fir_number=fir_number,
        victim_name=victim_name,
        date_from=_parse_network_date(date_from),
        date_to=_parse_network_date(date_to, end_of_day=True),
    )


@router.get("/person/{person_id}", response_model=NetworkGraphResponse)
def get_person_network(
    person_id: str,
    depth: int = Query(1, ge=1, le=4, description="Graph traversal depth expansion"),
    provenance_filter: str | None = Query(None, description="Filter edges by provenance or verification status"),
    exclude_demo: bool = Query(False, description="Exclude demo/seed records"),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Retrieve relationship graph centered around a specific criminal, suspect, officer, or victim."""
    return network_service.get_person_network_graph(
        db,
        person_id=person_id,
        depth=depth,
        provenance_filter=provenance_filter,
        exclude_demo=exclude_demo,
    )


@router.get("/search")
def search_network_entities(
    q: str = Query(..., min_length=1, max_length=200, description="Search term (name, FIR number, case number, station, district)"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Search for criminals, victims, officers, FIRs, and cases by name/number/station/district."""
    from app.models.criminal import Criminal
    from app.models.victim import Victim
    from app.models.officer import Officer
    from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
    from app.models.crime import CrimeCase
    from app.models.location import Location

    from app.auth.scope import enforce_district_scope, is_multi_district
    effective_district = enforce_district_scope(current_user, None, db)
    scoped = bool(effective_district and not is_multi_district(current_user))

    pattern = f"%{q}%"
    results: list[dict[str, Any]] = []

    criminal_query = db.query(Criminal).filter(
        or_(Criminal.full_name.ilike(pattern), Criminal.aliases.ilike(pattern))
    )
    if scoped:
        criminal_query = (
            criminal_query.join(FIRCriminalLink, FIRCriminalLink.criminal_id == Criminal.id)
            .join(FIR, FIR.id == FIRCriminalLink.fir_id)
            .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
            .join(Location, Location.id == CrimeCase.location_id)
            .filter(Location.district == effective_district)
            .distinct()
        )
    criminals = criminal_query.limit(limit).all()
    for c in criminals:
        results.append({
            "id": f"criminal-{c.id}",
            "type": "criminal",
            "name": c.full_name,
            "detail": f"Status: {c.status or 'unknown'} | Linked FIRs: {len(c.fir_links)}",
            "status": c.status,
            "risk_score": None,
        })

    victim_query = db.query(Victim).filter(Victim.full_name.ilike(pattern))
    if scoped:
        victim_query = (
            victim_query.join(FIRVictimLink, FIRVictimLink.victim_id == Victim.id)
            .join(FIR, FIR.id == FIRVictimLink.fir_id)
            .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
            .join(Location, Location.id == CrimeCase.location_id)
            .filter(Location.district == effective_district)
            .distinct()
        )
    victims = victim_query.limit(limit).all()
    for v in victims:
        results.append({
            "id": f"victim-{v.id}",
            "type": "victim",
            "name": v.full_name,
            "detail": f"Contact: {v.contact_number or 'N/A'}",
            "status": "victim",
        })

    officer_query = db.query(Officer).filter(
        or_(Officer.name.ilike(pattern), Officer.badge_number.ilike(pattern))
    )
    if scoped:
        officer_query = officer_query.filter(Officer.district == effective_district)
    officers = officer_query.limit(limit).all()
    for o in officers:
        results.append({
            "id": f"officer-{o.id}",
            "type": "officer",
            "name": o.name,
            "detail": f"Badge: {o.badge_number} | Rank: {o.rank or 'N/A'} | Station: {o.station or 'N/A'}",
            "status": o.status,
        })

    fir_query = db.query(FIR).filter(
        or_(FIR.fir_number.ilike(pattern), FIR.complainant_name.ilike(pattern))
    )
    if scoped:
        fir_query = (
            fir_query.join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
            .join(Location, Location.id == CrimeCase.location_id)
            .filter(Location.district == effective_district)
        )
    firs = fir_query.limit(limit).all()
    for f in firs:
        results.append({
            "id": f"case-{f.id}",
            "type": "case",
            "name": f"FIR #{f.fir_number}",
            "detail": f"Complainant: {f.complainant_name} | Sections: {f.sections or 'N/A'}",
            "status": "filed",
        })

    case_query = db.query(CrimeCase).filter(
        or_(CrimeCase.case_number.ilike(pattern), CrimeCase.description.ilike(pattern))
    )
    if scoped:
        case_query = (
            case_query.join(Location, Location.id == CrimeCase.location_id)
            .filter(Location.district == effective_district)
        )
    cases = case_query.limit(limit).all()
    for c in cases:
        results.append({
            "id": f"case-{c.id}",
            "type": "case",
            "name": f"Case {c.case_number}",
            "detail": f"Status: {c.status or 'open'} | Priority: {c.priority or 'N/A'}",
            "status": c.status,
        })

    location_query = db.query(Location).filter(
        or_(Location.station.ilike(pattern), Location.district.ilike(pattern))
    )
    if scoped:
        location_query = location_query.filter(Location.district == effective_district)
    locations = location_query.limit(limit).all()
    for loc in locations:
        results.append({
            "id": f"location-{loc.id}",
            "type": "location",
            "name": f"{loc.station}, {loc.district}",
            "detail": f"District: {loc.district} | Lat: {loc.latitude}, Lon: {loc.longitude}",
            "status": "active",
        })

    results.sort(key=lambda x: 0 if q.lower() in x["name"].lower() else 1)
    return {"results": results[:limit], "query": q, "total": len(results[:limit])}


@router.get("/case/{case_id}", response_model=NetworkGraphResponse)
def get_case_network(
    case_id: str,
    provenance_filter: str | None = Query(None, description="Filter edges by provenance or verification status"),
    exclude_demo: bool = Query(False, description="Exclude demo/seed records"),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Retrieve relationship network associated with a specific crime case or FIR."""
    return network_service.get_case_network_graph(
        db,
        case_id=case_id,
        provenance_filter=provenance_filter,
        exclude_demo=exclude_demo,
    )


@router.get("/gangs", response_model=list[GangNetworkSummary])
def list_gang_networks(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """List active criminal gangs, syndicates, hierarchy structures, and member networks."""
    return network_service.get_organization_gang_networks(db)


@router.get("/gangs/{gang_id}", response_model=GangNetworkSummary)
def get_gang_network_detail(
    gang_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Retrieve details and hierarchy tree for a specific criminal gang syndicate."""
    gangs = network_service.get_organization_gang_networks(db)
    for g in gangs:
        if g.gang_id == gang_id:
            return g
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Gang syndicate '{gang_id}' not found")


@router.post("/shortest-path", response_model=ShortestPathResponse)
def calculate_shortest_path(
    req: ShortestPathRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Calculate shortest relationship path and degree separation between two entities in the graph."""
    return network_service.find_shortest_path(db, source_id=req.source_id, target_id=req.target_id, max_depth=req.max_depth)


@router.get("/path", response_model=NetworkPathResponse)
def find_connection_path(
    source_id: str = Query(..., min_length=1, max_length=300, description="Source entity id (e.g. criminal-<id>, victim-<id>, officer-<id>)."),
    target_id: str = Query(..., min_length=1, max_length=300, description="Target entity id."),
    max_hops: int = Query(3, ge=1, le=5, description="Maximum relationship hops to search (1-5)."),
    criminal_name: str | None = Query(None, max_length=255, description="Filter by criminal/suspect name (substring, case-insensitive)."),
    crime_type: str | None = Query(None, max_length=500, description="Comma-separated crime types (OR)."),
    district: str | None = Query(None, max_length=500, description="Comma-separated districts (OR, case-insensitive)."),
    police_station: str | None = Query(None, max_length=500, description="Comma-separated police station jurisdictions (OR)."),
    fir_number: str | None = Query(None, max_length=500, description="Comma-separated FIR or case numbers (OR)."),
    victim_name: str | None = Query(None, max_length=255, description="Filter by victim name (substring, case-insensitive)."),
    date_from: str | None = Query(None, description="Only incidents on/after this date (YYYY-MM-DD or ISO 8601)."),
    date_to: str | None = Query(None, description="Only incidents on/before this date (YYYY-MM-DD or ISO 8601)."),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Find the shortest evidence-backed person-to-person connection path.

    Uses the same source-of-truth filters as GET /network/graph (issue #226):
    the path is computed only over FIRs matching the active filters, so a
    connection can never leak through a relationship the investigator excluded.
    `max_hops` bounds BFS depth; `max_hops=1` means a shared FIR only.
    """
    if source_id.strip().lower() == target_id.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select two different entities.",
        )
    if not is_multi_district(current_user):
        district = enforce_district_scope(current_user, None, db)
    return network_service.find_connection_path(
        db,
        source_id=source_id,
        target_id=target_id,
        max_hops=max_hops,
        criminal_name=criminal_name,
        crime_type=crime_type,
        district=district,
        police_station=police_station,
        fir_number=fir_number,
        victim_name=victim_name,
        date_from=_parse_network_date(date_from),
        date_to=_parse_network_date(date_to, end_of_day=True),
    )


@router.post("/link-analysis", response_model=LinkAnalysisResponse)
def perform_graph_link_analysis(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Perform network centrality calculations, identify key broker nodes, and bridge connections."""
    return network_service.perform_link_analysis(db)


@router.get("/insights", response_model=list[AIGraphInsight])
def get_ai_graph_insights(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Generate AI graph intelligence threat alerts, broker node detection, and investigation recommendations."""
    return network_service.generate_ai_graph_insights(db)


@router.post("/sync-neo4j", dependencies=[Depends(require_roles("admin", "crime_analyst"))])
def sync_neo4j_database(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Trigger synchronization of PostgreSQL database records into Neo4j graph nodes & edges."""
    if not is_neo4j_available():
        return {
            "status": "warning",
            "message": "Neo4j database is currently unreachable. Operating under PostgreSQL fallback mode.",
            "neo4j_active": False,
        }
    res = sync_postgres_to_neo4j(db)
    return {
        "status": "success",
        "message": f"Successfully synced {res.get('synced_nodes', 0)} nodes and {res.get('synced_edges', 0)} edges to Neo4j.",
        "neo4j_active": True,
        "details": res,
    }
