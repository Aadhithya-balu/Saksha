# Saksha — AI PROCESSING Section (`docs/contexts/ai-processing-section.md`)

> Runtime section label: **AI PROCESSING** (sidebar `NavGroup label:
> 'AI PROCESSING'`). The asynchronous AI workbench: job queue/monitor and the
> entity-review inbox.
>
> ⚠️ **Access status (honest finding):** both routes are **missing from
> `ROUTE_PERMISSIONS`** in `datathon/src/hooks/useRBAC.ts`. `checkPermission`
> fails closed for every role, so **neither page is reachable from the sidebar
> for ANY role** (including ADMIN) unless `ROUTE_PERMISSIONS` gains entries or a
> temporary `EXPLICIT_REQUIRED_PATHS` style override exists. The backend
> endpoints themselves are live and role-guarded — the blocker is frontend
> route RBAC, not the API.

| Page (route)                    | Docs section | Reachable today? |
| ------------------------------- | ------------ | ---------------- |
| Processing Center — `/processing` | §2         | ❌ no (missing `ROUTE_PERMISSIONS`) |
| AI Entity Review — `/ai-review`  | §3           | ❌ no (missing `ROUTE_PERMISSIONS`) |

> Sidebar ids for these pages (from `NavGroup 'AI PROCESSING'`):
> `processing` (`/processing`) and `entity_review` (`/ai-review`). Confirm exact
> ids/paths against `Sidebar.tsx` when wiring `ROUTE_PERMISSIONS`.

---

## 1. Section overview

### 1.1 Backend work model

- Jobs run asynchronously (`services` + worker sessions via
  `get_worker_session()` — never `SessionLocal()` for AI workers, per
  `AGENTS.md`), with TTL caches (`ttl_cache.py`) where results are expensive to
  recompute; invalidation prefixes are written next to the creating route.
- Job lifecycle mirrors ingestion: `received → validating → normalizing →
  stored/completed`, or `failed` — the review inbox consumes completed outputs.

### 1.2 Backend role conventions (`routes/ai_processing.py`)

`prefix="/ai"` on the processing sub-router. Constants:

| Constant | Roles |
| -------- | ----- |
| `_PROCESSING_ROLES` | ADMIN, SCRB (`crime_analyst`), IO (`investigator`) |
| `_REVIEW_ROLES` | = `REVIEW_ROLES` (admin, crime_analyst, investigator, inspector) |

| Endpoint | Guard |
| -------- | ----- |
| `POST /ai/jobs` (enqueue) | `_PROCESSING_ROLES` (ADMIN, SCRB, IO) |
| `POST /ai/jobs/{id}/retry` | `_PROCESSING_ROLES` (ADMIN, SCRB, IO) |
| `GET /ai/jobs` (list) | any authenticated `current_user` only — no role check |
| review endpoints (line ~118, ~137) | `_REVIEW_ROLES` (ADMIN, SCRB, IO, INSPECTOR) |

Note: `GET /ai/jobs` intentionally only requires a valid token; scope/district
filtering still applies via district scoping middleware. Spawning and retrying
jobs are the sensitive operations and are role-narrowed accordingly.

---

## 2. Processing Center (job queue/monitor)

### 2.1 What's on the page (designed surface)

- Job table: job id, artifact/kind, records, AI spawn state
  (`ai_job_spawned`), status chip (`JOB_META` tones from Data Ingestion —
  received/validating/normalizing/stored/completed/failed), created/updated
  timestamps.
- Actions: **New Job** (`POST /ai/jobs`), **Retry** (`POST /ai/jobs/{id}/retry`),
  Refresh, per-job detail drawer (errors, per-stage log, linked ingestion job
  when present).
- Empty/error states + `TableSkeleton` while first-loading.

### 2.2 How it's done

- Frontend service wrappers live alongside ingestion calls in
  `datathon/src/services/api.ts` (same `apiRequest` + Bearer interceptor + Vite
  `/api` proxy). Poll while any job is in a non-terminal state; stop on
  `completed|failed`.
- Backend job records follow the ingestion state machine; heavy work happens on
  worker sessions (`get_worker_session()` with `DB_WORKER_*` pool), releasing
  pooled sessions (`db.close()`) before CPU/network-heavy work (`AGENTS.md`).
- Audit: enqueue/retry → `audit_service.log_action(...)` CREATE/UPDATE;
  frontend `addLog('CREATE', …)` for UI-driven spawns.

### 2.3 Role behaviour (once `ROUTE_PERMISSIONS` includes `/processing`)

| Role | Page | Enqueue/Retry | List/Read |
| ---- | :--: | :------------: | :-------: |
| ADMIN | (route missing) | ✅ backend | ✅ backend |
| SCRB, IO | (route missing) | ✅ backend | ✅ backend |
| INSPECTOR | (route missing) | ❌ backend (403 on POST) | ✅ backend |
| SP, FORENSIC, VIEWER | (route missing) | ❌ | ✅ backend (list only) |

Frontend should gate the Enqueue/Retry buttons with
`isAdmin || isSCRB || isIO` once the route is unlocked, mirroring
`_PROCESSING_ROLES`.

---

## 3. AI Entity Review (review inbox)

### 3.1 What's on the page (designed surface)

- Queue of AI-proposed entity findings awaiting human decision: candidate
  duplicates/identity links (see `routes/ai_candidates.py` REVIEW set), MO
  matches, risk-score suggestions — presented as **proposed leads only**.
- Per-item detail: evidence/links, confidence, **Approve / Reject / Request
  Info** actions with mandatory note on reject, bulk-select with same actions,
  filter by status/type/district.
- Policy banner: never auto-confirm identities / never auto-accuse — every
  finding requires a human review decision (`AGENTS.md`).

### 3.2 How it's done

- Backend review endpoints under `routes/ai_processing.py` (lines ~118/~137)
  gated by `_REVIEW_ROLES`; companion review surfaces:
  - `routes/ai_candidates.py` — `REVIEW_ROLES = ADMIN, SCRB, IO, INSPECTOR`.
  - `routes/identity.py` reviews — `REVIEW_ROLES`.
- Frontend mirrors review semantics used elsewhere: `addLog('REVIEW', …)` per
  decision; decisions are append-only audit entries (no silent overwrite).
- District scoping: queue filtered to the operator's scope server-side;
  district-less bound users fail closed (403).

### 3.3 Role behaviour (once `ROUTE_PERMISSIONS` includes `/ai-review`)

| Role | Page | Decide (approve/reject) | Read queue |
| ---- | :--: | :---------------------: | :--------: |
| ADMIN, SCRB, IO, INSPECTOR | (route missing) | ✅ | ✅ |
| SP, FORENSIC, VIEWER | (route missing) | ❌ (backend 403) | ✅ backend list (scoped) |

---

## 4. Cross-cutting notes / fix backlog

1. **Add `ROUTE_PERMISSIONS` entries** for `/processing`
   (recommend `ADMIN | SCRB | IO | INSPECTOR` for the page, with button-level
   gates for enqueue/retry matching `_PROCESSING_ROLES`) and `/ai-review`
   (recommend `ADMIN | SCRB | IO | INSPECTOR`, matching `_REVIEW_ROLES`) — and
   matching `EXPLICIT_REQUIRED_PATHS` entries if that list is used for
   sidebar visibility.
2. Keep job spawning/retrying strictly on worker sessions
   (`get_worker_session()`), never the request pool.
3. Every review action stays human-in-the-loop and audited
   (`audit_service` / `addLog`).

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. -->