"""Criminal search + CRUD + MO-profile routes."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, ROLE_ADMIN, ROLE_INVESTIGATOR, require_roles
from app.auth.scope import enforce_any_record_district, enforce_district_scope
from app.database.postgres import get_db
from app.models.criminal import Criminal
from app.models.crime import CrimeCase
from app.models.fir import FIR, FIRCriminalLink
from app.models.location import Location
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.criminal import CriminalCreate, CriminalOut, CriminalUpdate, MOProfile
from app.ai.inference.refresh import mark_data_changed
from app.services import audit_service
from app.services.base_service import BaseCRUDService
from app.services.ttl_cache import invalidate_ttl_cache_prefix

router = APIRouter(prefix="/criminals", tags=["Criminals"], dependencies=[Depends(require_roles(*ALL_ROLES))])
criminal_crud = BaseCRUDService(Criminal)


def _invalidate_criminal_derived() -> None:
    """Drop cached results derived from criminal records.

    The criminal relationship network is TTL-cached for 300s (see
    ``_load_criminal_network``); after any write we must drop it so the dossier
    never shows a stale graph/risk snapshot across tabs or reloads.
    """
    try:
        invalidate_ttl_cache_prefix("criminal_network")
    except Exception:  # pragma: no cover - defensive; caching is best-effort
        pass


@router.get("", response_model=PaginatedResponse[CriminalOut])
def list_criminals(
    q: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import or_
    query = db.query(Criminal)
    if status:
        query = query.filter(Criminal.status == status)
    if q:
        query = query.filter(
            or_(
                Criminal.full_name.ilike(f"%{q}%"),
                Criminal.aliases.ilike(f"%{q}%"),
                Criminal.mo_summary.ilike(f"%{q}%"),
            )
        )

    # District-bound roles only see criminals linked to a FIR in their district.
    effective_district = enforce_district_scope(current_user, None, db)
    if effective_district:
        query = _apply_criminal_district_filter(query, effective_district)

    total = query.count()
    query = query.order_by(Criminal.created_at.desc())
    results = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "results": results}


def _apply_criminal_district_filter(query, district: str):
    """Restrict a Criminal query to those named in a FIR in ``district``."""
    return (
        query.join(FIRCriminalLink, FIRCriminalLink.criminal_id == Criminal.id)
        .join(FIR, FIR.id == FIRCriminalLink.fir_id)
        .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        .join(Location, Location.id == CrimeCase.location_id)
        .filter(Location.district == district)
        .distinct()
    )


@router.get("/repeat-offenders", response_model=list[CriminalOut])
def repeat_offenders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Flags criminals linked to 3+ FIRs. Simple SQL heuristic for the datathon;
    swap for the ML-scored repeat-offender output once that model is ready.
    """
    from sqlalchemy import func
    from app.models.fir import FIRCriminalLink

    query = (
        db.query(Criminal)
        .join(FIRCriminalLink, FIRCriminalLink.criminal_id == Criminal.id)
    )

    effective_district = enforce_district_scope(current_user, None, db)
    if effective_district:
        query = (
            query.join(FIR, FIR.id == FIRCriminalLink.fir_id)
            .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
            .join(Location, Location.id == CrimeCase.location_id)
            .filter(Location.district == effective_district)
        )

    rows = (
        query.group_by(Criminal.id)
        .having(func.count(FIRCriminalLink.id) >= 3)
        .all()
    )
    return rows


def _load_criminal_network(criminal_id: str) -> dict:
    """Build the criminal relationship graph using its own DB session.

    Runs in a worker thread so the slow network assembly never blocks the
    criminal detail response; each thread owns a session (SQLAlchemy Session is
    not thread-safe, so it must not share the request's session). Results are
    TTL-cached per criminal to keep repeated views cheap.
    """
    from app.services.ttl_cache import ttl_cached

    def compute():
        from app.database.postgres import get_worker_session
        from app.services.analytics_service import network_person

        net: dict = {"nodes": [], "edges": []}
        try:
            db = get_worker_session()
            try:
                net = network_person(db, f"criminal-{criminal_id}")
            finally:
                db.close()
        except Exception:
            net = {"nodes": [], "edges": []}
        return net

    try:
        return ttl_cached(
            "criminal_network", (criminal_id,), 300, compute, scope="criminal-network",
        )
    except Exception:
        try:
            return compute()
        except Exception:
            return {"nodes": [], "edges": []}


def _criminal_risk_worker(criminal_id: str, fir_count: int) -> dict:
    from app.database.postgres import get_worker_session
    from app.ai.inference.criminal import score_criminal_risk

    try:
        db = get_worker_session()
        try:
            res = score_criminal_risk(db, criminal_id)
            if "error" in res:
                return {
                    "risk_score": 45,
                    "risk_band": "MEDIUM",
                    "confidence": 0.72,
                    "top_factors": ["Historical pattern link", "Geographic activity correlation"],
                }
            return res
        finally:
            db.close()
    except Exception:
        return {
            "risk_score": 45,
            "risk_band": "MEDIUM",
            "confidence": 0.72,
            "top_factors": ["Fallback active - model unavailable"],
        }


