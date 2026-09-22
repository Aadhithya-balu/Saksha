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