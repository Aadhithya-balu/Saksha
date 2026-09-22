# Phase 0 — 04 API assessment

## Current state

- **40 route modules** under `backend/app/routes/` (~75+ endpoints), all prefixed `/api/v2` via `API_V2_PREFIX` (`app/api/v2.py` mounts routers).
- Pydantic v2 request/response schemas under `app/schemas/`.
- Cross-cutting controls in place:
  - Auth via `app/auth/dependencies.py` (JWT bearer), refresh tokens, revoked-token check.
  - RBAC via `require_roles(...)` (`app/auth/rbac.py`) + `app/auth/scope.py` district scoping (fails closed, 403 when a district-bound user has none).
  - Rate limiting per client IP (sliding window, configurable budgets by category), XFF-aware.
  - Request body cap (`MAX_REQUEST_BODY_BYTES`), upload byte limits, face/upload budgets.
  - AI chat: streaming, provider failover, no-fabrication guard (extraction + retrieval only).
  - Honest fallbacks: `prediction_mode: "ML" | "FALLBACK"`; no invented scores (recent hardening).
- Frontend consumes all via `datathon/src/services/api.ts` (single axios layer, Bearer interceptor, Vite proxy `/api` → :8000).

## Assessment

- API surface is mature, versioned by prefix, and covered by dozens of pytest files (auth, RBAC/isolation, district scoping, evidence lifecycle, reports, chat, provenance, etc.).

## Gaps / risks

1. **No API contract test** that locks the public surface (route inventory + schema shapes). Risk of accidental breaking changes during V3.
2. **No changelog/versioning strategy beyond `/api/v2`** — V3 API additions need a documented deprecation/backward-compat policy.
3. `require_roles` + `scope.py` are applied per-route and per-service; a central "route ownership matrix" would make audits easier (see report 06).
4. Error model: verify a uniform `{detail: ...}` + status mapping exists across routers (partially standardized via `core/exceptions.py`).

## Phase 0 actions

- Add a **route inventory auto-check** (walk `app.OpenAPI`, compare against a golden list in tests) so CI fails on undocumented endpoint changes.
- Publish an `API.md` contract summary (auth headers, error envelope, pagination conventions, district param semantics, `prediction_mode` field).
- Define V3 API versioning/deprecation policy (header or prefix evolution) in an ADR.