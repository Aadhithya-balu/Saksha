# Phase 0 — 03 Database / schema assessment

## Current state

- **Primary:** PostgreSQL 16 via Supabase (Transaction-pooler supported); **graph:** Neo4j 5.24 (Aura or bundled Docker); **fallback:** SQLite for dev/test only.
- ORM: SQLAlchemy 2.0 models under `backend/app/models/` (~30 modules incl. identity, intelligence, realtime, audit, chain_of_custody, mo_tag, model_update, import_job, intervention).
- Alembic configured (`backend/migrations/`, `alembic.ini`) with 2 versions: `8e6e75dc04de` initial schema, `a1b2c3d4e5f6` canonical case status (#252).
- `backend/apply_schema.py`, `backend/check_schema.py`, `backend/check_db.py` exist for manual verification.
- Neo4j schema/query reference: `backend/neo4j/schema.cypher`, `queries_reference.cypher` (8 node types, 7 relationship types).
- Social-economics reference data: SQL script + bundled CSV offline fallback (all 30 districts).

## Assessment

- Schema is well-structured and RBAC/data-mode aware; DB sessions split across a request engine (pool 10/overflow 10) and a worker engine (`get_worker_session`) to avoid starvation.
- Conventions: naive-UTC storage, UUID PKs, user-facing string identifiers resolved in services.

## Gaps / risks

1. **Alembic head can drift from ORM metadata.** `conftest.py` uses `create_all()`, so tests never exercise migrations; nothing in CI asserts `alembic upgrade head` produces the same schema as `metadata.create_all`.
2. **No data migrations yet** — only schema (additive #252 case-status change exists).
3. Initial migration predates several newer tables/columns (identity, intelligence, realtime, mo_tag, model_update); verify freshness against models, else baseline it.
4. `apply_schema.py` runs `create_all` in prod contexts — risky for existing databases; should be discouraged in favor of Alembic.
5. SQLite fallback can mask Postgres-specific behaviors (arrays, partial indexes, JSONB).

## Phase 0 actions

- Add CI check: on SQLite test DB run `alembic upgrade head`; assert no drift vs `metadata.create_all()` (compare table/column sets) OR switch tests to `alembic upgrade head` bootstrap.
- Add `alembic check` / `--autogenerate --dry-run` drift gate to CI.
- Enumerate current models→tables mapping and update `CONTEXT.md` table count if changed.
- Document Postgres-only features usages as controller for the SQLite test path.