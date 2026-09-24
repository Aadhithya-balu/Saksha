"""Backend fetcher — executes query plans against PostgreSQL, Neo4j, and ML services.

Issue 160 hardening:
- PII (residential addresses, contact numbers) is REDACTED unless the caller's
  role is authorized to view it.
- ML prediction sections are built ONLY from real database records and always
  declare whether output came from a trained model ("ML") or the rule-based
  fallback ("FALLBACK") — fabricated inputs/defaults are never used.
"""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.chat.query_planner import BackendCall, QueryPlan

# Roles authorized to see unredacted personal identifiers in chat answers.
PII_PRIVILEGED_ROLES = {"admin", "crime_analyst", "investigator", "inspector"}

_PII_REDACTED = "[REDACTED - insufficient role clearance]"


# ----- district scoping subqueries (chat honors the caller's district) -----
def _fir_in_district(db: Session, district: str):
    from app.models.crime import CrimeCase
    from app.models.fir import FIR
    from app.models.location import Location
    return db.query(FIR.id).join(CrimeCase, CrimeCase.id == FIR.crime_case_id).join(
        Location, Location.id == CrimeCase.location_id
    ).filter(Location.district == district)


def _criminal_in_district(db: Session, district: str):
    from app.models.crime import CrimeCase
    from app.models.fir import FIR, FIRCriminalLink
    from app.models.location import Location
    return db.query(FIRCriminalLink.criminal_id).join(
        FIR, FIR.id == FIRCriminalLink.fir_id
    ).join(CrimeCase, CrimeCase.id == FIR.crime_case_id).join(
        Location, Location.id == CrimeCase.location_id
    ).filter(Location.district == district)


def _victim_in_district(db: Session, district: str):
    from app.models.crime import CrimeCase
    from app.models.fir import FIR, FIRVictimLink
    from app.models.location import Location
    return db.query(FIRVictimLink.victim_id).join(
        FIR, FIR.id == FIRVictimLink.fir_id
    ).join(CrimeCase, CrimeCase.id == FIR.crime_case_id).join(
        Location, Location.id == CrimeCase.location_id
    ).filter(Location.district == district)


def _evidence_in_district(db: Session, district: str):
    """Evidence ids whose owning case sits in ``district``."""
    from app.models.crime import CrimeCase
    from app.models.evidence import Evidence
    from app.models.location import Location
    return db.query(Evidence.id).join(
        CrimeCase, CrimeCase.id == Evidence.case_id
    ).join(Location, Location.id == CrimeCase.location_id).filter(Location.district == district)


def _criminal_ids_in_district(db: Session, district: str) -> set[str]:
    """Criminal UUID strings belonging to the caller's district (for graph post-filtering)."""
    from app.models.crime import CrimeCase
    from app.models.fir import FIR, FIRCriminalLink
    from app.models.location import Location
    rows = (
        db.query(FIRCriminalLink.criminal_id)
        .join(FIR, FIR.id == FIRCriminalLink.fir_id)
        .join(CrimeCase, CrimeCase.id == FIR.crime_case_id)
        .join(Location, Location.id == CrimeCase.location_id)
        .filter(Location.district == district)
        .all()
    )
    return {str(r[0]) for r in rows}


def user_may_view_pii(user: Any) -> bool:
    """True when the authenticated user's role permits unredacted PII.

    Fail-safe: if the role cannot be read without a lazy DB load (e.g. the
    auth session is already closed by the time the streaming body runs), we
    default to False so PII is redacted instead of crashing the chat stream.
    """
    try:
        role = getattr(user, "role", None)
        role_name = getattr(role, "name", None)
    except Exception:
        return False
    return role_name in PII_PRIVILEGED_ROLES


@dataclass
class BackendResult:
    source: str
    data_type: str
    content: str
    raw_data: Any = None
    success: bool = True
    error: str | None = None
    records: list[dict[str, Any]] | None = None


