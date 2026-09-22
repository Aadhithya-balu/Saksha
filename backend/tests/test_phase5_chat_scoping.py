"""Issue #269: Chat district scoping + knowledge-graph retrieval (Phase 5).

Verifies:
1. BackendFetcher honors an explicit district scope for FIR / case /
   criminal / victim record lookups (and never widens it).
2. RAG retrieval drops out-of-scope documents for bound users.
3. Chat KG fragment retrieval surfaces honest cross-case links or an honest
   "no connections" answer (never fabricated).
4. A district-bound user with no resolvable district fails CLOSED: no
   cross-district record leaks into chat retrieval.
"""
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault("APP_DEBUG", "false")

from datetime import datetime, timezone

import pytest

from app.core.security import hash_password
from app.models.crime import CrimeCase
from app.models.crime_category import CrimeCategory
from app.models.criminal import Criminal
from app.models.fir import FIR, FIRCriminalLink, FIRVictimLink
from app.models.location import Location
from app.models.officer import Officer
from app.models.role import Role
from app.models.user import User
from app.models.victim import Victim


def _seed_scoped_data(db_session):
    """Two districts, one case/criminal/FIR/victim each — real records only."""
    cat = CrimeCategory(name="Theft & Burglaries", section_code="IPC 379", severity="high")
    loc_blr = Location(district="Bengaluru Urban", station="Whitefield", latitude=12.97, longitude=77.75)
    loc_mys = Location(district="Mysuru", station="Devaraja", latitude=12.30, longitude=76.64)
    db_session.add_all([cat, loc_blr, loc_mys])
    db_session.flush()

    criminal_blr = Criminal(
        full_name="BLR Suspect Dev", status="at_large",
        mo_summary="burglary in Bengaluru residences",
    )
    criminal_mys = Criminal(
        full_name="MYS Suspect Prema", status="at_large",
        mo_summary="burglary in Mysuru residences",
    )
    victim_blr = Victim(full_name="BLR Victim Ana", contact_number="1111111111", gender="female", age=30)
    victim_mys = Victim(full_name="MYS Victim Kavi", contact_number="2222222222", gender="female", age=40)
    db_session.add_all([criminal_blr, criminal_mys, victim_blr, victim_mys])
    db_session.flush()

    case_blr = CrimeCase(
        case_number="CR-BLR-1", category_id=cat.id, location_id=loc_blr.id,
        occurred_at=datetime(2026, 7, 1, 20, 0, tzinfo=timezone.utc),
        reported_at=datetime(2026, 7, 2, 9, 0, tzinfo=timezone.utc),
        description="Burglary at a Bengaluru residence.", status="open", priority="high",
    )
    case_mys = CrimeCase(
        case_number="CR-MYS-1", category_id=cat.id, location_id=loc_mys.id,
        occurred_at=datetime(2026, 7, 3, 21, 0, tzinfo=timezone.utc),
        reported_at=datetime(2026, 7, 4, 8, 0, tzinfo=timezone.utc),
        description="Burglary at a Mysuru residence.", status="open", priority="high",
    )
    db_session.add_all([case_blr, case_mys])
    db_session.flush()

    officer = Officer(name="Test Inspector", badge_number="IO-P5-1", rank="Inspector", district="Mysuru", station="Devaraja")
    db_session.add(officer)
    db_session.flush()

    fir_blr = FIR(
        fir_number="FIR-BLR-1", crime_case_id=case_blr.id, investigating_officer_id=officer.id,
        complainant_name="BLR Victim Ana", sections="IPC 379", narrative="Break-in at Bengaluru home.",
        status="registered", filed_at=datetime(2026, 7, 2, 9, 30, tzinfo=timezone.utc),
    )
    fir_mys = FIR(
        fir_number="FIR-MYS-1", crime_case_id=case_mys.id, investigating_officer_id=officer.id,
        complainant_name="MYS Victim Kavi", sections="IPC 379", narrative="Break-in at Mysuru home.",
        status="registered", filed_at=datetime(2026, 7, 4, 8, 30, tzinfo=timezone.utc),
    )
    db_session.add_all([fir_blr, fir_mys])
    db_session.flush()
    db_session.add_all([
        FIRCriminalLink(fir_id=fir_blr.id, criminal_id=criminal_blr.id),
        FIRCriminalLink(fir_id=fir_mys.id, criminal_id=criminal_mys.id),
        FIRVictimLink(fir_id=fir_blr.id, victim_id=victim_blr.id),
        FIRVictimLink(fir_id=fir_mys.id, victim_id=victim_mys.id),
    ])
    db_session.commit()

    return {
        "criminal_blr": criminal_blr, "criminal_mys": criminal_mys,
        "victim_blr": victim_blr, "victim_mys": victim_mys,
        "case_blr": case_blr, "case_mys": case_mys,
        "fir_blr": fir_blr, "fir_mys": fir_mys,
    }


