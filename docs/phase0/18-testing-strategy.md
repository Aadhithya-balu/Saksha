# Phase 0 — 18 Testing strategy

## Current state

- **Backend (pytest):** ~52 test files under `backend/tests/` (`test_*.py`), incl. `acceptance/` with `-m acceptance` marker. `pytest.ini`: strict markers, `filterwarnings`, `testpaths`.
- Coverage areas (from file inventory): auth, RBAC/isolation, district scoping (2 suites), security hardening, identity, evidence/assign/attachments, reports lifecycle, chat/history/eval, data import, ingestion pipeline, data mode, incidents (interventions, victimology, MO semantic/pattern/matching), intelligence/fusion/provenance, network (path-finder/multi-filter), hotspot/redzone/statistical, model refresh/validation, face recognition, TTL cache, health, config (+production config).
- **Fixture constraint:** `conftest.py` in-memory SQLite, `APP_ENV=test`, no seed — smoke tests build own rows; `users.email`/`role_id`, `Officer` NOT NULL — create Role + Officer first. Documented.
- **Operational note (AGENTS):** avoid large multi-file pytest batches (some suites hang >120s) — run targeted small sets.
- **Frontend:** Vitest + Testing Library wired (`test`, `test:watch`, `test:coverage`), jsdom env, eslint strict (`--max-warnings 0`), `tsc` typecheck scripts, production build gate.
- **CI (`ci.yml`):** backend pytest + `compileall`; frontend `npm ci` + build; docker config validation. `mlops.yml`: MLOps cycle + compile check.

## Assessment

- Extensive backend coverage is already present; the CI exercises backend tests + frontend build.

## Gaps / risks

1. **CI may run the full pytest suite** — risks the documented >120s hang; should shard or run targeted families.
2. **No coverage gate/trend** (backend has no `--cov`; frontend has coverage script but CI doesn't run it).
3. **Frontend tests not in CI** — only typecheck/build; Vitest suites exist but aren't gated.
4. **Migration path untested** (report 17).
5. No golden-score / smoke bounds for AI products (report 05).

## Phase 0 actions

- Harden `ci.yml`: split pytest into shard/job families with generous timeouts; run frontend `vitest run` + `tsc` + eslint.
- Add `--cov` + a minimum threshold report (informative first, gating target later).
- Add an `alembic head vs metadata` drift test (report 17).
- Record test-command conventions in `TESTING.md` (already present) and keep AGENTS up to date.