"""Investigation Hub — officer-centric unified investigation intelligence.

Provides a fast, mobile-friendly entry point for KSP officers:

* ``GET /investigation-hub/search``   — grouped federation search across real
  authorized records (persons, cases, FIRs, locations, police stations and
  modus-operandi matches).
* ``GET /investigation-hub/interpret`` — natural-language (English + Kannada +
  mixed) interpretation of a clue into structured retrieval filters.
* ``POST /investigation-hub/image-search`` — honest image-search workflow.
  No face-matching engine ships with SAKSHA, so this endpoint reports a safe
  "unavailable" state and never fabricates an identity match.

Every result originates from the real, authorized database.  Nothing is invented.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ALL_ROLES,
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    require_roles,
)
from app.database.postgres import get_db
from app.auth.scope import enforce_district_scope, is_multi_district
from app.models.crime import CrimeCase
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.location import Location
from app.models.officer import Officer
from app.models.victim import Victim
from app.services.mo_semantic_service import search_similar_mo

router = APIRouter(
    prefix="/investigation-hub",
    tags=["Investigation Hub"],
    dependencies=[Depends(require_roles(*ALL_ROLES))],
)

# Roles permitted to view MO (semantic) intelligence.  Other roles still see
# the person/case/FIR/location/station groups but not MO matches.
_MO_ROLES = (ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR, ROLE_POLICYMAKER)

# ---------------------------------------------------------------------------
# Kannada / mixed-language support
# ---------------------------------------------------------------------------

# Kannada -> English crime category mapping
_KANNADA_CRIME = {
    "ಕೊಲೆ": "murder", "ಕೊಲೆ ಪ್ರಕರಣ": "murder", "ಹತ್ಯೆ": "murder",
    "ಕಳ್ಳತನ": "theft", "ಕಳವು": "theft", "ಚೋರಿ": "theft",
    "ನಕಲಿ": "fraud", "ವಂಚನೆ": "fraud",
    "ಮಾದಕವಸ್ತು": "narcotics", "ಡ್ರಗ್ಸ್": "narcotics", "ಔಷಧ": "narcotics",
    "ಅತ್ಯಾಚಾರ": "assault", "ಹಲ್ಲೆ": "assault", "ದಾಳಿ": "assault",
    "ಅಪಹರಣ": "kidnapping", "ಕಿಡ್ನಾಪ್": "kidnapping",
    "ದರೋಡೆ": "robbery", "ದರೋಡೆಯ": "robbery",
    "ಕೊಲೆ/ದರೋಡೆ": "robbery", "ಸುಲಿಗೆ": "extortion",
}

# Kannada district -> English district
_KANNADA_DISTRICT = {
    "ಬೆಂಗಳೂರು": "Bengaluru Urban", "ಬೆಂಗಳೂರು ಅರ್ಬನ್": "Bengaluru Urban",
    "ಬೆಂಗಳೂರು ನಗರ": "Bengaluru Urban", "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ": "Bengaluru Rural",
    "ಮೈಸೂರು": "Mysuru", "ಮಂಗಳೂರು": "Mangaluru", "ಬೆಳಗಾವಿ": "Belagavi",
    "ಬಳ್ಳಾರಿ": "Ballari", "ಕಲಬುರಗಿ": "Kalaburagi", "ಹಾಸನ": "Hassan",
    "ತುಮಕೂರು": "Tumkuru", "ಧಾರವಾಡ": "Dharwad",
}

# Kannada injury / MO indicator words -> normalized English keyword
_KANNADA_MO = {
    "ಕುತ್ತಿಗೆ": "neck", "ಕುತ್ತಿಗೆ ಗಾಯ": "neck", "ಗಂಟಲು": "neck",
    "ಕತ್ತರಿಸಿ": "cut", "ಕತ್ತರಿಸಿದ": "cut", "ಇರಿದ": "stabbed", "ಇರಿಯುವ": "stab",
    "ಗನ್": "gun", "ಬಂದೂಕು": "gun", "ಪಿಸ್ತೂಲ್": "pistol", "ಚಾಕು": "knife",
    "ಕೊಡಲಿ": "axe", "ಎತ್ತುಗ": "crowbar",
}

_KANNADA_STATION = {
    "ಕೆಂಪೇಗೌಡ ನಗರ": "Kempegowda Nagar", "ವೈಟ್‌ಫೀಲ್ಡ್": "Whitefield",
    "ಕೆ ಆರ್ ಪುರಂ": "KR Puram", "ಇಂದಿರಾನಗರ": "Indiranagar",
    "ಜಯನಗರ": "Jayanagar", "ಕೋರಮಂಗಲ": "Koramangala",
}

_KANNADA_CONNECTORS = {
    "ಯಾವುದು": "", "ಯಾವ": "", "ಇವರ": "", "ನ": "", "ಇದೆ": "", "ತೋರಿಸಿ": "",
    "ಅಲ್ಲಿ": "", "ಎಲ್ಲ": "", "ಪ್ರಕರಣಗಳನ್ನು": "case", "ಪ್ರಕರಣ": "case",
    "ಸಂಬಂಧ": "related", "ಹಿಂದಿನ": "previous", "ಇದೇ": "similar",
}

# Kanglish (Kannada in Roman characters) normalization
_KANGLISH_TO_KANNADA: dict[str, str] = {
    "tanike": "ತನಿಖೆ",
    "thanike": "ತನಿಖೆ",
    "shankita": "ಶಂಕಿತ",
    "shankitha": "ಶಂಕಿತ",
    "saakshya": "ಸಾಕ್ಷ್ಯ",
    "sakshya": "ಸಾಕ್ಷ್ಯ",
    "aparadha": "ಅಪರಾಧ",
    "prakarana": "ಪ್ರಕರಣ",
    "guptachara": "ಗುಪ್ತಚರ",
    "huduku": "ಹುಡುಕು",
    "huduki": "ಹುಡುಕು",
    "adhikari": "ಅಧಿಕಾರಿ",
    "badhita": "ಬಾಧಿತ",
    "nirbandha": "ಬಂಧನ",
    "varadhi": "ವರದಿ",
    "jaala": "ಜಾಲ",
    "apaya": "ಅಪಾಯ",
    "namaskara": "ನಮಸ್ಕಾರ",
    "namaskar": "ನಮಸ್ಕಾರ",
    "police": "ಪೊಲೀಸ್",
    "kelsa": "ಕೆಲಸ",
    "maneya": "ಮನೆಯ",
    "halli": "ಹಳ್ಳಿ",
    "nagara": "ನಗರ",
    "jilla": "ಜಿಲ್ಲೆ",
    "thani": "ತನಿ",
    "case": "ಕೇಸ್",
    "murder": "ಕೊಲೆ",
    "theft": "ಕಳ್ಳತನ",
    "robbery": "ದರೋಡೆ",
    "assault": "ಹಲ್ಲೆ",
    "fraud": "ಮೋಸ",
    "cyber": "ಸೈಬರ್",
    "drug": "ಮಾದಕ",
    "gang": "ಗ್ಯಾಂಗ್",
    "weapon": "ಆಯುಧ",
    "vehicle": "ವಾಹನ",
    "phone": "ಫೋನ್",
    "night": "ರಾತ್ರಿ",
    "day": "ಹಗಲು",
    "morning": "ಬೆಳಿಗ್ಗೆ",
    "evening": "ಸಂಜೆ",
}


def _is_kanglish(text: str) -> bool:
    """Detect if text is Kanglish (Roman characters used for Kannada words)."""
    if not text:
        return False
    text_lower = text.lower().strip()
    words = text_lower.split()
    kanglish_hits = sum(1 for w in words if w in _KANGLISH_TO_KANNADA or any(k in w for k in _KANGLISH_TO_KANNADA))
    return kanglish_hits >= len(words) * 0.3 and len(words) >= 1


def _normalize_kanglish(text: str) -> str:
    """Convert Kanglish terms to their English equivalents for search."""
    text_lower = text.lower()
    result = text_lower
    for kanglish, kannada in _KANGLISH_TO_KANNADA.items():
        result = result.replace(kanglish, kannada)
    return result

_KANNADA_TIME = {
    "ಕಳೆದ ವಾರ": 7, "ಕಳೆದ ತಿಂಗಳ": 30, "ಕಳೆದ ವರ್ಷ": 365,
    "ಈ ವಾರ": 7, "ಈ ತಿಂಗಳ": 30, "ಈ ವರ್ಷ": 365, "ಇತ್ತೀಚಿನ": 30,
}

_ENGLISH_TIME = {
    "last week": 7, "past week": 7, "last month": 30, "past month": 30,
    "last year": 365, "past year": 365, "this week": 7, "this month": 30,
    "this year": 365, "recent": 30,
}

_ENGLISH_CRIME = [
    "murder", "homicide", "theft", "burglary", "robbery", "fraud", "cyber crime",
    "narcotics", "smuggling", "assault", "illegal mining", "domestic violence",
    "property disputes", "kidnapping", "extortion", "rape",
]

_ENGLISH_MO = {
    "neck": "neck", "cut": "cut", "stabb": "stabbing", "knife": "knife",
    "gun": "gun", "shoot": "shooting", "strangl": "strangulation",
    "poison": "poison", "hammer": "hammer", "axe": "axe",
}

_CASE_RE = re.compile(r"CR-\d{4}-[A-Z]{2,4}-\d+", re.I)
_FIR_RE = re.compile(r"(?:FIR[-\s]*)?(\d{3,4}/[A-Z]{0,4}/?\d{3,4})", re.I)
_PHONE_RE = re.compile(r"(\+91[\s-]?\d{5}[\s-]?\d{5}|\b\d{10}\b)")


def _contains_any(text: str, keys: list[str]) -> bool:
    lower = text.lower()
    return any(k.lower() in lower for k in keys)


class Interpretation(BaseModel):
    """Structured interpretation of a natural-language clue."""

    query: str
    detected_language: str  # "kannada" | "english" | "mixed" | "kanglish"
    person_name: str | None = None
    case_number: str | None = None
    fir_number: str | None = None
    district: str | None = None
    station: str | None = None
    crime_type: str | None = None
    mo_keywords: list[str] = []
    phone: str | None = None
    date_range_days: int | None = None
    search_term: str = ""
    confidence: str = "low"  # high | medium | low
    notes: list[str] = []


def _normalise_crime(text: str) -> str | None:
    lower = text.lower()
    for en in _ENGLISH_CRIME:
        if en in lower:
            return en.title()
    return None


def _fuzzy_kannada(text: str, mapping: dict[str, str]) -> str | None:
    for kan, en in mapping.items():
        if kan in text:
            return en
    return None


def _collect_mo_keywords(text: str) -> list[str]:
    found: list[str] = []
    lower = text.lower()
    for kan, en in _KANNADA_MO.items():
        if kan in text and en not in found:
            found.append(en)
    for en, norm in _ENGLISH_MO.items():
        if en in lower and norm not in found:
            found.append(norm)
    return found


@router.get("/interpret", response_model=Interpretation)
def interpret_query(
    q: str = Query(..., min_length=1, max_length=500),
    current_user: Any = Depends(get_current_user),
):
    """Interpret an English, Kannada, or mixed-language investigation clue into
    structured retrieval filters.  Mirrors the entity extraction used by the AI
    chat but adds Kannada + mixed-language support against the real gazetteers.
    """
    if not q.strip():
        return Interpretation(query=q)

    # Detect language presence (Kannada Unicode range 0C80-0CFF).
    kannada_chars = sum(1 for ch in q if 0x0C80 <= ord(ch) <= 0x0CFF)
    if kannada_chars and _contains_any(q, _KANNADA_CONNECTORS.keys()):
        detected = "kannada"
        mixed = bool(re.search(r"[a-zA-Z]", q))
        if mixed:
            detected = "mixed"
    elif _is_kanglish(q):
        detected = "kanglish"
    else:
        detected = "english"

    result = Interpretation(query=q, detected_language=detected, search_term=q.strip())

    # Kanglish normalization: map Romanized Kannada words to Kannada script
    # so existing gazetteers can match them.
    normalized_q = q
    if detected == "kanglish":
        normalized_q = _normalize_kanglish(q)

    # Case / FIR / phone identifiers
    case_match = _CASE_RE.search(q)
    if case_match:
        result.case_number = case_match.group(0).upper()
        result.search_term = case_match.group(0).upper()
        result.confidence = "high"
        return result

    fir_match = _FIR_RE.search(q)
    if fir_match:
        result.fir_number = fir_match.group(1)
        result.search_term = fir_match.group(1)
        result.confidence = "high"
        return result

    phone_match = _PHONE_RE.search(q)
    if phone_match:
        result.phone = phone_match.group(1)

    # District & station — Kannada then English gazetteers.
    result.district = _fuzzy_kannada(normalized_q, _KANNADA_DISTRICT)
    if not result.district:
        for d in [
            "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangaluru",
            "Belagavi", "Ballari", "Kalaburagi", "Hassan", "Tumkuru", "Dharwad",
            "Bengaluru", "Bangalore", "Mysore", "Mangalore", "Bellary",
        ]:
            if d.lower() in q.lower():
                result.district = d
                break

    result.station = _fuzzy_kannada(normalized_q, _KANNADA_STATION)
    if not result.station:
        for s in [
            "Whitefield", "KR Puram", "Kempegowda Nagar", "Indiranagar",
            "Jayanagar", "Koramangala", "HSR Layout", "Peenya", "Yelahanka",
            "Devaraja", "Mangaluru Harbor", "Belagavi City",
        ]:
            if s.lower() in q.lower():
                result.station = s
                break

    # Crime type
    result.crime_type = _fuzzy_kannada(normalized_q, _KANNADA_CRIME)
    if not result.crime_type:
        result.crime_type = _normalise_crime(q)

    # MO / injury indicators
    result.mo_keywords = _collect_mo_keywords(normalized_q)

    # Time ranges — Kannada then English.
    for kan, days in _KANNADA_TIME.items():
        if kan in normalized_q:
            result.date_range_days = days
            break
    if result.date_range_days is None:
        lower = q.lower()
        for en, days in _ENGLISH_TIME.items():
            if en in lower:
                result.date_range_days = days
                break

    # Person name heuristic (English only; Kannada names are left for search).
    if detected != "english":
        mo = re.search(r"(?:of|named|about|for|regarding)\s+([A-Za-z][A-Za-z ]{1,60})$", q)
        if mo:
            result.person_name = mo.group(1).strip().title()
    else:
        name = re.search(
            r"(?:named|about|for|of|who is|regarding)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",
            q,
        )
        if name:
            candidate = name.group(1)
            if not re.match(r"CR-\d{4}", candidate) and not re.match(r"FIR", candidate):
                result.person_name = candidate

    # Build a clean search term dominated by the extracted filters so the
    # grouped search returns real, useful records.
    parts: list[str] = []
    if result.person_name:
        parts.append(result.person_name)
    if result.crime_type:
        parts.append(result.crime_type)
    if result.district:
        parts.append(result.district)
    if result.station:
        parts.append(result.station)
    if result.mo_keywords:
        parts.extend(result.mo_keywords)
    if not parts:
        parts.append(q.strip())

    result.search_term = " ".join(dict.fromkeys(parts))

    # Confidence scoring
    strength = sum([
        bool(result.case_number),
        bool(result.fir_number),
        bool(result.person_name),
        bool(result.district),
        bool(result.station),
        bool(result.crime_type),
        bool(result.mo_keywords),
        bool(result.phone),
        bool(result.date_range_days),
    ])
    if strength >= 2:
        result.confidence = "high"
    elif strength == 1:
        result.confidence = "medium"
    if case_match or fir_match:
        result.confidence = "high"

    if not strength and detected in ("kannada", "mixed", "kanglish"):
        result.notes.append(
            "Kannada query interpreted, but no district/crime/person filter could be "
            "matched confidently. Suggest searching by district, station or crime type."
        )
    return result


# ---------------------------------------------------------------------------
# Grouped federated search
# ---------------------------------------------------------------------------


class SearchItem(BaseModel):
    id: str
    type: str  # person | case | fir | location | station | mo
    name: str
    detail: str
    status: str | None = None
    subtitle: str | None = None
    meta: dict[str, Any] = {}


class GroupedSearchResult(BaseModel):
    query: str
    persons: list[SearchItem] = []
    victims: list[SearchItem] = []
    cases: list[SearchItem] = []
    firs: list[SearchItem] = []
    locations: list[SearchItem] = []
    stations: list[SearchItem] = []
    mo_matches: list[SearchItem] = []
    mo_intelligence: bool = False
    total: int = 0
    provenance: str = "LIVE"


@router.get("/search", response_model=GroupedSearchResult)
def investigation_search(
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Federated grouped search across real authorized records.

    Respects user role: MO (semantic) matches are only returned for roles that
    hold MO intelligence permission.  Only categories that actually have results
    are populated.
    """
    query = q.strip()
    pattern = f"%{query}%"
    attempt_mo = current_user.role.name in _MO_ROLES if hasattr(current_user, "role") else True

    effective_district = enforce_district_scope(current_user, None, db)
    scoped = bool(effective_district and not is_multi_district(current_user))

    result = GroupedSearchResult(query=query)
    result.provenance = "LIVE"

    # ── Persons (criminals) ──
    persons = db.query(Criminal)
    if scoped:
        persons = persons.join(FIRCriminalLink, FIRCriminalLink.criminal_id == Criminal.id)
        persons = persons.join(FIR, FIR.id == FIRCriminalLink.fir_id)
        persons = persons.join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        persons = persons.join(Location, Location.id == CrimeCase.location_id)
        persons = persons.filter(Location.district == effective_district).distinct()
    persons = persons.options(selectinload(Criminal.fir_links)).filter(
        or_(
            Criminal.full_name.ilike(pattern),
            Criminal.aliases.ilike(pattern),
            Criminal.mo_summary.ilike(pattern),
        )
    ).limit(limit).all()
    for c in persons:
        case_count = len(c.fir_links)
        result.persons.append(SearchItem(
            id=f"criminal-{c.id}",
            type="person",
            name=c.full_name,
            detail=(c.aliases and f"Alias: {c.aliases}" or "No aliases"),
            status=c.status,
            subtitle=f"{case_count} linked FIR(s) | gang: {c.gang_affiliation or 'N/A'}",
            meta={"criminal_id": str(c.id), "case_count": case_count, "gang": c.gang_affiliation},
        ))

    # ── Victims / witnesses ──
    victims = db.query(Victim)
    if scoped:
        victims = victims.join(FIRVictimLink, FIRVictimLink.victim_id == Victim.id)
        victims = victims.join(FIR, FIR.id == FIRVictimLink.fir_id)
        victims = victims.join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        victims = victims.join(Location, Location.id == CrimeCase.location_id)
        victims = victims.filter(Location.district == effective_district).distinct()
    victims = victims.filter(
        or_(
            Victim.full_name.ilike(pattern),
            Victim.contact_number.ilike(pattern),
            Victim.address.ilike(pattern),
        )
    ).limit(limit).all()
    for v in victims:
        result.victims.append(SearchItem(
            id=f"victim-{v.id}",
            type="victim",
            name=v.full_name,
            detail=f"Victim/Witness | {v.gender or 'Gender N/A'} | Age {v.age or 'N/A'}",
            status="active",
            subtitle=(v.contact_number and f"Contact: {v.contact_number}") or (v.address or "No address"),
            meta={"victim_id": str(v.id)},
        ))

    # ── Cases (locations batch-loaded to avoid N+1) ──
    cases = db.query(CrimeCase)
    if scoped:
        cases = cases.join(Location, Location.id == CrimeCase.location_id)
        cases = cases.filter(Location.district == effective_district)
    cases = cases.filter(
        or_(
            CrimeCase.case_number.ilike(pattern),
            CrimeCase.description.ilike(pattern),
            CrimeCase.mo_tags.ilike(pattern),
        )
    ).limit(limit).all()
    location_ids = [c.location_id for c in cases if c.location_id is not None]
    location_map: dict[str, Location] = {}
    if location_ids:
        for loc in db.query(Location).filter(Location.id.in_(location_ids)).all():
            location_map[str(loc.id)] = loc
    for c in cases:
        location = location_map.get(str(c.location_id)) if c.location_id else None
        district = location.district if location else None
        result.cases.append(SearchItem(
            id=f"case-{c.id}",
            type="case",
            name=c.case_number,
            detail=(c.description or "")[:120],
            status=c.status,
            subtitle=district or "District N/A",
            meta={
                "case_id": str(c.id),
                "district": district,
                "occurred_at": str(c.occurred_at.date()) if c.occurred_at else None,
                "category_id": str(c.category_id),
            },
        ))

    # ── FIRs ──
    firs = db.query(FIR)
    if scoped:
        firs = firs.join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        firs = firs.join(Location, Location.id == CrimeCase.location_id)
        firs = firs.filter(Location.district == effective_district)
    firs = firs.filter(
        or_(
            FIR.fir_number.ilike(pattern),
            FIR.complainant_name.ilike(pattern),
            FIR.sections.ilike(pattern),
        )
    ).limit(limit).all()
    for f in firs:
        result.firs.append(SearchItem(
            id=f"fir-{f.id}",
            type="fir",
            name=f.fir_number,
            detail=f"Complainant: {f.complainant_name}",
            status=f.status,
            subtitle=f"Sections: {f.sections or 'N/A'} | Case: {f.crime_case_id}",
            meta={"fir_id": str(f.id), "case_id": str(f.crime_case_id)},
        ))

    # ── Locations ──
    locations = db.query(Location)
    if scoped:
        locations = locations.filter(Location.district == effective_district)
    locations = locations.filter(
        or_(
            Location.station.ilike(pattern),
            Location.district.ilike(pattern),
            Location.address.ilike(pattern),
        )
    ).limit(limit).all()
    compact: dict[str, SearchItem] = {}
    for loc in locations:
        key = f"{loc.district}|{loc.station or ''}"
        if key not in compact:
            compact[key] = SearchItem(
                id=f"location-{loc.id}",
                type="location",
                name=f"{loc.station or loc.district}, {loc.district}",
                detail=f"District: {loc.district} | Station: {loc.station or 'N/A'}",
                status="active",
                subtitle="Crime location",
                meta={"location_id": str(loc.id), "district": loc.district, "station": loc.station},
            )
    result.locations = list(compact.values())

    # ── Police stations (deduplicated district/station pairs incl. all) ──
    stations: dict[str, SearchItem] = {}
    station_rows = db.query(Location).filter(Location.station.isnot(None))
    if scoped:
        station_rows = station_rows.filter(Location.district == effective_district)
    station_rows = station_rows.limit(200).all()
    for s in station_rows:
        key2 = f"{s.district}|{s.station}"
        if key2 in stations:
            continue
        if (query.lower() in s.station.lower()) or (query.lower() in s.district.lower()):
            stations[key2] = SearchItem(
                id=f"station-{s.id}",
                type="station",
                name=s.station,
                detail=f"Station in {s.district}",
                status="active",
                subtitle=s.district,
                meta={"district": s.district, "station": s.station},
            )
    result.stations = list(stations.values())

    # ── MO semantic matches (role-gated) ──
    result.mo_intelligence = attempt_mo
    if attempt_mo and query:
        try:
            mo = search_similar_mo(db, query, top_k=limit)

            def _mo_doc_district(m):
                kind = m.get("kind")
                doc_id = m.get("doc_id") or ""
                raw = doc_id.partition("-")[2] if "-" in doc_id else doc_id
                try:
                    uid = uuid.UUID(raw)
                except (ValueError, TypeError, AttributeError):
                    return None
                if kind == "crime_case":
                    case = db.query(CrimeCase).filter(CrimeCase.id == uid).first()
                    return case.location.district if case and case.location else None
                if kind == "fir":
                    fir = db.query(FIR).filter(FIR.id == uid).first()
                    return fir.crime_case.location.district if fir and fir.crime_case and fir.crime_case.location else None
                if kind == "criminal":
                    crim = db.query(Criminal).filter(Criminal.id == uid).first()
                    if crim:
                        for link in crim.fir_links or []:
                            if link.fir and link.fir.crime_case and link.fir.crime_case.location:
                                return link.fir.crime_case.location.district
                    return None
                return None

            for m in mo.get("results", []):
                if m.get("kind") not in ("criminal", "crime_case", "fir"):
                    continue
                if scoped and _mo_doc_district(m) != effective_district:
                    continue
                meta = m.get("meta") or {}
                result.mo_matches.append(SearchItem(
                    id=f"mo-{m.get('doc_id')}",
                    type="mo",
                    name=m.get("title") or "MO Match",
                    detail=(m.get("excerpt") or "")[:140],
                    status=m.get("kind"),
                    subtitle=f"Similarity: {m.get('similarity')} | {m.get('kind')}",
                    meta={**meta, "doc_id": m.get("doc_id"), "kind": m.get("kind")},
                ))
        except Exception:
            # Semantic engine may be unavailable; never let it break the search.
            result.mo_matches = []

    result.total = (
        len(result.persons) + len(result.victims) + len(result.cases) + len(result.firs) +
        len(result.locations) + len(result.stations) + len(result.mo_matches)
    )
    return result


class ImageSearchResult(BaseModel):
    status: str  # "unavailable" | "available"
    message: str
    safe_fallback: str
    upload_required: bool = True
    matches: list[Any] = []
    capability: str = "none"


@router.post("/image-search", response_model=ImageSearchResult)
async def image_search(
    current_user: Any = Depends(get_current_user),
):
    """Honest image investigation workflow.

    SAKSHA does not ship a face-recognition / embedding matching engine and its
    authorized person image dataset is not enabled for reverse matching.  This
    endpoint therefore reports a safe *unavailable* state rather than fabricating
    identity matches.  The UI uses this to guide the officer to identifier search.
    """
    return ImageSearchResult(
        status="unavailable",
        message=(
            "Image/face matching is not currently available for this dataset. "
            "SAKSHA does not fabricate identity matches."
        ),
        safe_fallback=(
            "Search by name, FIR number, case number, complaint number, "
            "police station, district, location, crime type or MO description instead."
        ),
        upload_required=True,
        capability="none",
    )