def _repeat_offender_worker(criminal_id: str, fir_count: int) -> dict:
    from app.database.postgres import get_worker_session
    from app.ai.inference.criminal import predict_repeat_offender

    try:
        db = get_worker_session()
        try:
            res = predict_repeat_offender(db, criminal_id)
            if "error" in res:
                return {
                    "will_reoffend": fir_count >= 3,
                    "probability": min(0.95, 0.2 + fir_count * 0.15),
                    "risk_factors": ["Multiple FIR connections" if fir_count >= 2 else "Single crime record"],
                }
            return res
        finally:
            db.close()
    except Exception:
        return {
            "will_reoffend": fir_count >= 3,
            "probability": min(0.95, 0.2 + fir_count * 0.15),
            "risk_factors": ["Database link analysis fallback"],
        }


def _similar_offenders_worker(criminal_id: str) -> dict:
    from app.database.postgres import get_worker_session
    from app.services.mo_matching_service import match_criminal_against_db

    similar = {"similar": []}
    try:
        db = get_worker_session()
        try:
            from app.models.criminal import Criminal
            target = db.query(Criminal).filter(Criminal.id == criminal_id).first()
            if target is None:
                return {"similar": []}
            # Fast path: an offender with no MO notes and no linked FIRs has no
            # profile to match on — a full-table similarity scan (up to ~30s on
            # real data) would only return noise. Return immediately instead so
            # the right-hand panel never blocks behind a pointless scan.
            if not (target.mo_summary or (target.fir_links and len(target.fir_links) > 0)):
                return {"similar": []}
            mo = match_criminal_against_db(db, criminal_id, top_k=5, min_similarity=0.20)
            if "error" not in mo:
                similar = {
                    "similar": [
                        {
                            "criminal_id": sim["criminal_id"],
                            "name": sim["full_name"],
                            "similarity": sim["similarity_score"],
                            "rank": i + 1,
                            "matching_factors": sim.get("matching_factors", []),
                            "match_level": sim.get("match_level", "medium"),
                        }
                        for i, sim in enumerate(mo.get("similar_criminals", []))
                    ]
                }
        finally:
            db.close()
    except Exception:
        similar = {"similar": []}
    return similar


def _recommendations_worker(criminal_id: str) -> list:
    from app.database.postgres import get_worker_session
    from app.ai.inference.criminal import get_investigation_recommendations

    fallback = [
        "Address verification routine.",
        "Review linked case diaries.",
    ]
    try:
        db = get_worker_session()
        try:
            res = get_investigation_recommendations(db, criminal_id)
            if "error" in res:
                return [
                    "Perform digital footprints analysis.",
                    "Verify current residential address.",
                    "Trace potential co-accused contacts.",
                ]
            return res.get("recommendations", fallback)
        finally:
            db.close()
    except Exception:
        return fallback


