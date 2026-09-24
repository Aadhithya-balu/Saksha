# SAKSHA — Working Knowledge (AGENTS)

Full product/architecture context lives in `CONTEXT.md` (read it first). This
file records conventions, commands, and known constraints that agents must
respect when working in this repo.

## Commands

- Start everything: `npm run dev:all` (backend :8000, frontend :5173).
- Backend tests (Windows): `cd backend && py -3.12 -m pytest tests/... -q`
- Frontend typecheck: `cd datathon && npx tsc -p tsconfig.app.json --noEmit`
- Frontend lint one file: `cd datathon && npx eslint <path>`
- Frontend build: `cd datathon && npm run build`
- MLOps cycle: `cd backend && py -3.12 -m app.mlops`

## Bare-Metal Rules

- Never auto-confirm identities / never auto-accuse: identity-resolution
  results are proposed leads; every finding requires a human review decision.
  Same for proxy patterns and vulnerability scoring.
- Do NOT hardcode AI chat answers. Deterministic rule answers are fine (they
  are explicitly "rule-based"), hosted-LLM answers must come from extraction +
  retrieval + backend fetchers, never fabricated.
- Never expose internal storage paths; serve demo face images via logical refs.
- Audit actions via `audit_service.log_action(...)` (backend) or
  `addLog(...)` in `useAuditStore` (frontend) for CREATE/UPDATE/DELETE/EXPORT.
- RBAC: route-level via `require_roles(...)`, UI-level via `useRBAC`.
- Frontend → backend calls go through `datathon/src/services/api.ts`
  (`apiRequest`, Bearer token interceptor, Vite proxy `/api` → :8000).

## Conventions

- Backend: FastAPI routers under `backend/app/routes/`, services under
  `backend/app/services/`, Pydantic v2 schemas under `backend/app/schemas/`,
  SQLAlchemy 2.0 models under `backend/app/models/`.
- Frontend: pages under `datathon/src/pages/`, components under
  `datathon/src/components/`, Zustand stores under `datathon/src/store/`.
- Cross-tab navigation uses `window.dispatchEvent(new CustomEvent('navigate-tab',
  { detail: { tab, targetId } }))`; `App.tsx` handles it downstream and stores
  `targetId` in `sessionStorage['selected_entity_id']`.
- Internal IDs are UUIDs; user-facing inputs (badges, names, FIR numbers) may
  be strings — services resolve them (see evidence `_resolve_assignee`).

## Constraints / Gotchas

- `tests/conftest.py`: in-memory SQLite, `APP_ENV=test`, no seed data. Smoke
  tests must build their own rows. `users.email` and `users.role_id` are NOT
  NULL; `Officer` columns are NOT NULL — create a Role + Officer first.
- Avoid large multi-file pytest batches; some suites hang >120s. Run small
  targeted sets (e.g. one file at a time) with a generous timeout.
- Multi-worker endpoints that open their own sessions (criminal AI workers,
  face network, MO matching) must NOT share the request session. Use
  `SessionLocal()` in a worker / `ThreadPoolExecutor`.
- DB pool: request path `pool_size=10, max_overflow=10, pool_timeout=30`
  (env-tunable via `DB_POOL_SIZE`/`DB_MAX_OVERFLOW`/`DB_POOL_TIMEOUT`,
  `pool_pre_ping=True, pool_recycle=120`). Background/worker code MUST use a
  session from `app.database.postgres.get_worker_session()` (separate engine,
  `DB_WORKER_*` envs, defaults 3/12/300s) — never `SessionLocal()` — so long
  training/parallel AI jobs can't starve the request path (QueuePool timeout).
  Release pooled sessions (`db.close()`) before heavy CPU/network work.
- Heavy analytics that is expensive to recompute may use `ttl_cached`
  (`backend/app/services/ttl_cache.py`). Invalidate targeted prefix keys via
  `invalidate_ttl_cache_prefix("criminal_network")` after writes (see
  `backend/app/routes/criminals.py::_invalidate_criminal_derived`).
