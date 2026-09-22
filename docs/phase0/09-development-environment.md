# Phase 0 — 09 Development environment

## Current state

- **Orchestration:** `scripts/dev-all.js` starts backend (uvicorn :8000) + frontend (vite :5173); root `package.json` exposes `dev:all`, `dev:frontend`, `dev:backend`, `test`, `test:backend`, `test:frontend`, `test:acceptance`.
- Backend dev command uses `py -3.12` (Windows launcher) — documented in `AGENTS.md`; `dev:backend` = `py -3.12 -m uvicorn app.main:app --reload --app-dir backend`.
- **Config:** `backend/.env.example` is complete and commented (app/data-mode/DB/Supabase/Neo4j/JWT/AI/CORS/storage/face); `.env` local copy expected.
- **DB bootstrap:** `backend/app/database/seed_db.py` + `init_db.py`; SQLite auto fallback for demo/test; Neo4j seeding via `neo4j/*.cypher`; `postgres.py` env-tunable pools.
- **Tests:** `backend/tests/conftest.py` in-memory SQLite, `APP_ENV=test`, no seed; smoke tests build own rows (documented constraint).

## Assessment

- Low-friction single-command dev startup, documented per-OS invocation, sensible separations. Windows-first but Docker path available too.

## Gaps / risks

1. No **setup wizard / first-run checklist** (create `.env`, seed Postgres, Neo4j auth). `README.md` partially covers; `AGENTS.md` covers agents only.
2. `py -3.12` is Windows-specific — Unix devs need a documented `python3.12` equivalent.
3. No **version managers** documented (pyenv/uv, nvm/fnm); CI uses fixed Python 3.12 / Node 20.
4. Background pool and worker pool must be understood by every dev to avoid pool starvation (documented in AGENTS but not in a dev guide).

## Phase 0 actions

- Add `docs/development/setup.md`: prerequisites, env key generation (`secrets.token_urlsafe(48)`), seeding, Neo4j creds, troubleshooting table, per-OS commands.
- Add a `make`-free script or documented cross-platform alias for commands currently using `py -3.12`.
- Document first-run verification paths (health endpoint, seeded dashboard, one AI call).