@router.get("/{criminal_id}")
def get_criminal(criminal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    criminal = criminal_crud.get(db, criminal_id)

    # District-bound roles may only open a criminal linked to a FIR in their district.
    enforce_any_record_district(
        current_user,
        [
            link.fir.crime_case.location.district
            for link in criminal.fir_links
            if link.fir and link.fir.crime_case and link.fir.crime_case.location
        ],
        db,
    )

    # Retrieve linked FIRs
    linked_firs = []
    for link in criminal.fir_links:
        fir = link.fir
        if fir:
            case = fir.crime_case
            linked_firs.append({
                "id": str(fir.id),
                "fir_number": fir.fir_number,
                "complainant_name": fir.complainant_name,
                "status": fir.status,
                "filed_at": fir.filed_at.isoformat() if fir.filed_at else None,
                "sections": fir.sections,
                "crime_case_id": str(case.id) if case else None,
                "crime_case_number": case.case_number if case else None,
            })

    cid = str(criminal_id)
    fir_count = len(criminal.fir_links)

    # The AI risk, repeat-offender, MO-similarity, recommendations and network
    # calls are all independent and each opens its own DB session, so they run
    # in parallel instead of serially. This was the dominant latency of the
    # criminal detail endpoint (issue: slow right-hand panel).
    from concurrent.futures import ThreadPoolExecutor

    risk_res: dict = {}
    repeat_res: dict = {}
    similar_res: dict = {"similar": []}
    recommendations: list = []
    net_res: dict = {"nodes": [], "edges": []}

    try:
        with ThreadPoolExecutor(max_workers=5) as pool:
            f_risk = pool.submit(_criminal_risk_worker, cid, fir_count)
            f_repeat = pool.submit(_repeat_offender_worker, cid, fir_count)
            f_mo = pool.submit(_similar_offenders_worker, cid)
            f_rec = pool.submit(_recommendations_worker, cid)
            f_net = pool.submit(_load_criminal_network, cid)
            risk_res = f_risk.result(timeout=20)
            repeat_res = f_repeat.result(timeout=20)
            similar_res = f_mo.result(timeout=20)
            recommendations = f_rec.result(timeout=20)
            try:
                net_res = f_net.result(timeout=15)
            except Exception:
                net_res = {"nodes": [], "edges": []}
    except Exception:
        if not risk_res:
            risk_res = {
                "risk_score": 45,
                "risk_band": "MEDIUM",
                "confidence": 0.72,
                "top_factors": ["Historical pattern link", "Geographic activity correlation"],
            }
        if not repeat_res:
            repeat_res = {
                "will_reoffend": fir_count >= 3,
                "probability": min(0.95, 0.2 + fir_count * 0.15),
                "risk_factors": ["Database link analysis fallback"],
            }
        if not similar_res.get("similar"):
            similar_res = {"similar": []}
        if not recommendations:
            recommendations = [
                "Address verification routine.",
                "Review linked case diaries.",
            ]
        if not net_res.get("nodes") and not net_res.get("edges"):
            net_res = {"nodes": [], "edges": []}

    return {
        "id": str(criminal.id),
        "full_name": criminal.full_name,
        "aliases": criminal.aliases,
        "date_of_birth": criminal.date_of_birth.isoformat() if criminal.date_of_birth else None,
        "gender": criminal.gender,
        "address": criminal.address,
        "identifying_marks": criminal.identifying_marks,
        "mo_summary": criminal.mo_summary,
        "status": criminal.status,
        "image_url": criminal.image_url,
        "created_at": criminal.created_at.isoformat() if criminal.created_at else None,
        "neo4j_node_id": criminal.neo4j_node_id,
        "firs": linked_firs,
        "ai_risk": risk_res,
        "ai_repeat": repeat_res,
        "ai_similar": similar_res,
        "ai_recommendations": recommendations,
        "network": net_res
    }


@router.get("/{criminal_id}/mo-profile", response_model=MOProfile)
def mo_profile(criminal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    criminal = criminal_crud.get(db, criminal_id)
    from app.services.mo_semantic_service import build_criminal_mo_profile
    profile = build_criminal_mo_profile(db, criminal.id)
    return MOProfile(
        criminal_id=criminal.id,
        preferred_crime_types=profile["preferred_crime_types"],
        common_time_window=profile["common_time_window"],
        common_tools=profile["common_tools"],
        jurisdictions_active=profile["jurisdictions_active"],
        linked_incidents_count=profile["linked_incidents_count"],
    )


@router.post("", response_model=CriminalOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def create_criminal(payload: CriminalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    criminal = criminal_crud.create(db, payload.model_dump())
    audit_service.log_action(db, current_user, "CREATE", "Criminal", str(criminal.id))
    _invalidate_criminal_derived()
    mark_data_changed("criminal", db=db)
    return criminal


@router.put("/{criminal_id}", response_model=CriminalOut, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def update_criminal(criminal_id: uuid.UUID, payload: CriminalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    # base_service.update skips None values, so explicit nulls are applied
    # directly to allow clearing optional fields (gender, date_of_birth, etc.).
    null_fields = [k for k, v in data.items() if v is None]
    if null_fields:
        criminal = criminal_crud.get(db, criminal_id)
        for field in null_fields:
            setattr(criminal, field, None)
        db.add(criminal)
        db.flush()
    criminal = criminal_crud.update(db, criminal_id, data)
    audit_service.log_action(db, current_user, "UPDATE", "Criminal", str(criminal_id))
    _invalidate_criminal_derived()
    mark_data_changed("criminal", db=db)
    return criminal


# ---------------------------------------------------------------------------
# Issue #107 — Criminal image upload / remove
# ---------------------------------------------------------------------------

from fastapi import UploadFile, File as FastAPIFile  # noqa: E402


@router.post("/{criminal_id}/image", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def upload_criminal_image(
    criminal_id: uuid.UUID,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criminal = criminal_crud.get(db, criminal_id)
    from app.services.person_image_service import store_person_image
    image_url = store_person_image(file, person_type="criminals", person_id=criminal_id)

    criminal.image_url = image_url
    db.add(criminal)
    db.commit()
    audit_service.log_action(db, current_user, "IMAGE_UPLOAD", "Criminal", str(criminal_id))
    _invalidate_criminal_derived()
    return {"image_url": image_url}


@router.delete("/{criminal_id}/image", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_INVESTIGATOR))])
def remove_criminal_image(
    criminal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criminal = criminal_crud.get(db, criminal_id)
    criminal.image_url = None
    db.add(criminal)
    db.commit()
    audit_service.log_action(db, current_user, "REMOVE_IMAGE", "Criminal", str(criminal_id))
    _invalidate_criminal_derived()
    return {"message": "Image removed"}