class BackendFetcher:
    """Executes query plans by calling existing backend services directly."""

    def execute(self, plan: QueryPlan, db: Session, redact_pii: bool = False,
                district: str | None = None) -> list[BackendResult]:
        self._redact_pii = redact_pii
        # District scope for the *caller*. Bound users see only their district's
        # records; multi-district callers pass None (all). A non-matching
        # sentinel yields zero records so district-less bound accounts fail
        # closed (no cross-district leakage) and chat answers honestly refuse.
        self._district = (district or "").strip() or None
        # Analytics is fast read-only SQL: keep it off the AI-worker pool.
        # Analytics-only plans run sequentially on the request DB (via a
        # dedicated short session inside ``_exec_analytics``); worker sessions
        # are reserved for slow/parallel AI jobs.
        analytics_only = all(c.service == "analytics" for c in plan.backend_calls)
        if plan.parallel and len(plan.backend_calls) > 1 and not analytics_only:
            return self._execute_parallel(plan, db)
        return self._execute_sequential(plan, db)

    def _execute_parallel(self, plan: QueryPlan, db: Session) -> list[BackendResult]:
        from app.database.postgres import get_worker_session
        results: list[BackendResult] = []
        def _thread_worker(call: BackendCall) -> BackendResult:
            thread_db = get_worker_session()
            try:
                return self._execute_call(call, thread_db)
            finally:
                thread_db.close()
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {
                pool.submit(_thread_worker, call): call
                for call in plan.backend_calls
            }
            for future in as_completed(futures):
                call = futures[future]
                try:
                    results.append(future.result())
                except Exception as exc:
                    results.append(BackendResult(
                        source=call.service,
                        data_type=call.method,
                        content="",
                        success=False,
                        error=str(exc),
                    ))
        return results

    def _execute_sequential(self, plan: QueryPlan, db: Session) -> list[BackendResult]:
        results: list[BackendResult] = []
        for call in plan.backend_calls:
            results.append(self._execute_call(call, db))
        return results

    def _execute_call(self, call: BackendCall, db: Session) -> BackendResult:
        try:
            if call.service == "postgres":
                return self._exec_postgres(call, db)
            if call.service == "neo4j":
                return self._exec_neo4j(call, db)
            if call.service == "ml":
                return self._exec_ml(call, db)
            if call.service == "analytics":
                return self._exec_analytics(call, db)
            if call.service == "kg":
                return self._exec_kg(call, db)
            return BackendResult(
                source=call.service, data_type=call.method,
                content="Unknown service", success=False,
            )
        except Exception:
            return BackendResult(
                source=call.service, data_type=call.method,
                content="", success=False, error="Service call failed",
            )

    def _exec_postgres(self, call: BackendCall, db: Session) -> BackendResult:
        method = call.method
        params = call.params
        redact = getattr(self, "_redact_pii", False)

        if method == "get_fir":
            return self._pg_get_fir(db, params)
        if method == "search_firs":
            return self._pg_search_firs(db, params)
        if method == "list_firs":
            return self._pg_list_firs(db, params)
        if method == "get_case":
            return self._pg_get_case(db, params)
        if method == "search_cases":
            return self._pg_search_cases(db, params)
        if method == "list_cases":
            return self._pg_list_cases(db, params)
        if method == "get_criminal":
            return self._pg_get_criminal(db, params, redact_pii=redact)
        if method == "search_criminals":
            return self._pg_search_criminals(db, params, redact_pii=redact)
        if method == "get_officer":
            return self._pg_get_officer(db, params)
        if method == "list_officers":
            return self._pg_list_officers(db, params)
        if method == "list_notifications":
            return self._pg_list_notifications(db, params)
        if method == "get_victims":
            return self._pg_get_victims(db, params)
        if method == "get_evidence_for_case":
            return self._pg_get_evidence_for_case(db, params)
        if method == "list_evidence":
            return self._pg_list_evidence(db, params)
        return BackendResult(source="postgres", data_type=method, content="Method not implemented")

    def _pg_get_fir(self, db: Session, params: dict) -> BackendResult:
        from app.models.fir import FIR

        def _scoped(q):
            d = getattr(self, "_district", None)
            if d:
                ids = [r[0] for r in _fir_in_district(db, d).all()]
                q = q.filter(FIR.id.in_(ids))
            return q

        fir_num = (params.get("fir_number", "") or "").strip()
        if fir_num.startswith("ordinal:"):
            idx = int(fir_num.split(":", 1)[1]) - 1
            if idx < 0:
                idx = 0
            fir = _scoped(db.query(FIR)).order_by(FIR.filed_at.desc()).offset(idx).first()
        else:
            # Exact (case-insensitive) match first, then prefix, then a
            # prefix-agnostic contains match so "FIR-045/BNG/2026" / "045/BNG/2026"
            # both resolve to the same record.
            normalized = re.sub(r"^FIR[\s-]*:?", "", fir_num, flags=re.I).strip()
            fir = _scoped(db.query(FIR)).filter(func.lower(FIR.fir_number) == fir_num.lower()).first()
            if not fir:
                fir = _scoped(db.query(FIR)).filter(FIR.fir_number.ilike(f"{fir_num}%")).first()
            if not fir and normalized != fir_num:
                fir = _scoped(db.query(FIR)).filter(FIR.fir_number.ilike(f"%{normalized}%")).first()
        if not fir:
            return BackendResult(source="postgres", data_type="fir", content="No FIR found.", raw_data=None)
        content = self._format_fir(fir)
        return BackendResult(source="postgres", data_type="fir", content=content, raw_data={"fir_number": fir.fir_number, "id": str(fir.id)}, records=[{"type": "fir", "fir_number": fir.fir_number, "id": str(fir.id), "status": fir.status}])

    def _pg_search_firs(self, db: Session, params: dict) -> BackendResult:
        from app.models.fir import FIR
        query = params.get("query", "")
        q = db.query(FIR)
        d = getattr(self, "_district", None)
        if d:
            ids = [r[0] for r in _fir_in_district(db, d).all()]
            q = q.filter(FIR.id.in_(ids))
        firs = q.filter(
            FIR.fir_number.ilike(f"%{query}%")
            | FIR.complainant_name.ilike(f"%{query}%")
            | FIR.narrative.ilike(f"%{query}%")
        ).limit(10).all()
        if not firs:
            return BackendResult(source="postgres", data_type="firs", content="No FIRs match the search.")
        parts = [self._format_fir(f) for f in firs]
        return BackendResult(
            source="postgres", data_type="firs",
            content="\n---\n".join(parts),
            raw_data=[{"fir_number": f.fir_number, "id": str(f.id)} for f in firs],
            records=[{"type": "fir", "fir_number": f.fir_number, "id": str(f.id), "status": f.status} for f in firs],
        )

    def _pg_list_firs(self, db: Session, params: dict) -> BackendResult:
        from app.models.fir import FIR
        limit = params.get("limit", 10)
        q = db.query(FIR)
        d = getattr(self, "_district", None)
        if d:
            ids = [r[0] for r in _fir_in_district(db, d).all()]
            q = q.filter(FIR.id.in_(ids))
        firs = q.order_by(FIR.filed_at.desc()).limit(limit).all()
        if not firs:
            return BackendResult(source="postgres", data_type="firs", content="No FIRs in the database.")
        parts = [self._format_fir(f) for f in firs]
        return BackendResult(
            source="postgres", data_type="firs",
            content="\n---\n".join(parts),
            raw_data=[{"fir_number": f.fir_number, "id": str(f.id)} for f in firs],
            records=[{"type": "fir", "fir_number": f.fir_number, "id": str(f.id), "status": f.status} for f in firs],
        )

    def _pg_get_evidence_for_case(self, db: Session, params: dict) -> BackendResult:
        """Evidence for a referenced case/FIR, resolved through the case record.

        The case/FIR itself is looked up under the caller's district scope, so
        evidence for records outside the authorized district never surfaces.
        """
        from app.models.evidence import Evidence

        case_num = (params.get("case_number", "") or "").strip().rstrip(".,;:!?")
        fir_num = (params.get("fir_number", "") or "").strip().rstrip(".,;:!?")
        if not case_num and not fir_num:
            return BackendResult(source="postgres", data_type="evidence", content="No case or FIR reference provided.")

        case = None
        if case_num:
            case = self._pg_get_case(db, {"case_number": case_num})
            if not case.success or not case.raw_data:
                return BackendResult(source="postgres", data_type="evidence",
                                     content=f"No authorized case matching {case_num} was found.")
            case_id = case.raw_data["id"]
        else:
            from app.models.crime import CrimeCase
            from app.models.fir import FIR
            fir_res = self._pg_get_fir(db, {"fir_number": fir_num})
            if not fir_res.success or not fir_res.raw_data:
                return BackendResult(source="postgres", data_type="evidence",
                                     content=f"No authorized FIR matching {fir_num} was found.")
            fir = db.query(FIR).filter(FIR.id == fir_res.raw_data["id"]).first()
            if fir is None or fir.crime_case_id is None:
                return BackendResult(source="postgres", data_type="evidence",
                                     content="The FIR is not linked to a case, so no evidence records are available.")
            case_id = str(fir.crime_case_id)

        from app.models.crime import CrimeCase
        case_obj = db.query(CrimeCase).filter(CrimeCase.id == case_id).first()
        case_num_val = case_obj.case_number if case_obj else None

        evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).order_by(Evidence.created_at.desc()).all()
        if not evidence_items:
            return BackendResult(source="postgres", data_type="evidence",
                                 content="No evidence records are linked to this case.")
        parts = [f"- {e.title} ({e.evidence_type or 'item'}; status: {e.status or 'Pending'})" for e in evidence_items]
        return BackendResult(
            source="postgres", data_type="evidence",
            content=f"Evidence linked to case ({len(evidence_items)} records):\n" + "\n".join(parts),
            raw_data=[{"title": e.title, "id": str(e.id), "status": e.status, "case_number": case_num_val} for e in evidence_items],
            records=[{"type": "evidence", "title": e.title, "id": str(e.id), "status": e.status, "case_number": case_num_val} for e in evidence_items],
        )

    def _pg_list_evidence(self, db: Session, params: dict) -> BackendResult:
        from app.models.evidence import Evidence
        limit = params.get("limit", 12)
        q = db.query(Evidence)
        d = getattr(self, "_district", None)
        if d:
            ids = [r[0] for r in _evidence_in_district(db, d).all()]
            if not ids:
                return BackendResult(source="postgres", data_type="evidence",
                                     content="No evidence records in your authorized district.")
            q = q.filter(Evidence.id.in_(ids))
        items = q.order_by(Evidence.created_at.desc()).limit(limit).all()
        if not items:
            return BackendResult(source="postgres", data_type="evidence", content="No evidence records found.")
        parts = [f"- {e.title} ({e.evidence_type or 'item'}; status: {e.status or 'Pending'})" for e in items]
        return BackendResult(
            source="postgres", data_type="evidence",
            content=f"Recent evidence records ({len(items)} shown):\n" + "\n".join(parts),
            raw_data=[{"title": e.title, "id": str(e.id), "status": e.status,
                       "case_number": e.crime_case.case_number if e.crime_case else None} for e in items],
            records=[{"type": "evidence", "title": e.title, "id": str(e.id), "status": e.status,
                      "case_number": e.crime_case.case_number if e.crime_case else None} for e in items],
        )

    def _pg_get_case(self, db: Session, params: dict) -> BackendResult:
        from app.models.crime import CrimeCase
        from app.models.location import Location

        def _scoped(q):
            d = getattr(self, "_district", None)
            if d:
                q = q.join(Location, Location.id == CrimeCase.location_id).filter(Location.district == d)
            return q

        case_num = (params.get("case_number", "") or "").strip().rstrip(".,;:!?")
        if not case_num:
            return BackendResult(source="postgres", data_type="case", content="No case number provided.")
        # Exact match first so a precise identifier never falls back to noisier
        # partial/contains matching (which can pull in unrelated records).
        case = _scoped(db.query(CrimeCase)).filter(func.lower(CrimeCase.case_number) == case_num.lower()).first()
        if not case:
            case = _scoped(db.query(CrimeCase)).filter(CrimeCase.case_number.ilike(f"{case_num}%")).first()
        if not case:
            case = _scoped(db.query(CrimeCase)).filter(CrimeCase.case_number.ilike(f"%{case_num}%")).first()
        if not case:
            return BackendResult(source="postgres", data_type="case", content="No case found.")
        content = self._format_case(case)
        return BackendResult(source="postgres", data_type="case", content=content, raw_data={"case_number": case.case_number, "id": str(case.id)}, records=[{"type": "case", "case_number": case.case_number, "id": str(case.id), "status": case.status}])

    def _pg_search_cases(self, db: Session, params: dict) -> BackendResult:
        from app.models.crime import CrimeCase
        from app.models.location import Location
        query_text = params.get("query", "")
        category = params.get("category", "")
        q = db.query(CrimeCase)
        d = getattr(self, "_district", None)
        if d:
            q = q.join(Location, Location.id == CrimeCase.location_id).filter(Location.district == d)
        if query_text:
            q = q.filter(
                CrimeCase.case_number.ilike(f"%{query_text}%")
                | CrimeCase.description.ilike(f"%{query_text}%")
                | CrimeCase.mo_tags.ilike(f"%{query_text}%")
            )
        if category:
            q = q.join(CrimeCase.category).filter(
                CrimeCase.category.has(name=category) if hasattr(CrimeCase.category, 'has')
                else CrimeCase.description.ilike(f"%{category}%")
            )
        cases = q.limit(10).all()
        if not cases:
            return BackendResult(source="postgres", data_type="cases", content="No matching cases found.")
        parts = [self._format_case(c) for c in cases]
        return BackendResult(
            source="postgres", data_type="cases",
            content="\n---\n".join(parts),
            raw_data=[{"case_number": c.case_number, "id": str(c.id)} for c in cases],
            records=[{"type": "case", "case_number": c.case_number, "id": str(c.id), "status": c.status} for c in cases],
        )

    def _pg_list_cases(self, db: Session, params: dict) -> BackendResult:
        from app.models.crime import CrimeCase
        from app.models.location import Location
        limit = params.get("limit", 20)
        q = db.query(CrimeCase)
        d = getattr(self, "_district", None)
        if d:
            q = q.join(Location, Location.id == CrimeCase.location_id).filter(Location.district == d)
        cases = q.order_by(CrimeCase.reported_at.desc()).limit(limit).all()
        if not cases:
            return BackendResult(source="postgres", data_type="cases", content="No cases in database.")
        parts = [self._format_case(c) for c in cases]
        return BackendResult(
            source="postgres", data_type="cases",
            content="\n---\n".join(parts),
            raw_data=[{"case_number": c.case_number, "id": str(c.id)} for c in cases],
            records=[{"type": "case", "case_number": c.case_number, "id": str(c.id), "status": c.status} for c in cases],
        )

    def _pg_get_criminal(self, db: Session, params: dict, redact_pii: bool = False) -> BackendResult:
        from app.models.criminal import Criminal
        name = (params.get("name", "") or "").strip().rstrip(".,;:!?")
        if not name:
            return BackendResult(source="postgres", data_type="criminal", content="No criminal name provided.")

        d = getattr(self, "_district", None)
        criminals: list = []
        # 1) Exact full-name match (case-insensitive) — the only acceptable
        #    result for a precise personal identifier.
        exact = db.query(Criminal).filter(func.lower(Criminal.full_name) == name.lower()).limit(2).all()
        if d:
            allowed = {row[0] for row in _criminal_in_district(db, d).all()}
            exact = [c for c in exact if c.id in allowed]
        if exact:
            criminals = exact
        else:
            # 2) Name present as an exact comma-separated alias token.
            alias_rows = db.query(Criminal).filter(Criminal.aliases.ilike(f"%{name}%")).limit(12).all()
            if d:
                alias_rows = [c for c in alias_rows if c.id in allowed]
            for c in alias_rows:
                tokens = [t.strip() for t in (c.aliases or "").split(",")]
                if any(t.lower() == name.lower() for t in tokens):
                    criminals.append(c)
            if not criminals:
                # 3) Strongly selective prefix match (unique leading fragment).
                partial_rows = db.query(Criminal).filter(Criminal.full_name.ilike(f"{name}%")).limit(6).all()
                if d:
                    partial_rows = [c for c in partial_rows if c.id in allowed]
                partials = partial_rows
                if len(partials) == 1:
                    criminals = partials
                elif len(partials) > 1:
                    criminals = partials[:2]
                else:
                    # 4) Contained name, then alias/partial — always kept tiny so
                    #    fuzzy text never floods the answer with unrelated records.
                    contains = db.query(Criminal).filter(Criminal.full_name.ilike(f"%{name}%")).limit(6).all()
                    if d:
                        contains = [c for c in contains if c.id in allowed]
                    if len(contains) == 1:
                        criminals = contains
                    else:
                        criminals = contains[:2]
                if not criminals:
                    alias_partial = db.query(Criminal).filter(Criminal.aliases.ilike(f"%{name}%")).limit(6).all()
                    if d:
                        alias_partial = [c for c in alias_partial if c.id in allowed]
                    criminals = alias_partial[:2]

        if not criminals:
            return BackendResult(source="postgres", data_type="criminal", content="No criminal record found.")
        parts = [self._format_criminal(c, redact_pii=redact_pii) for c in criminals]
        return BackendResult(
            source="postgres", data_type="criminal",
            content="\n---\n".join(parts),
            raw_data=[{"name": c.full_name, "id": str(c.id), "status": c.status} for c in criminals],
            records=[{"type": "criminal", "name": c.full_name, "id": str(c.id), "status": c.status} for c in criminals],
        )

    def _pg_search_criminals(self, db: Session, params: dict, redact_pii: bool = False) -> BackendResult:
        from app.models.criminal import Criminal
        query = (params.get("query", "") or "").strip()
        if not query:
            return BackendResult(
                source="postgres", data_type="criminals",
                content="No criminal search query provided.",
            )
        pattern = f"%{query}%"
        d = getattr(self, "_district", None)
        allowed = {row[0] for row in _criminal_in_district(db, d).all()} if d else None
        looks_like_name = (
            bool(re.match(r"^[A-Za-z][A-Za-z .'\u2019-]{1,50}$", query))
            and query.count(" ") <= 3
        )
        if looks_like_name:
            # Person look-up: match only name fields. Exact/prefix matches lead;
            # free-text (MO/address) matches are excluded so a name search never
            # dumps records that merely mention the queried name.
            rows = db.query(Criminal).filter(
                Criminal.full_name.ilike(pattern) | Criminal.aliases.ilike(pattern)
            ).limit(10).all()
            if allowed is not None:
                rows = [c for c in rows if c.id in allowed]

            def _rank(c):
                lower = c.full_name.lower()
                if lower == query.lower():
                    return 0
                if lower.startswith(query.lower()):
                    return 1
                if query.lower() in lower:
                    return 2
                return 3
            criminals = sorted(rows, key=_rank)[:6]
        else:
            # MO/keyword style search: name matches still outrank free-text ones.
            rows = db.query(Criminal).filter(
                Criminal.full_name.ilike(pattern)
                | Criminal.aliases.ilike(pattern)
                | Criminal.address.ilike(pattern)
                | Criminal.mo_summary.ilike(pattern)
                | Criminal.identifying_marks.ilike(pattern)
            ).limit(15).all()
            if allowed is not None:
                rows = [c for c in rows if c.id in allowed]

            def _rank(c):
                lower = c.full_name.lower()
                if query.lower() in lower:
                    return 0
                if query.lower() in (c.aliases or "").lower():
                    return 1
                return 2
            criminals = sorted(rows, key=_rank)[:8] if rows else []
        if not criminals:
            return BackendResult(
                source="postgres", data_type="criminals",
                content=f"No criminal records match '{query}'.",
            )
        parts = [self._format_criminal(c, redact_pii=redact_pii) for c in criminals]
        return BackendResult(
            source="postgres", data_type="criminals",
            content="\n---\n".join(parts),
            raw_data=[{"name": c.full_name, "id": str(c.id), "status": c.status} for c in criminals],
            records=[{"type": "criminal", "name": c.full_name, "id": str(c.id), "status": c.status} for c in criminals],
        )

    def _pg_get_officer(self, db: Session, params: dict) -> BackendResult:
        from app.models.officer import Officer

        def _scoped(q):
            d = getattr(self, "_district", None)
            if d:
                q = q.filter(Officer.district == d)
            return q

        name = params.get("name", "")
        officer = _scoped(db.query(Officer)).filter(
            Officer.name.ilike(f"%{name}%") | Officer.badge_number.ilike(f"%{name}%")
        ).first()
        if not officer:
            return BackendResult(source="postgres", data_type="officer", content="No officer found.")
        content = (
            f"Officer: {officer.name}, Badge: {officer.badge_number}, "
            f"Rank: {officer.rank or 'N/A'}, Station: {officer.station}, "
            f"District: {officer.district or 'N/A'}, Status: {officer.status}"
        )
        return BackendResult(source="postgres", data_type="officer", content=content, raw_data={"name": officer.name, "badge": officer.badge_number}, records=[{"type": "officer", "name": officer.name, "badge": officer.badge_number, "district": officer.district}])

    def _pg_list_officers(self, db: Session, params: dict) -> BackendResult:
        from app.models.officer import Officer
        limit = params.get("limit", 20)
        q = db.query(Officer)
        d = getattr(self, "_district", None)
        if d:
            q = q.filter(Officer.district == d)
        officers = q.limit(limit).all()
        if not officers:
            return BackendResult(source="postgres", data_type="officers", content="No officers found.")
        parts = [
            f"{o.name} (Badge: {o.badge_number}, Rank: {o.rank or 'N/A'}, Station: {o.station})"
            for o in officers
        ]
        return BackendResult(source="postgres", data_type="officers", content="\n".join(parts))

    def _pg_list_notifications(self, db: Session, params: dict) -> BackendResult:
        from app.models.notification import Notification
        # Notifications have no district column and are per-user; a
        # district-bound account must not see other users' / other districts'
        # notifications from chat. State/system-level callers (district None)
        # may list them; bound users are pointed at the Notifications page
        # instead of leaking records they are not authorized to see.
        d = getattr(self, "_district", None)
        if d:
            return BackendResult(
                source="postgres", data_type="notifications",
                content="Notifications are personal and district-bound in this chat. "
                        "Please open the Notifications page to review them.",
            )
        limit = params.get("limit", 20)
        notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(limit).all()
        if not notifs:
            return BackendResult(source="postgres", data_type="notifications", content="No notifications.")
        parts = [f"[{n.severity.upper()}] {n.title}: {n.message}" for n in notifs]
        return BackendResult(source="postgres", data_type="notifications", content="\n".join(parts))

    def _pg_get_victims(self, db: Session, params: dict) -> BackendResult:
        from app.models.victim import Victim
        name = params.get("name", "")
        q = db.query(Victim)
        d = getattr(self, "_district", None)
        if d:
            ids = [r[0] for r in _victim_in_district(db, d).all()]
            q = q.filter(Victim.id.in_(ids))
        victims = q.filter(Victim.full_name.ilike(f"%{name}%")).all()
        if not victims:
            return BackendResult(source="postgres", data_type="victims", content="No victims found.")
        parts = [f"Victim: {v.full_name}, Age: {v.age or 'N/A'}, Gender: {v.gender or 'N/A'}" for v in victims]
        return BackendResult(source="postgres", data_type="victims", content="\n".join(parts))

    def _exec_neo4j(self, call: BackendCall, db: Session) -> BackendResult:
        method = call.method
        params = call.params
        try:
            from app.services.neo4j.client import is_neo4j_available
            if not is_neo4j_available():
                return self._neo4j_sql_fallback(method, params, db)
        except Exception:
            return self._neo4j_sql_fallback(method, params, db)

        if method == "get_person_network":
            return self._neo4j_person_network(params, db)
        if method == "get_full_network":
            return self._neo4j_full_network(db)
        if method == "get_gangs":
            return self._neo4j_gangs(db)
        if method == "shortest_path":
            return self._neo4j_shortest_path(params, db)
        return BackendResult(source="neo4j", data_type=method, content="Method not implemented")

    def _neo4j_person_network(self, params: dict, db: Session) -> BackendResult:
        from app.services.network.network_service import get_person_network_graph
        name = params.get("name", "")
        # ``district`` is honoured by the unified graph service on BOTH the
        # Neo4j and SQL paths, so a district-bound caller never sees
        # cross-district links.
        graph = get_person_network_graph(db, person_id=name, depth=2, district=getattr(self, "_district", None))
        if not graph.nodes:
            return BackendResult(source="neo4j", data_type="network", content="No network data found.")
        parts = []
        for node in graph.nodes[:15]:
            parts.append(f"Node: {node.name} (Type: {node.category.value}, Risk: {node.riskScore})")
        id_to_name = {n.id: n.name for n in graph.nodes}
        for edge in graph.edges[:15]:
            source_name = id_to_name.get(edge.source) or edge.source
            target_name = id_to_name.get(edge.target) or edge.target
            parts.append(f"Link: {source_name} --[{edge.relationship}]--> {target_name}")
        return BackendResult(
            source="neo4j", data_type="network",
            content="\n".join(parts),
            raw_data={"nodes": len(graph.nodes), "edges": len(graph.edges)},
        )

    def _neo4j_full_network(self, db: Session) -> BackendResult:
        from app.services.network.network_service import get_full_network_graph
        # Passing district forces the graph builder to SQL-filter by district
        # (Neo4j holds a coarse cross-district projection and is bypassed for
        # case-filtered queries), guaranteeing no district leak.
        graph = get_full_network_graph(db, district=getattr(self, "_district", None))
        parts = [f"Network: {graph.total_nodes} nodes, {graph.total_edges} edges"]
        for node in graph.nodes[:20]:
            parts.append(f"  {node.name} ({node.category.value}, risk={node.riskScore})")
        return BackendResult(source="neo4j", data_type="network", content="\n".join(parts))

    def _neo4j_gangs(self, db: Session) -> BackendResult:
        from app.services.network.network_service import get_organization_gang_networks
        gangs = get_organization_gang_networks(db)
        d = getattr(self, "_district", None)
        if d:
            allowed = _criminal_ids_in_district(db, d)
            scoped = []
            for g in gangs:
                member_ids = [
                    str(m.id).replace("criminal-", "", 1) for m in g.members
                ]
                if any(mid in allowed for mid in member_ids):
                    scoped.append(g)
            gangs = scoped
        parts = []
        for g in gangs:
            members = ", ".join(m.name for m in g.members)
            parts.append(
                f"Gang: {g.name} (Leader: {g.leader_name}, Risk: {g.risk_level}, "
                f"Territory: {g.territory}, Members: {members})"
            )
        if not parts:
            return BackendResult(source="neo4j", data_type="gangs",
                                 content="No gang networks found in your authorized district.")
        return BackendResult(source="neo4j", data_type="gangs", content="\n".join(parts))

    def _neo4j_shortest_path(self, params: dict, db: Session) -> BackendResult:
        from app.services.network.network_service import find_shortest_path
        source = params.get("source", "")
        target = params.get("target", "")
        # Shortest-path traversal can hop across districts, and the underlying
        # graph service has no district predicate. Rather than leak
        # cross-district connectivity to a bound caller, point them at the
        # district-scoped Network intelligence page instead of answering.
        if getattr(self, "_district", None):
            return BackendResult(
                source="neo4j", data_type="shortest_path",
                content="Shortest-path analysis is only available for state-level access in chat. "
                        "Please use the Network intelligence page, which honours your authorized district.",
            )
        result = find_shortest_path(db, source, target)
        if not result.found:
            return BackendResult(source="neo4j", data_type="shortest_path", content=result.explanation)
        path_names = " -> ".join(n.name for n in result.path_nodes)
        return BackendResult(
            source="neo4j", data_type="shortest_path",
            content=f"Path ({result.distance} hops): {path_names}",
        )

    def _neo4j_sql_fallback(self, method: str, params: dict, db: Session) -> BackendResult:
        if method == "get_person_network":
            from app.services.network.network_service import get_person_network_graph
            name = params.get("name", "")
            if not name:
                return BackendResult(source="postgres", data_type="network_fallback", content="No network data.")
            graph = get_person_network_graph(db, person_id=name, depth=2, district=getattr(self, "_district", None))
            if not graph.nodes:
                return BackendResult(source="postgres", data_type="network_fallback", content="No network data.")
            id_to_name = {n.id: n.name for n in graph.nodes}
            parts = [
                f"{id_to_name.get(e.source, 'Unknown')} --[{e.relationship}]--> {id_to_name.get(e.target, 'Unknown')}"
                for e in graph.edges[:20]
            ]
            content = "\n".join(parts) or "No network linkages found."
            return BackendResult(source="postgres", data_type="network_fallback", content=content)
        if method == "get_full_network":
            from app.services.network.network_service import get_full_network_graph
            graph = get_full_network_graph(db, district=getattr(self, "_district", None))
            return BackendResult(
                source="postgres", data_type="network_fallback",
                content=f"Network (SQL fallback): {graph.total_nodes} nodes, {graph.total_edges} edges",
            )
        if method == "get_gangs":
            return self._neo4j_gangs(db)
        return BackendResult(source="neo4j", data_type=method, content="Neo4j unavailable, no SQL fallback.")

    def _exec_kg(self, call: BackendCall, db: Session) -> BackendResult:
        method = call.method
        if method == "fragment_by_person":
            return self._kg_fragment_by_person(db, call.params)
        if method == "fragment_by_case":
            return self._kg_fragment_by_case(db, call.params)
        return BackendResult(source="kg", data_type=method, content="KG method not implemented", success=False)

    def _kg_fragment_by_person(self, db: Session, params: dict) -> BackendResult:
        """Cross-case knowledge-graph retrieval for a named person.

        Uses the Phase 3 knowledge graph (backend/app/services
        /knowledge_graph_service.py). Honest no-graph / no-node answers —
        never fabricated connections.
        """
        import traceback
        import uuid as uuid_mod
        from app.core.exceptions import NotFoundException
        from app.services.knowledge_graph_service import build_fragment, get_node_by_ref

        name = (params.get("name", "") or "").strip()
        if not name:
            return BackendResult(source="kg", data_type="kg_fragment", content="No person name provided.", success=False)

        criminal_res = self._pg_get_criminal(db, {"name": name}, redact_pii=False)
        candidates = criminal_res.records or []
        if not candidates:
            return BackendResult(
                source="kg", data_type="kg_fragment",
                content=f"No criminal record matches '{name}' — cannot look up cross-case connections.",
                success=False,
            )

        d = getattr(self, "_district", None)
        try:
            for cand in candidates:
                raw_id = cand.get("id") or ""
                try:
                    node = get_node_by_ref(db, "criminal", uuid_mod.UUID(str(raw_id)))
                except (NotFoundException, ValueError, TypeError):
                    continue
                depth = min(int(params.get("depth", 2)), 3)
                fragment = build_fragment(db, node, depth=depth)
                if fragment.get("nodes"):
                    return self._kg_render_fragment(fragment, d)
            return BackendResult(
                source="kg", data_type="kg_fragment",
                content=f"Knowledge graph has no cross-case connections for '{name}' yet.",
                success=False,
            )
        except Exception as exc:
            return BackendResult(
                source="kg", data_type="kg_fragment",
                content="Knowledge graph service is unavailable right now.",
                success=False, error=traceback.format_exc(limit=2) or str(exc),
            )

    def _kg_fragment_by_case(self, db: Session, params: dict) -> BackendResult:
        import traceback
        from app.core.exceptions import NotFoundException
        from app.services.knowledge_graph_service import build_fragment, get_node_by_ref

        case_id = (params.get("case_number", "") or "").strip()
        if not case_id:
            return BackendResult(source="kg", data_type="kg_fragment", content="No case number provided.", success=False)
        try:
            from app.models.crime import CrimeCase
            case = db.query(CrimeCase).filter(CrimeCase.case_number == case_id).first()
            if not case:
                return BackendResult(
                    source="kg", data_type="kg_fragment",
                    content=f"No case '{case_id}' found — cannot look up cross-case connections.", success=False,
                )
            try:
                node = get_node_by_ref(db, "case", case.id)
            except NotFoundException:
                return BackendResult(
                    source="kg", data_type="kg_fragment",
                    content="Knowledge graph has no node for that case (rebuild the graph first).",
                    success=False,
                )
            d = getattr(self, "_district", None)
            fragment = build_fragment(db, node, depth=min(int(params.get("depth", 2)), 3))
            return self._kg_render_fragment(fragment, d)
        except Exception as exc:
            return BackendResult(
                source="kg", data_type="kg_fragment",
                content="Knowledge graph service is unavailable right now.",
                success=False, error=traceback.format_exc(limit=2) or str(exc),
            )

    def _kg_render_fragment(self, fragment: dict, district: str | None) -> BackendResult:
        district = (district or "").strip() or None
        nodes = fragment.get("nodes") or []
        edges = fragment.get("edges") or []
        if district:
            nodes = [n for n in nodes if district in (n.districts or [])]
            keep = {n.id for n in nodes}
            edges = [
                e for e in edges
                if e.source_node_id in keep and e.target_node_id in keep
            ]
        if not nodes or not edges:
            return BackendResult(
                source="kg", data_type="kg_fragment",
                content="Knowledge graph has no cross-case connections for that entity yet.",
                success=False,
            )
        by_id = {n.id: n.label for n in nodes}
        node_lines = [
            f"Node: {n.label} (type: {n.node_type}, districts: {', '.join(n.districts or []) or 'n/a'})"
            for n in nodes[:25]
        ]
        edge_lines = [
            f"Link: {by_id.get(e.source_node_id, e.source_node_id)} --[{e.relationship_type}"
            f"{' (DERIVED: ' + (e.basis or 'inferred') + ')' if e.direction == 'DERIVED' else ''}]--> "
            f"{by_id.get(e.target_node_id, e.target_node_id)}"
            for e in edges[:25]
        ]
        content = "### Saksha Knowledge Graph - Cross-Case Fragment\n" + "\n".join(node_lines + edge_lines)
        return BackendResult(
            source="kg", data_type="kg_fragment",
            content=content,
            records=[
                {"type": "kg_node", "label": n.label, "node_type": n.node_type, "id": str(n.id)}
                for n in nodes[:25]
            ],
        )

    def _exec_ml(self, call: BackendCall, db: Session) -> BackendResult:
        method = call.method
        params = call.params
        # District-bound callers always get their own district's ML numbers,
        # never a fabricated/global default.
        d = getattr(self, "_district", None)
        if d and not params.get("district"):
            params = {**params, "district": d}

        if method == "risk_predict":
            return self._ml_risk_predict(params, db)
        if method == "forecast":
            return self._ml_forecast(params, db)
        if method == "hotspot_predict":
            return self._ml_hotspot_predict(params)
        if method == "find_similar_offenders":
            return self._ml_similar(params, db)
        if method == "criminal_risk":
            return self._ml_criminal_risk(params, db)
        return BackendResult(source="ml", data_type=method, content="ML method not implemented")

    def _ml_risk_predict(self, params: dict, db: Session) -> BackendResult:
        """District risk from REAL database records only (issue 160).

        The previous implementation fabricated default inputs ("Bengaluru
        Urban", crime_count=10). Now the district's actual recorded cases are
        used, and the answer declares ML vs FALLBACK mode.
        """
        from app.ai.inference.risk import get_prediction_mode, predict_risk
        from app.models.crime import CrimeCase
        from sqlalchemy.orm import joinedload

        district = params.get("district", "")
        q = db.query(CrimeCase).options(
            joinedload(CrimeCase.location),
            joinedload(CrimeCase.category),
        )
        cases = q.all()
        if district:
            cases = [c for c in cases if c.location and c.location.district == district]
        if not cases:
            return BackendResult(
                source="ml", data_type="risk",
                content=f"No crime records available for district '{district or 'any'}' — no risk prediction can be produced.",
                raw_data=None,
            )
        records = [
            {
                "occurred_at": c.occurred_at.isoformat() if c.occurred_at else None,
                "district": c.location.district if c.location else "Unknown",
                "category": c.category.name if c.category else "Unknown",
            }
            for c in cases
        ]
        results = predict_risk(records)
        if district:
            results = [r for r in results if r.get("district") == district]
        if not results:
            return BackendResult(source="ml", data_type="risk", content="No prediction available.")
        mode = get_prediction_mode()
        parts = [
            f"District {r['district']}: Risk Score {r['risk_score']}/100 ({r['risk_band']}) "
            f"[prediction mode: {mode}]"
            for r in results[:5]
        ]
        return BackendResult(
            source="ml", data_type="risk",
            content=". ".join(parts),
            raw_data={"predictions": results, "prediction_mode": mode},
        )

    def _ml_forecast(self, params: dict, db: Session) -> BackendResult:
        """Forecast from REAL database records only (issue 160)."""
        from app.ai.inference.risk import predict_forecast
        from app.models.crime import CrimeCase
        from sqlalchemy.orm import joinedload

        district = params.get("district", "")
        months = params.get("months", 6)
        cases = db.query(CrimeCase).options(
            joinedload(CrimeCase.location),
        ).all()
        if district:
            cases = [c for c in cases if c.location and c.location.district == district]
        if not cases:
            return BackendResult(
                source="ml", data_type="forecast",
                content=f"No crime records available for district '{district or 'any'}' — no forecast can be produced.",
                raw_data=None,
            )
        records = [
            {
                "occurred_at": c.occurred_at.isoformat() if c.occurred_at else None,
                "district": c.location.district if c.location else "Unknown",
                "category": c.category.name if c.category else "Unknown",
            }
            for c in cases
        ]
        result = predict_forecast(records)
        if not result:
            return BackendResult(source="ml", data_type="forecast", content="No forecast available.")
        if isinstance(result, list):
            parts = [
                f"{f.get('district', 'Unknown')} month {i+1}: predicted {f.get('predicted_crime_count', 'N/A')} crimes "
                f"(range {f.get('lower_bound', '?')}–{f.get('upper_bound', '?')})"
                for i, f in enumerate(result[:months])
            ]
        else:
            parts = [f"Forecast for {district}: {result}"]
        return BackendResult(source="ml", data_type="forecast", content="\n".join(parts), raw_data=result)

    def _ml_hotspot_predict(self, params: dict) -> BackendResult:
        from app.ai.inference.hotspot import predict as hotspot_predict
        from datetime import datetime
        lat = params.get("lat")
        lon = params.get("lon")
        if lat is None or lon is None:
            # Honest unavailable: never fabricate coordinates for a prediction.
            return BackendResult(
                source="ml",
                data_type="hotspot",
                content="Hotspot prediction needs real coordinates from a FIR/crime record — no fabricated estimate is produced.",
                raw_data=None,
            )
        try:
            result = hotspot_predict([{
                "CaseMasterID": f"CHAT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "IncidentFromDate": datetime.now().isoformat(),
                "latitude": lat,
                "longitude": lon,
                "PoliceStationID": params.get("station", "PS001"),
                "GravityOffenceID": params.get("gravity", "G001"),
                "CrimeMajorHeadID": params.get("category", "Theft"),
            }])
            if not result:
                return BackendResult(source="ml", data_type="hotspot", content="No hotspot prediction available.")
            parts = [f"Hotspot: Risk={h.get('risk_level', 'N/A')}, Count={h.get('predicted_count', 'N/A')}" for h in result[:5]]
            return BackendResult(source="ml", data_type="hotspot", content="\n".join(parts), raw_data=result)
        except Exception as e:
            return BackendResult(source="ml", data_type="hotspot", content=f"Hotspot prediction unavailable: {e}", success=False)

    def _ml_similar(self, params: dict, db: Session) -> BackendResult:
        from app.ai.inference.criminal import find_similar_offenders
        criminal_id = params.get("criminal_id", params.get("name", ""))
        if not criminal_id:
            return BackendResult(source="ml", data_type="similar", content="No criminal ID provided.")
        result = find_similar_offenders(db, criminal_id)
        if not result:
            return BackendResult(source="ml", data_type="similar", content="No similar offenders found.")
        similar_list = result.get("similar_offenders", []) if isinstance(result, dict) else []
        if similar_list:
            parts = [f"Similar: {s.get('name', 'N/A')} (similarity: {s.get('similarity_score', s.get('score', 'N/A'))})" for s in similar_list[:5]]
        else:
            parts = [str(result)]
        return BackendResult(source="ml", data_type="similar", content="\n".join(parts), raw_data=result)

    def _ml_criminal_risk(self, params: dict, db: Session) -> BackendResult:
        from app.ai.inference.criminal import score_criminal_risk
        criminal_id = params.get("criminal_id", "")
        if not criminal_id:
            return BackendResult(source="ml", data_type="criminal_risk", content="No criminal ID provided.")
        result = score_criminal_risk(db, criminal_id)
        if not result:
            return BackendResult(source="ml", data_type="criminal_risk", content="No risk score available.")
        if isinstance(result, dict) and "error" in result:
            return BackendResult(source="ml", data_type="criminal_risk", content=result["error"])
        risk_score = result.get("risk_score", "N/A") if isinstance(result, dict) else "N/A"
        risk_band = result.get("risk_band", "N/A") if isinstance(result, dict) else "N/A"
        return BackendResult(
            source="ml", data_type="criminal_risk",
            content=f"Criminal Risk: {risk_score}/100 ({risk_band})",
            raw_data=result,
        )

    def _exec_analytics(self, call: BackendCall, db: Session) -> BackendResult:
        method = call.method
        district = getattr(self, "_district", None)
        # Analytics is fast, read-only SQL. It must NOT run on the AI-worker
        # session pool (fresh in-memory test engines have no tables, and long
        # jobs shouldn't share the request session): open a dedicated short
        # session from the request DB bind.
        from sqlalchemy.orm import sessionmaker as _analytics_sessionmaker
        analytics_db = _analytics_sessionmaker(bind=db.get_bind())()
        try:
            db = analytics_db
            from app.services.analytics_service import (
                dashboard_summary, category_breakdown, district_comparison,
                hotspots, anomalies, offender_dossiers,
                recent_activity,
            )
            if method == "dashboard_summary":
                s = dashboard_summary(db, district=district)
                content = (
                    f"Total crimes: {s.get('total_crimes', 0)}. "
                    f"Open cases: {s.get('open_crimes', 0)}. "
                    f"Total FIRs: {s.get('total_firs', 0)}. "
                    f"Resolution rate: {s.get('resolution_rate_percent', 0)}%."
                )
                return BackendResult(source="analytics", data_type="summary", content=content, raw_data=s)

            if method == "category_breakdown":
                cats = category_breakdown(db, district=district)
                parts = [f"{c['category']}: {c['count']} cases" for c in cats[:10]]
                return BackendResult(source="analytics", data_type="categories", content=". ".join(parts) or "No data.", raw_data=cats)

            if method == "district_comparison":
                districts = district_comparison(db, district=district)
                parts = [f"{d['district']}: {d['count']} cases" for d in districts[:10]]
                return BackendResult(source="analytics", data_type="districts", content=". ".join(parts) or "No data.", raw_data=districts)

            if method == "hotspots":
                h = hotspots(db, district_id=district)
                hotspot_list = h.get("hotspots", []) if isinstance(h, dict) else (h if isinstance(h, list) else [])
                if not hotspot_list:
                    return BackendResult(source="analytics", data_type="hotspots", content="No hotspot data.")
                parts = [f"{hs.get('name', 'Unknown')} ({hs.get('district_id', 'N/A')}): score={hs.get('score', 0)}" for hs in hotspot_list[:10]]
                return BackendResult(source="analytics", data_type="hotspots", content="\n".join(parts), raw_data=hotspot_list)

            if method == "anomalies":
                a = anomalies(db, district=district)
                if not a:
                    return BackendResult(source="analytics", data_type="anomalies", content="No anomalies detected.")
                parts = [f"Anomaly: {an.get('title', 'Unknown')} (severity: {an.get('severity', 'N/A')})" for an in a[:10]]
                return BackendResult(source="analytics", data_type="anomalies", content="\n".join(parts), raw_data=a)

            if method == "recent_activity":
                days = int(call.params.get("days", 0) or 0)
                ra = recent_activity(db, days=days, district=district)
                parts = [
                    f"System date/time now: {ra['now']}",
                    f"Period analyzed: {ra['period_label']}",
                    f"New crime cases registered: {ra['new_cases']}",
                    f"New FIRs filed: {ra['new_firs']}",
                    f"New evidence items added: {ra['new_evidence']}",
                    f"New criminal profiles added: {ra['new_criminals']}",
                    f"Most recent case on file: {ra['latest_case']}",
                    f"Most recent FIR on file: {ra['latest_fir']}",
                ]
                return BackendResult(
                    source="analytics", data_type="recent_activity",
                    content="\n".join(parts), raw_data=ra,
                )

            if method == "offender_dossiers":
                d = offender_dossiers(db, district=district)
                if not d:
                    return BackendResult(source="analytics", data_type="dossiers", content="No offender data.")
                parts = [
                    f"{o.get('name') or o.get('full_name') or 'Unknown offender'}: Status={o.get('status', 'N/A')}, "
                    f"Classification={o.get('classification', 'N/A')}, Risk={o.get('riskScore', o.get('risk_score', 'N/A'))}, "
                    f"Active Districts={', '.join(o.get('activeDistricts') or []) or 'None'}, "
                    f"Gang={o.get('gangAffiliation', 'N/A')}"
                    for o in d[:10]
                ]
                return BackendResult(source="analytics", data_type="dossiers", content="\n".join(parts), raw_data=d)

            return BackendResult(source="analytics", data_type=method, content="Analytics method not found.")
        except Exception as exc:
            return BackendResult(source="analytics", data_type=method, content="", success=False, error=str(exc))
        finally:
            analytics_db.close()

    @staticmethod
    def _format_fir(fir: Any) -> str:
        parts = [
            f"FIR Number: {fir.fir_number}",
            f"Complainant: {fir.complainant_name}",
            f"Status: {fir.status}",
            f"Sections: {fir.sections or 'N/A'}",
            f"Filed: {fir.filed_at.strftime('%Y-%m-%d %H:%M') if fir.filed_at else 'N/A'}",
        ]
        if fir.narrative:
            narrative = fir.narrative[:300] + ("..." if len(fir.narrative or "") > 300 else "")
            parts.append(f"Narrative: {narrative}")
        if hasattr(fir, "criminal_links") and fir.criminal_links:
            names = [link.criminal.full_name for link in fir.criminal_links if link.criminal]
            if names:
                parts.append(f"Accused/Suspects: {', '.join(names)}")
        return " | ".join(parts)

    @staticmethod
    def _format_case(case: Any) -> str:
        parts = [
            f"Case: {case.case_number}",
            f"Status: {case.status}",
            f"Priority: {case.priority or 'medium'}",
            f"Progress: {case.progress or 0}%",
        ]
        if case.description:
            desc = case.description[:300] + ("..." if len(case.description or "") > 300 else "")
            parts.append(f"Description: {desc}")
        if case.mo_tags:
            parts.append(f"MO Tags: {case.mo_tags}")
        if hasattr(case, "category") and case.category:
            parts.append(f"Category: {case.category.name}")
        if hasattr(case, "location") and case.location:
            loc = case.location
            station = getattr(loc, "station", "") or ""
            district = getattr(loc, "district", "") or ""
            loc_parts = [p for p in [station, district] if p]
            parts.append(f"Location: {', '.join(loc_parts) if loc_parts else 'Unknown'}")
        if case.occurred_at:
            parts.append(f"Occurred: {case.occurred_at.strftime('%Y-%m-%d %H:%M') if case.occurred_at else 'N/A'}")
        if case.reported_at:
            parts.append(f"Reported: {case.reported_at.strftime('%Y-%m-%d %H:%M') if case.reported_at else 'N/A'}")
        if hasattr(case, "firs") and case.firs:
            fir_nums = [f.fir_number for f in case.firs]
            parts.append(f"Linked FIRs: {', '.join(fir_nums)}")
        suspects: list[str] = []
        for fir in getattr(case, "firs", []) or []:
            for link in getattr(fir, "criminal_links", []) or []:
                if getattr(link, "criminal", None) and link.criminal.full_name:
                    name = link.criminal.full_name
                    if name not in suspects:
                        suspects.append(name)
        if suspects:
            parts.append(f"Accused/Suspects: {', '.join(suspects)}")
        if hasattr(case, "assigned_officer") and case.assigned_officer:
            parts.append(f"Assigned Officer: {case.assigned_officer.name} ({case.assigned_officer.badge_number})")
        return " | ".join(parts)

    @staticmethod
    def _format_criminal(c: Any, redact_pii: bool = False) -> str:
        parts = [
            f"Name: {c.full_name}",
            f"Status: {c.status}",
        ]
        if c.aliases:
            parts.append(f"Aliases: {c.aliases}")
        if c.gender:
            parts.append(f"Gender: {c.gender}")
        if c.address:
            parts.append(
                f"Address: {_PII_REDACTED}" if redact_pii else f"Address: {c.address}"
            )
        if c.mo_summary:
            mo = c.mo_summary[:200] + ("..." if len(c.mo_summary or "") > 200 else "")
            parts.append(f"MO: {mo}")
        if c.identifying_marks:
            parts.append(f"Marks: {c.identifying_marks}")
        return " | ".join(parts)

