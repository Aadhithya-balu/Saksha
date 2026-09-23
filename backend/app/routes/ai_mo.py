import uuid
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    require_roles,
)
from app.database.postgres import get_db
from app.models.user import User
from app.services.mo_matching_service import (
    compare_two_entities,
    extract_case_mo_profile,
    extract_criminal_mo_profile,
    match_case_against_db,
    match_criminal_against_db,
)
from app.services.mo_pattern_service import detect_recurring_mo_patterns, sync_mo_tags
from app.services.mo_semantic_service import extract_case_entities, extract_entities, search_similar_mo
from app.services.audit_service import log_action

router = APIRouter(
    prefix="/ai/mo",
    tags=["AI Modus Operandi"],
    dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER))],
)


@router.get("/search")
def semantic_mo_search(
    q: str = Query(..., min_length=2),
    k: int = Query(10, ge=1, le=50),
    kinds: str | None = Query(None, description="Comma list: criminal,crime_case,fir"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Semantic similarity search over MO summaries and case/FIR narratives.

    Uses TF-IDF + LSA embeddings (scikit-learn), so paraphrases match even when
    wording differs — unlike the legacy substring ILIKE search.
    """
    kind_list = [k.strip() for k in kinds.split(",") if k.strip()] if kinds else None
    return search_similar_mo(db, q.strip(), top_k=k, kinds=kind_list)


class NarrativePayload(BaseModel):
    text: str


@router.post("/extract-entities")
def extract_narrative_entities(
    payload: NarrativePayload,
    current_user: User = Depends(get_current_user),
):
    """Rule-based NER over free text: plates, phones, weapons, places, dates, money."""
    if not payload.text.strip():
        return {"entities": {}, "entity_count": 0}
    return extract_entities(payload.text)


@router.get("/extract-case/{case_id}")
def extract_case_narrative_entities(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract investigative entities from a case's description/MO tags + linked FIR narratives."""
    result = extract_case_entities(db, case_id)
    if result is None:
        return {"error": "Case not found"}
    return result


@router.get("/patterns")
def recurring_mo_patterns(
    min_support: int = Query(2, ge=2, le=20),
    k: int = Query(10, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recurring modus-operandi patterns across cases and offenders (gap 132.2).

    Groups entities whose normalized MO signatures overlap (Jaccard similarity
    over canonical tags + union-find) and ranks the resulting patterns by a
    documented threat heuristic.
    """
    return detect_recurring_mo_patterns(db, min_support=min_support, max_patterns=k)


@router.get("/match/case/{case_id}")
def match_case(
    case_id: str,
    k: int = Query(5, ge=1, le=25),
    min_similarity: float = Query(0.25, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find real cases and real suspect leads matching a case's MO pattern.

    Evaluates category, tactical methods, weapon signatures, temporal windows,
    and geographic corridors with explainable matching/divergent factors.
    """
    try:
        cid = uuid.UUID(case_id)
    except ValueError:
        return {"error": "Invalid case UUID"}
    return match_case_against_db(db, cid, top_k=k, min_similarity=min_similarity)


@router.get("/match/criminal/{criminal_id}")
def match_criminal(
    criminal_id: str,
    k: int = Query(5, ge=1, le=25),
    min_similarity: float = Query(0.25, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find real unsolved/open cases and similar offenders matching a criminal's MO."""
    try:
        cid = uuid.UUID(criminal_id)
    except ValueError:
        return {"error": "Invalid criminal UUID"}
    return match_criminal_against_db(db, cid, top_k=k, min_similarity=min_similarity)


class ComparePayload(BaseModel):
    entity_a_id: str
    entity_a_type: str  # "case" | "criminal"
    entity_b_id: str
    entity_b_type: str  # "case" | "criminal"


@router.post("/compare")
def compare_entities(
    payload: ComparePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Side-by-side explainable MO comparison between any two real database entities."""
    try:
        aid = uuid.UUID(payload.entity_a_id)
        bid = uuid.UUID(payload.entity_b_id)
    except ValueError:
        return {"error": "Invalid entity UUID format"}

    return compare_two_entities(
        db,
        aid,
        payload.entity_a_type.lower().strip(),
        bid,
        payload.entity_b_type.lower().strip(),
    )


@router.post("/sync-tags")
def sync_normalized_mo_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Backfill normalized mo_tags relations from legacy fields (gap 132.1).

    Idempotent — safe to call repeatedly; returns creation/skip counts.
    """
    result = sync_mo_tags(db)
    log_action(
        db, current_user, "SYNC", "MOTag",
        resource_id="mo_tags",
        details=(
            f"Backfill normalized MO tags (tags_created={result.get('tags_created', 0)}, "
            f"case_links_created={result.get('case_links_created', 0)}, "
            f"criminal_links_created={result.get('criminal_links_created', 0)}, "
            f"already_synced={result.get('already_synced', 0)})"
        ),
    )
    db.commit()
    return result