- Face recognition pipeline is DB-independent after seeding: references come
  from disk and are cached per-process (`_cached_references`). Do not re-add
  DB dependencies to the matching path.
- Timezone: store/compare as naive UTC (`datetime.utcnow()`, or convert aware
  times with `.astimezone(timezone.utc).replace(tzinfo=None)`).
- FIR/hub/case search returns "victim"/"person" groups with only real ORM
  columns (e.g. `Victim.full_name`, `contact_number`, `address`).

## Pre-existing frontend lint/tsc noise

- `SentinelAlertCard.tsx` / `SentinelWorkflowModal.tsx` previously had TS6133
  unused-import errors and a `period` type error; these were cleaned up in the
  last pass so `npm run build` is green again. Keep an eye on them (large,
  previously untouched files) during future edits.
- `App.css` holds unused Vite boilerplate; unused by design.

## Recent sessions summary (13-issue hardening pass)

Completed: AI-chat extraction/intent/FIR retrieval fixes; intervention
timezone normalization; chat "no-dump" retrieval ordering; hub federated
search w/ victims group + Investigation page UI; investigation N+1
(selectinload + batched custody); evidence assignment by UUID/badge/name;
victim edit-dossier (schema + api + Victims modal); face-recognition session
release + embedding cache (pool exhaustion) incl. "Analyzing" UI; identity
resolution status-based review filter (Pending/Resolved/All); dossier TTL
cache invalidation after criminal writes; removed dead `language`/`setLanguage`
from `appStore` (i18n store is single source); Notifications page connects
realtime SSE on mount/disconnect on unmount + SystemHealth "Standby" for idle
streams.

## Recent sessions summary (district scoping + UI honesty pass)

Completed: server-side district scoping enforced end-to-end (`app/auth/scope.py`,
fails closed with 403 when a district-bound user has no district) across
firs/crime-cases/criminals/victims/evidence, then dashboard, officers,
interventions, ai-risk-scores, alerts (+redzone `rank_categories` district
param), legacy crimes, network graph/search/path, intelligence,
sociological, investigation detail/chat, and investigation-hub search (MO
matches filtered per-doc via `_mo_doc_district`); dashboard static endpoints
gained a `district` query param (cache keys include it);
`network /search` no longer fabricates `risk_score`; `get_fir` risk gauge is
honest rule-based (`RULE-SQL-V2` label on the FIR risk card); criminal
risk/repeat-offender fallbacks no longer invent `45/MEDIUM/0.72` or
`0.2+0.15×FIRs` — they return null and the UI renders "Unavailable".
Frontend UI-honesty pass: removed fabricated FIR hotspot metrics, Overview
quick-action exports, Anomalies feature breakdown + `SP-0088` escalation,
Predictions fake model metadata, hardcoded CorrelationChart `r="0.29"` legend
(now shows computed r), ActiveAlerts3D `Devaraja/75/82`, alertStore seeded fake
alerts; added FIR/investigation-dossier/evidence deep-links
(`selected_entity_id`), `hooks/useTitle` per-page tab titles, removed inert
Officers "Filter" button and the dead `ContextSelector`/`ChatContextOptions`
(backend `ChatRequest` accepts no scope fields). Landing/Login remain
byte-locked. UI checklist audits (§6-39) all verified or fixed; every change
gated on `tsc -p tsconfig.app.json --noEmit`, `eslint`, `npm run build`, and
Landing/Login SHA-256 checks.

## Recent sessions summary (issue #269 — Phase 5 delivery: chat scoping + alerts + frontend)

