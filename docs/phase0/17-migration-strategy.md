# Phase 0 — 17 Migration strategy

## Current state

- Alembic configured: `backend/alembic.ini`, `backend/migrations/env.py`, `script.py.mako`.
- Versions: `8e6e75dc04de` initial schema; `a1b2c3d4e5f6` canonical case status (#252).
- Manual tooling: `apply_schema.py` (create_all), `check_schema.py`, `check_db.py`.
- ORM: `metadata.create_all()` used for dev/test bootstrap (`init_db.py`, `seed_db.py`, `conftest.py`).

## Assessment

- Alembic is wired up with a post-initial migration, but is not the sole schema path; CI does not exercise it.

## Gaps / risks

1. **CI never runs migrations** — no `alembic upgrade head` step; drift between models and versions undetected (report 03).
2. **No data migrations** — only DDL; V3 (provenance fields, provider meta, storage refs) will need them.
3. **`apply_schema.py` encourages create_all against live DBs** — bypasses Alembic history.
4. **No downgrade coverage**; rollback story depends on DB-level restore (report 20).
5. Initial migration predates several newer models — confirm it's the full history or needs re-baselining.

## Phase 0 actions

- Make **Alembic the canonical schema path**: CI stage runs `alembic upgrade head` against a fresh Postgres (or SQLite) test DB and diffs schema-set vs metadata.
- Add `alembic check` (or autogenerate dry-run) to CI as a drift gate.
- Add a `data_migrations/` convention (alembic Python data migrations with idempotency).
- Document branch/rebase policy for migrations in the `docs/phase0` index.