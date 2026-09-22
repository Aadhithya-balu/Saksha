# Phase 0 — 06 Existing RBAC assessment

## Current state

- **7 roles** defined in the `roles` table + `role_permissions` granular permissions: `admin`, `crime_analyst`, `investigator`, `inspector`, `policymaker`, `officer`, `viewer`.
- Backend: `app/auth/rbac.py` (`require_roles`), `app/auth/dependencies.py` (JWT identity + permissions), `app/auth/scope.py` (district scoping, fails closed).
- Frontend: `datathon/src/hooks/useRBAC.ts` + `RoleGuard` (`components/layout/`); `authStore` holds session/role.
- Fail-closed posture: unknown roles fail; production mode rejects default passwords.
- Recent pass aligned RBAC to a single source and removed fabricated audit claims.

## Assessment

- Two enforcement layers (route-guard + UI-guard) with a demo user matrix documented in `CONTEXT.md` and enforced by `tests/test_rbac_and_isolation.py`, `tests/test_auth.py`, `tests/test_district_scoping_endpoints.py`.

## Gaps / risks

1. **No central permissions matrix document** mapping endpoint groups → required roles. Guards are spread per-router; a V3 audit needs an authoritative table.
2. Frontend `RoleGuard` duplicates role checks — risk of drift between UI and API enforcement (API remains authoritative; UI is UX only).
3. District scoping semantics (multi-district roles vs single, statewide default views) are behavioral, not declaratively documented per endpoint.
4. No per-object authorization beyond district — V3 (evidence custody, intelligence reports) may need finer-grained ownership checks.

## Phase 0 actions

- Generate a `docs/rbac-permissions-matrix.md` from router declarations (route → `require_roles`/public) and cross-check with `role_permissions` seed.
- Document district-scope rules per endpoint family and add negative tests for each out-of-scope access.
- Add a CI test that the permissions matrix parses and every guarded route is covered.