Completed: **Phase 5 chat scoping + KG retrieval** — district-aware RAG/fetchers
(`backend/app/ai/chat/backend_fetcher.py`, `orchestrator.py`, `query_planner.py`,
`rag_retriever.py`, `rag_service.py`); sentinel `__NO_DISTRICT_ACCESS__` in
orchestrator zeros/drops analytics for district-less bound users. **Analytics
scoping** — district params on `analytics_service` (`recent_activity`,
`dashboard_summary`, `category_breakdown`, `district_comparison`, `anomalies`,
`offender_dossiers` + `_district_fir_ids`/`_district_criminal_ids` helpers);
`BackendFetcher.execute()` routes analytics-only plans sequentially and
`_exec_analytics` opens a short session from `db.get_bind()` (sqlite AI-worker
pool has no tables — never share it for analytics). **Phase 5 alerts** — new
`AlertFinding` model (`alert_findings`), `alert_finding_service` (CRIME_SPIKE +
REPEAT_OFFENDER rules, dedup via `grouping_key`, review lifecycle
confirm|investigate|dismiss, district-scoped, audited),
`routes/alert_findings.py` (prefix `/alerts/findings*`; generate = admin/SCRB,
review = REVIEW_ROLES). Non-destructive Alembic migration
`c9e2a1f4d807_create_alert_findings.py` (head; does NOT touch the destructive
`67c8dab87ac9`). **Frontend** — new `DataIngestion` (`/ingestion`),
`KnowledgeGraph` (`/intelligence-graph`), `AlertReview` (`/alerts-review`)
pages wired to the real v2 endpoints, registered in `App.tsx` routeEntries +
switch, `Sidebar.tsx` (INTELLIGENCE group), and `useRBAC.ts` (both
`ROUTE_PERMISSIONS` and `EXPLICIT_REQUIRED_PATHS`; writes gated by role at
button level). Gates: tsc + eslint + `npm run build` green; Landing/Login
SHA-256 unchanged; backend batches (alert findings/policy/health + phase5
scoping/district/RBAC/hardening) green, plus the earlier chat regression suites.
Pre-existing `test_chat_history.py` streaming failures remain out of scope.

## Recent sessions summary (Dashboard + Crime Cases + AI Chat production redesign)

Completed: **Backend honesty/security** — `crime_cases.py` `create_case` now
enforces server-side district scope via `enforce_record_district` (district-bound
users can only file cases into their own district; fails closed, 403 for
district-less accounts); `_status_bucket()` added so status filters match both
canonical (`active`, `under_investigation`, `chargesheeted`, …) and legacy
(`open`, `assigned`, `investigating`, …) stored values on the case list AND the
`/insights` endpoint (which now also counts canonical statuses). **Crime Cases
UI** — canonical statuses wired through `STATUS_LABEL`/`STATUS_TONE`/
needs-attention set, filter dropdown, and the details-page status select
(previously `active` cases rendered blank); details controls (status/priority/
progress/assignee/notes/link-FIR/delete-note + Modify Dossier) RBAC-gated via
the existing `canWrite` heuristic (ADMIN/IO/SCRB); SSE optimistic row no longer
fabricates a description and shows `—` progress until real data lands; Ask AI
row action + details button dispatch `navigate-tab` → `ai_chat` with
`selected_entity_id` = case UUID. **AI Chat redesign** — standalone page is now
a 3-pane workspace (history sidebar / conversation / context panel): demo
PROMPTS replaced with generic scope-honest capability cards (no fake
`CR-2026-MYS-001` / `Ramu Swamy` data anywhere in production UI, incl.
`GlobalAIAssistant` quick prompts); persistent "SAKSHA AI Intelligence" header
with a scope chip (state vs. district from `useUserScope`); right context panel
shows deep-linked case focus card (reads `selected_entity_id` on mount and on
`navigate-tab` to `ai_chat`, consumed + removed like other pages) plus
"Referenced records" built from `Citation.records`, each with one-click
navigation to FIR/Case/Criminal/Evidence/Victim tabs (`chat-ctx` / `chat-ctx.open`
drawer on ≤760px, overlay + toggle; note citizen pages that read
`selected_entity_id` are crime_cases/fir/criminals/evidence/victims/investigation).
**api.ts** — `ChatCitation.records`, new `ChatSourceRecord`/`ChatProvenance`;
`CitationBadge` gained `onOpenSource` (opens record) and lists referenced
records in its modal. Gates: `tsc -p tsconfig.app.json --noEmit` + eslint +
`npm run build` green (only pre-existing chunk/dynamic-import warnings);
backend batches `test_case_status`, `test_district_scoping_endpoints`,
`test_district_scope`, `test_final_validation_v2`, `test_multi_authority`,
`test_dashboard_honesty_282` + `test_notification_delete_clear` all green.
Landing/Login untouched. Stash `stash@{0}` `session-work-pending-pull` still
present on `V3-enhance-1` — keep until user confirms.

