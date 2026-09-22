# V3 — PHASE 0 Master Report (Repository Prerequisites)

**Issue:** https://github.com/Aadhithya-balu/Saksha/issues/271
**Date:** 2026-09-22
**Scope:** Readiness audit of the existing codebase before V3 feature phases.
**Outcome:** This phase prepares the ground. It does NOT build the new system.

## Status Matrix

| # | Phase 0 area | Existing state | Gap | Priority |
|---|---|---|---|---|
| 01 | Repository audit | Clean, organized monorepo | Duplicate docs, stray root test scripts, empty `backups/` | Low |
| 02 | Architecture documentation | `CONTEXT.md` + `docs/` + `V3-PROPOSED.md` | No ADR log; no C4/C4-derived diagrams | Medium |
| 03 | Database/schema assessment | PostgreSQL 16 + Neo4j 5.24 + SQLite fallback | Alembic head vs model drift unchecked in CI | High |
| 04 | API assessment | 40 route modules, `/api/v2`, Pydantic v2, RBAC + district scope | No API changelog/contract test | Medium |
| 05 | AI assessment | 8 algorithms, MLOps registry, honest fallbacks | In-memory vector store, no persisted embeddings | High |
| 06 | RBAC assessment | 7 roles, `require_roles`, district scope, `useRBAC` | No central permissions matrix doc | Medium |
| 07 | UI/UX assessment | React 18 + TS, 30 pages, design tokens | No design-system/accessibility doc | Medium |
| 08 | Dependency audit | Versioned, bounded deps | No Python lockfile/hash pinning; no vuln scan in CI | High |
| 09 | Development environment | `dev-all.js`, `.env.example`, seed DB | No documented setup wizard; per-OS gaps | Low |
| 10 | Configuration system | `core/config.py` (pydantic-settings), data modes | No secrets vault; env inventory not documented | Medium |
| 11 | Security baseline | Argon2id, JWT hardening, lockout, rate limits, prod hard-fails | No CI SAST/dependency vuln scanning | High |
| 12 | Audit-log foundation | `audit_logs` table + `audit_service.log_action` + frontend `addLog` | No retention/immutability policy doc | Medium |
| 13 | Data provenance | Provenance docs + `prediction_mode` labels + data mode | No global source→entity traceability model | Medium |
| 14 | Storage strategy | Supabase Storage vs local uploads, fs-backed MLOps | No object retention/backup of uploads | Medium |
| 15 | Background-job strategy | In-process scheduler, `ThreadPoolExecutor`, worker sessions | No queue/durable job system | Medium |
| 16 | AI-provider abstraction | `LLM_PROVIDER=auto` failover chain, face provider abs | ML models not provider-pluggable | Low |
| 17 | Migration strategy | Alembic configured (2 versions) | No data migrations, no CI head-check | High |
| 18 | Testing strategy | ~52 pytest files + acceptance marker + Vitest | Coverage gate, frontend-in-CI weak | Medium |
| 19 | Docker/local baseline | Multi-stage image, compose (backend/postgres/neo4j/mlops) | No dev-compose hot-reload profile | Low |
| 20 | Backup/rollback strategy | `backups/` dir, ops runbook | No automated db/upload backup or restore test | High |

## Key conclusions

1. The codebase is **exceptionally audit-ready**: recent hardening passes (UI honesty,
   district scoping, security hardening, data-mode gating) already delivered large parts
   of Phase 0.
2. The **four highest-risk gaps** to close first:
   - **20 Backup/rollback** — no automated backups (`backups/` is empty).
   - **17 Migration strategy** — Alembic head can silently drift from ORM models;
     add a CI check that `alembic upgrade head` on a clean DB matches metadata.
   - **08/11 Dependency + security scanning** — no `pip-audit`/`npm audit`/SAST in CI.
   - **05 AI vector store** — RAG embeddings are in-memory only; decide persistence.
3. Every change in this pass must stay green against: `tsc -p tsconfig.app.json --noEmit`,
   `eslint`, `npm run build`, and Landing/Login SHA-256 byte-lock.

## Recommended execution order

Phase 0 items can largely run in parallel. Suggested dependency-aware order:

1. **Repo + dependency + security baseline** (01, 08, 11) — pure housekeeping, unblocks CI.
2. **Migration + testing** (17, 18) — schema safety before any V3 DB work.
3. **Backup/rollback + storage** (20, 14) — protection before new data models.
4. **Docs** (02, 03, 04, 06, 07, 10, 12, 13, 16) — parallelizable documentation passes.
5. **Background jobs + AI persistence** (15, 05) — architectural decisions feeding design.
6. **Dev environment + Docker** (09, 19) — validation, not new build.

Full per-area detail in `01-*.md` … `20-*.md`.