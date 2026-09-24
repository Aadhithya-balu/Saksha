"""Query planning layer — maps intents + entities to backend service calls."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.ai.chat.intent_router import Intent
from app.ai.chat.entity_extractor import ExtractedEntities


@dataclass
class BackendCall:
    service: str       # "postgres" | "neo4j" | "ml" | "analytics"
    method: str        # function name within the service
    params: dict = field(default_factory=dict)
    priority: int = 1  # lower = higher priority


@dataclass
class QueryPlan:
    intents: list[Intent]
    entities: ExtractedEntities
    backend_calls: list[BackendCall]
    parallel: bool = True
    description: str = ""


class QueryPlanner:
    """Decides which backend services to call based on detected intents and entities."""

    def plan(self, intents: list[Intent], entities: ExtractedEntities) -> QueryPlan:
        calls: list[BackendCall] = []

        for intent in intents:
            calls.extend(self._plan_intent(intent, entities))

        # Temporal questions ("any crime today?", "last week") need a
        # time-windowed activity summary — without it the LLM cannot know
        # what 'today' contains and dossiers/stats look timeless.
        if entities.date_range_days is not None or entities.date:
            days = entities.date_range_days if entities.date_range_days is not None else 1
            calls.append(BackendCall("analytics", "recent_activity", {"days": days}, 0))

        deduped = self._deduplicate(calls)
        parallel = len(deduped) > 1

        return QueryPlan(
            intents=intents,
            entities=entities,
            backend_calls=deduped,
            parallel=parallel,
            description=f"Querying {len(deduped)} service(s) for: {', '.join(i.value for i in intents)}",
        )

    def _plan_intent(self, intent: Intent, entities: ExtractedEntities) -> list[BackendCall]:
        if intent == Intent.FIR_LOOKUP:
            return self._plan_fir(entities)
        if intent == Intent.CASE_DETAILS:
            return self._plan_case(entities)
        if intent == Intent.CRIMINAL_HISTORY:
            return self._plan_criminal(entities)
        if intent == Intent.OFFICER_INFO:
            return self._plan_officer(entities)
        if intent == Intent.CRIME_STATISTICS:
            return self._plan_statistics()
        if intent == Intent.HOTSPOT_ANALYSIS:
            return self._plan_hotspot(entities)
        if intent == Intent.CRIMINAL_NETWORK:
            return self._plan_network(entities)
        if intent == Intent.EVIDENCE_LOOKUP:
            return self._plan_evidence(entities)
        if intent == Intent.SIMILAR_CASES:
            return self._plan_similar(entities)
        if intent == Intent.PREDICTIONS:
            return self._plan_predictions(entities)
        if intent == Intent.NOTIFICATIONS:
            return self._plan_notifications()
        if intent == Intent.DASHBOARD_ANALYTICS:
            return self._plan_dashboard()
        if intent == Intent.PLATFORM_GENERAL:
            return []
        return self._plan_general()

    def _plan_fir(self, e: ExtractedEntities) -> list[BackendCall]:
        if e.fir_number:
            return [BackendCall("postgres", "get_fir", {"fir_number": e.fir_number}, 1)]
        if e.person_name:
            return [BackendCall("postgres", "search_firs", {"query": e.person_name}, 1)]
        return [BackendCall("postgres", "list_firs", {"limit": 10}, 1)]

    def _plan_case(self, e: ExtractedEntities) -> list[BackendCall]:
        if e.case_id:
            return [BackendCall("postgres", "get_case", {"case_number": e.case_id}, 1)]
        if e.person_name:
            return [BackendCall("postgres", "search_cases", {"query": e.person_name}, 1)]
        return [BackendCall("postgres", "list_cases", {"limit": 10}, 1)]

    def _plan_criminal(self, e: ExtractedEntities) -> list[BackendCall]:
        calls: list[BackendCall] = []
        if e.person_name:
            calls.append(BackendCall("postgres", "get_criminal", {"name": e.person_name}, 1))
            calls.append(BackendCall("neo4j", "get_person_network", {"name": e.person_name}, 2))
            calls.append(BackendCall("kg", "fragment_by_person", {"name": e.person_name}, 3))
        else:
            calls.append(BackendCall("analytics", "offender_dossiers", {}, 1))
            if e.district:
                calls.append(BackendCall("postgres", "search_criminals", {"query": e.district}, 1))
        return calls

    def _plan_officer(self, e: ExtractedEntities) -> list[BackendCall]:
        if e.person_name:
            return [BackendCall("postgres", "get_officer", {"name": e.person_name}, 1)]
        return [BackendCall("postgres", "list_officers", {"limit": 20}, 1)]

    def _plan_statistics(self) -> list[BackendCall]:
        return [
            BackendCall("analytics", "dashboard_summary", {}, 1),
            BackendCall("analytics", "category_breakdown", {}, 2),
            BackendCall("analytics", "district_comparison", {}, 2),
        ]

    def _plan_hotspot(self, e: ExtractedEntities) -> list[BackendCall]:
        calls = [BackendCall("analytics", "hotspots", {}, 1)]
        if e.district:
            calls.append(BackendCall("ml", "hotspot_predict", {"district": e.district}, 2))
        return calls

    def _plan_network(self, e: ExtractedEntities) -> list[BackendCall]:
        calls: list[BackendCall] = []
        if e.person_name:
            calls.append(BackendCall("neo4j", "get_person_network", {"name": e.person_name}, 1))
            calls.append(BackendCall("kg", "fragment_by_person", {"name": e.person_name}, 2))
        else:
            calls.append(BackendCall("neo4j", "get_full_network", {}, 1))
        calls.append(BackendCall("neo4j", "get_gangs", {}, 2))
        return calls

    def _plan_evidence(self, e: ExtractedEntities) -> list[BackendCall]:
        """Evidence lookups resolve against the referenced case/FIR.

        Follow-up questions ("what evidence is linked to it?") rely on the
        orchestrator's history carry-forward to populate ``case_id`` /
        ``fir_number`` from an earlier turn, so a fresh authorized query runs
        against the database instead of reusing an old response.
        """
        if e.case_id:
            return [BackendCall("postgres", "get_evidence_for_case", {"case_number": e.case_id}, 1)]
        if e.fir_number:
            return [BackendCall("postgres", "get_evidence_for_case", {"fir_number": e.fir_number}, 1)]
        return [BackendCall("postgres", "list_evidence", {"limit": 12}, 1)]

    def _plan_similar(self, e: ExtractedEntities) -> list[BackendCall]:
        calls: list[BackendCall] = []
        if e.person_name:
            calls.append(BackendCall("ml", "find_similar_offenders", {"name": e.person_name}, 1))
        if e.crime_category:
            calls.append(BackendCall("postgres", "search_cases", {"category": e.crime_category}, 2))
        if not calls:
            calls.append(BackendCall("analytics", "offender_dossiers", {}, 1))
        return calls

    def _plan_predictions(self, e: ExtractedEntities) -> list[BackendCall]:
        calls: list[BackendCall] = []
        district = e.district  # may be None → ML answers honestly "no district"
        calls.append(BackendCall("ml", "risk_predict", {"district": district} if district else {}, 1))
        calls.append(BackendCall("ml", "forecast", ({"district": district} if district else {}) | {"months": 6}, 2))
        return calls

    def _plan_notifications(self) -> list[BackendCall]:
        return [BackendCall("postgres", "list_notifications", {"limit": 20}, 1)]

    def _plan_dashboard(self) -> list[BackendCall]:
        return [
            BackendCall("analytics", "dashboard_summary", {}, 1),
            BackendCall("analytics", "hotspots", {}, 2),
            BackendCall("analytics", "anomalies", {}, 2),
            BackendCall("analytics", "category_breakdown", {}, 3),
            BackendCall("analytics", "district_comparison", {}, 3),
        ]

    def _plan_general(self) -> list[BackendCall]:
        return [
            BackendCall("analytics", "dashboard_summary", {}, 1),
            BackendCall("analytics", "category_breakdown", {}, 2),
        ]

    def _deduplicate(self, calls: list[BackendCall]) -> list[BackendCall]:
        seen: set[tuple[str, str]] = set()
        deduped: list[BackendCall] = []
        for call in calls:
            key = (call.service, call.method)
            if key not in seen:
                seen.add(key)
                deduped.append(call)
        return sorted(deduped, key=lambda c: c.priority)