Notes for next runs: `CrimeCaseDetailRecord.progress`/`description` are nullable
in practice (SSE row + DB) — render `—` and skip needs-attention when null;
`_status_bucket` lives in `crime_cases.py` (do not duplicate in other routers);
leaving the pre-existing `test_chat_history.py` streaming failures out of scope
still applies.

## Recent sessions summary (production brief §1–§81 final delivery)

Completed: **Crime Cases responsive rebuild** — `CrimeCasesList.tsx` renders
mobile cards on ≤767px (case number/description/district/category/status+
priority chips/progress bar/days-open marker/actions) in an `md:hidden` block,
while desktop keeps the table in a `hidden md:block overflow-x-auto` wrapper with
a **sticky right actions column** (Eye/Ask-AI/Edit/Delete) so actions never leave
the viewport — this also sidesteps the global `@media (max-width:767px) main
table { display:block }` rule in `index.css`. Relabeled "Avg Velocity"→"Avg
Progress" in `CrimeInsightsBar.tsx` (the value is `avg_progress`); removed dead
`chargeSheet` mapping + `EMPTY_METRICS`. **Live-Supabase AI chat verification** —
1-day temp in-process script (`SessionLocal` + real `User` rows + real roles,
run from `backend/`, deleted after) hit `orchestrator.process_message_sync(…,
include_debug=True)` live: 11/11 checks green covering in-district evidence
lookup (real records, grounding=1.0), cross-district zero-leak for bound users
+ honest refusal, `debug.district` labels, multi-district GLOBAL scope, and
scoped analytics; all answers honestly reported `local-template` (sandbox can't
reach hosted LLMs). Two fixes from those runs: linkage words (`linked`/`link`/
`related`/`associated`/`attached`/`connected`/`tied`/…) added to `_NAME_NOISE`
in `llm_generator.py` (stops "evidence is linked to…" refusing as if `linked`
were a person name — `_PERSON_HINT_BEFORE` contains "is"), and evidence records
in `backend_fetcher._pg_get_evidence_for_case`/`_pg_list_evidence` now carry the
owning `case_number` so the response validator can verify case numbers cited in
evidence titles (kills a strict-detector false "fabricated" flag).
**§81 final report** — `docs/validation/FINAL_REPORT_V3_ENHANCE.md`. Gates:
frontend tsc/eslint clean; backend exits 0 across `test_case_status`,
`test_ai_chat_conversational`, `test_phase5_chat_scoping`, and
`tests/ai/{test_chat_safety,test_chat_evaluation,test_chat_context,
test_chat_orchestrator,test_query_planner,test_rag_retriever,test_temporal}`.
Pre-existing/unrelated and confirmed unchanged: `test_llm_generator.py` 2
failures (async-gen iteration test + explicit "FIR 77" ID-miss) reproduce on the
clean tree; `tests/ai/test_chat_rag.py` is a standalone RBAC script, not pytest
(exit 5); `test_chat_history.py` still out of scope.

Notes for future runs: verify chat edits with live-DB scripting when the sandbox
has no hosted-LLM egress — engine honesty (`last_engine`) and provenance flags
are the acceptance signals; `IDR-*` style case numbers are NOT captured by the
entity extractor's `case_id` regex (only `CR-*`/`FIR` patterns) — planner falls
back to district-scoped `list_evidence`, broadening the ID regex is a candidate
follow-up.