@pytest.fixture
def scoped_data(db_session):
    return _seed_scoped_data(db_session)


def _make_user(db_session, username, role_name, district=None, officer_district=None):
    role = db_session.query(Role).filter_by(name=role_name).first()
    if role is None:
        role = Role(name=role_name, description=role_name)
        db_session.add(role)
        db_session.flush()
    user = User(
        username=username, email=f"{username}@test.invalid", full_name=username.title(),
        hashed_password=hash_password("Password123!"), role_id=role.id,
        district=district, is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    if officer_district is not None:
        off = Officer(
            name=f"Officer {username}", badge_number=f"IO-{username.upper()}-1",
            rank="Inspector", district=officer_district, station="Devaraja", user_id=user.id,
        )
        db_session.add(off)
        db_session.flush()
    return user


def _fetcher(plan, db, district=None, redact=False):
    from app.ai.chat.backend_fetcher import BackendFetcher
    return BackendFetcher().execute(plan, db, redact_pii=redact, district=district)


def _plan(*calls):
    from app.ai.chat.query_planner import QueryPlan
    return QueryPlan(intents=[], entities=None, backend_calls=list(calls), parallel=False)


# ---------------------------------------------------------------------------
# 1. BackendFetcher district scope
# ---------------------------------------------------------------------------

class TestFetcherDistrictScope:
    def test_case_list_scoped_to_district(self, db_session, scoped_data):
        from app.ai.chat.query_planner import BackendCall
        blr = _fetcher(_plan(BackendCall("postgres", "list_cases", {"limit": 20}, 1)), db_session, district="Bengaluru Urban")
        assert "CR-BLR-1" in blr[0].content
        assert "CR-MYS-1" not in blr[0].content

        mysql = _fetcher(_plan(BackendCall("postgres", "list_cases", {"limit": 20}, 1)), db_session, district="Mysuru")
        assert "CR-MYS-1" in mysql[0].content
        assert "CR-BLR-1" not in mysql[0].content

        all_districts = _fetcher(_plan(BackendCall("postgres", "list_cases", {"limit": 20}, 1)), db_session)
        assert "CR-BLR-1" in all_districts[0].content
        assert "CR-MYS-1" in all_districts[0].content

    def test_sentinel_district_fails_closed(self, db_session, scoped_data):
        from app.ai.chat.query_planner import BackendCall
        results = _fetcher(
            _plan(
                BackendCall("postgres", "list_cases", {"limit": 20}, 1),
                BackendCall("postgres", "list_firs", {"limit": 20}, 1),
            ),
            db_session, district="__NO_DISTRICT_ACCESS__",
        )
        joined = "\n".join(r.content for r in results)
        assert "CR-BLR-1" not in joined
        assert "CR-MYS-1" not in joined
        assert "FIR-BLR-1" not in joined
        assert "FIR-MYS-1" not in joined

    def test_criminal_lookup_scoped(self, db_session, scoped_data):
        from app.ai.chat.query_planner import BackendCall
        blr = _fetcher(_plan(BackendCall("postgres", "get_criminal", {"name": "BLR Suspect Dev"}, 1)), db_session, district="Mysuru")
        assert "No criminal record found" in blr[0].content
        blr_ok = _fetcher(_plan(BackendCall("postgres", "get_criminal", {"name": "BLR Suspect Dev"}, 1)), db_session, district="Bengaluru Urban")
        assert "BLR Suspect Dev" in blr_ok[0].content

    def test_victim_lookup_scoped(self, db_session, scoped_data):
        from app.ai.chat.query_planner import BackendCall
        mys = _fetcher(_plan(BackendCall("postgres", "get_victims", {"name": "BLR Victim"}, 1)), db_session, district="Mysuru")
        assert "no victims" in mys[0].content.lower()
        blr = _fetcher(_plan(BackendCall("postgres", "get_victims", {"name": "BLR Victim"}, 1)), db_session, district="Bengaluru Urban")
        assert "BLR Victim Ana" in blr[0].content


# ---------------------------------------------------------------------------
# 2. RAG retrieval district scope
# ---------------------------------------------------------------------------

class TestRagDistrictScope:
    def test_rag_hit_kept_in_district(self, db_session, scoped_data):
        from app.ai.chat.rag_retriever import RagRetriever
        retriever = RagRetriever()
        result = retriever.fetch(db_session, "burglary Prema Mysuru", district="Mysuru")
        assert result is not None
        assert "MYS Suspect Prema" in result.content

    def test_rag_hit_dropped_out_of_district(self, db_session, scoped_data):
        from app.ai.chat.rag_retriever import RagRetriever
        retriever = RagRetriever()
        result = retriever.fetch(db_session, "burglary Prema Mysuru", district="Bengaluru Urban")
        assert result is None

    def test_rag_untagged_analytics_docs_excluded_for_bound_user(self, db_session, scoped_data):
        from app.services.rag.rag_service import build_rag_documents
        docs = build_rag_documents(db_session)
        analytics_docs = [d for d in docs if str(d.get("id", "")).startswith("analytics-")]
        assert analytics_docs, "analytics docs should exist here"
        from app.ai.chat.rag_retriever import RagRetriever
        assert RagRetriever._in_district(
            type("H", (), {"metadata": {"district": None, "_display": "x"}})(), "Mysuru"
        ) is False


# ---------------------------------------------------------------------------
# 3. Chat knowledge-graph retrieval
# ---------------------------------------------------------------------------

class TestKgChatRetrieval:
    def test_kg_fragment_honest(self, db_session, scoped_data):
        from app.services.knowledge_graph_service import rebuild_graph
        rebuild_graph(db_session)
        from app.ai.chat.query_planner import BackendCall
        results = _fetcher(
            _plan(BackendCall("kg", "fragment_by_person", {"name": "BLR Suspect Dev"}, 1)),
            db_session,
        )
        kg = results[0]
        assert kg.source == "kg"
        assert kg.success
        if kg.content and "no cross-case connections" in kg.content:
            return
        assert "Knowledge Graph" in kg.content

    def test_kg_no_node_returns_honest_refusal(self, db_session, scoped_data):
        from app.ai.chat.query_planner import BackendCall
        results = _fetcher(
            _plan(BackendCall("kg", "fragment_by_person", {"name": "Ghost Person Xyz"}, 1)),
            db_session,
        )
        kg = results[0]
        assert kg.source == "kg"
        assert "No criminal record matches" in kg.content


# ---------------------------------------------------------------------------
# 5. Analytics scoping (chat `_exec_analytics` honors the caller's district)
# ---------------------------------------------------------------------------

class TestAnalyticsScoping:
    def test_dashboard_summary_scoped(self, db_session, scoped_data):
        from app.services.analytics_service import dashboard_summary
        all_summary = dashboard_summary(db_session)
        assert all_summary["total_crimes"] == 2
        mys_summary = dashboard_summary(db_session, district="Mysuru")
        assert mys_summary["total_crimes"] == 1
        assert mys_summary["total_firs"] == 1
        assert mys_summary["total_criminals"] == 1
        blr_summary = dashboard_summary(db_session, district="Bengaluru Urban")
        assert blr_summary["total_crimes"] == 1

    def test_category_and_district_breakdown_scoped(self, db_session, scoped_data):
        from app.services.analytics_service import category_breakdown, district_comparison
        assert len(district_comparison(db_session)) == 2
        mys_only = district_comparison(db_session, district="Mysuru")
        assert len(mys_only) == 1 and mys_only[0]["district"] == "Mysuru"
        cats = category_breakdown(db_session, district="Bengaluru Urban")
        assert sum(c["count"] for c in cats) == 1

    def test_chat_statistics_intent_respects_scope(self, db_session, scoped_data):
        from app.ai.chat.entity_extractor import EntityExtractor
        from app.ai.chat.orchestrator import ChatOrchestrator
        from app.ai.chat.intent_router import IntentRouter
        user = _make_user(db_session, "p5-stat-analyst", "investigator", district="Mysuru")
        orch = ChatOrchestrator()
        message = "what are the crime statistics?"
        entities = EntityExtractor().extract(message)
        intents = IntentRouter().detect(message).intents
        plan = orch.query_planner.plan(intents, entities)
        results = orch._retrieve(message, plan, db_session, False, user)
        summary = next(r for r in results if r.source == "analytics" and r.data_type == "summary")
        assert summary.raw_data["total_crimes"] == 1


# ---------------------------------------------------------------------------
# 4. Orchestrator fail-closed for district-less bound users
# ---------------------------------------------------------------------------

class TestOrchestratorScoping:
    def test_bound_user_sees_only_own_district(self, db_session, scoped_data):
        from app.ai.chat.entity_extractor import EntityExtractor
        from app.ai.chat.orchestrator import ChatOrchestrator
        from app.ai.chat.intent_router import IntentRouter

        user = _make_user(db_session, "p5-investigator", "investigator", district="Mysuru")
        orch = ChatOrchestrator()
        entities = EntityExtractor().extract("list all crime cases")
        intents = IntentRouter().detect("list all crime cases").intents
        plan = orch.query_planner.plan(intents, entities)
        results = orch._retrieve("list all crime cases", plan, db_session, False, user)

        joined = "\n".join(r.content for r in results)
        assert "CR-MYS-1" in joined
        assert "CR-BLR-1" not in joined
        assert "BLR Suspect Dev" not in joined

    def test_district_less_bound_user_fails_closed(self, db_session, scoped_data):
        from app.ai.chat.entity_extractor import EntityExtractor
        from app.ai.chat.orchestrator import ChatOrchestrator
        from app.ai.chat.intent_router import IntentRouter

        user = _make_user(db_session, "p5-no-district", "investigator")
        orch = ChatOrchestrator()
        entities = EntityExtractor().extract("list all crime cases")
        intents = IntentRouter().detect("list all crime cases").intents
        plan = orch.query_planner.plan(intents, entities)
        results = orch._retrieve("list all crime cases", plan, db_session, False, user)

        joined = "\n".join(r.content for r in results)
        assert "CR-BLR-1" not in joined
        assert "CR-MYS-1" not in joined
        assert "BLR Suspect Dev" not in joined
        assert "MYS Suspect Prema" not in joined

    def test_multi_district_analyst_unscoped(self, db_session, scoped_data):
        from app.ai.chat.entity_extractor import EntityExtractor
        from app.ai.chat.orchestrator import ChatOrchestrator
        from app.ai.chat.intent_router import IntentRouter

        user = _make_user(db_session, "p5-analyst", "crime_analyst")
        orch = ChatOrchestrator()
        entities = EntityExtractor().extract("list all crime cases")
        intents = IntentRouter().detect("list all crime cases").intents
        plan = orch.query_planner.plan(intents, entities)
        results = orch._retrieve("list all crime cases", plan, db_session, False, user)

        joined = "\n".join(r.content for r in results)
        assert "CR-BLR-1" in joined
        assert "CR-MYS-1" in joined

    def test_bound_user_chat_refuses_on_sentinel(self, db_session, scoped_data):
        from app.ai.chat.orchestrator import ChatOrchestrator
        user = _make_user(db_session, "p5-locked", "investigator")
        result = ChatOrchestrator().process_message_sync(
            "list all crime cases", "p5-locked", db_session, history=None, current_user=user,
        )
        assert "answer" in result
        answer = result["answer"].lower()
        assert ("could not find" in answer) or ("no " in answer) or ("unavailable" in answer)