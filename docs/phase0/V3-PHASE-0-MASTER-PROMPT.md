# V3-PHASE 0 — Master Prerequisite Prompt

**Status:** Reusable prompt for executing or re-verifying PHASE 0 of the Saksha V3 rollout.
**Issue:** https://github.com/Aadhithya-balu/Saksha/issues/271
**Generated:** 2026-09-22 (baseline performed; this file is the re-runnable prompt).

---

## Mission

Prepare the Saksha codebase for the V3 feature phases WITHOUT building the new system.
Deliver an audited, documented, and hardened foundation such that each subsequent feature
phase has a consistent, reviewable, reproducible baseline.

## Ground rules (never violate during Phase 0)

1. All backend work: FastAPI routers under `backend/app/routes/`, services under
   `backend/app/services/`, Pydantic v2 schemas under `backend/app/schemas/`,
   SQLAlchemy 2.0 models under `backend/app/models/`.
2. Frontend work: pages under `datathon/src/pages/`, components under
   `datathon/src/components/`, Zustand under `datathon/src/store/`.
3. Audit actions via `audit_service.log_action(...)` (backend) / `useAuditStore.addLog(...)`
   (frontend) for CREATE/UPDATE/DELETE/EXPORT. Never silent writes.
4. RBAC: route-level via `require_roles(...)`, UI-level via `useRBAC`. District scoping
   must fail closed. Never auto-confirm identities or auto-accuse.
5. AI: no hardcoded chat answers. Rule answers are explicitly "rule-based"; hosted-LLM
   answers come only from extraction + retrieval + fetchers. Never fabricate metrics,
   scores, model metadata, or fallbacks (return `null`/"Unavailable" instead).
6. No internal storage paths in responses; serve demo images via logical refs.
7. Never commit secrets; `.env.*` stays gitignored except `.env.example`.
8. Timezone: naive UTC everywhere (`.astimezone(timezone.utc).replace(tzinfo=None)`).
9. Worker code MUST use `get_worker_session()`; never share the request session, and
   release pooled sessions before heavy CPU/network work.
10. Keep the gates green: `tsc -p tsconfig.app.json --noEmit`, `eslint`, `npm run build`,
    Landing/Login SHA-256 byte-lock checks, targeted pytest files (avoid giant batches).

## Phase 0 workstreams (order = priority, parallelism allowed)

### A. Safety & CI (do first)
1. **Backup/rollback (20):** add `scripts/backup.*`, document
   `docs/operations/backup-restore.md`, define retention + monthly restore drill.
2. **Migration strategy (17):** make Alembic canonical; CI runs `alembic upgrade head`;
   add `alembic check` drift gate; document data-migration convention.
3. **Dependency + security scanning (08, 11):** `requirements.lock` generation, pin
   `react-force-graph-3d`; add `pip-audit`, `npm audit --omit=dev`, SAST to CI;
   assert security response headers in tests.

### B. Schema & testing
4. **Database assessment (03):** DRIFT check models ↔ alembic head; refresh doc counts.
5. **Testing strategy (18):** split CI pytest batches, wire frontend `vitest run` +
   `tsc` + eslint into CI, add coverage report, add golden-bounds AI smoke tests.

### C. Architecture & docs (parallelizable)
6. **Docs deliverables (02, 04, 06, 07, 10, 12, 13, 16):** ADRs, API contract doc,
   RBAC permissions matrix, design-system doc, config inventory, audit foundation,
   provenance policy, AI-provider spec. Update `CONTEXT.md` as the single architecture
   source. Archive duplicate root docs.

### D. Decisions & strategy
7. **Storage + AI persistence (14, 05):** ADR on RAG index persistence + model artifacts
   volume + object-store strategy.
8. **Background jobs (15):** document in-process strategy; add pg advisory lock around
   auto-retrain; decide queue vs no-queue for V3.
9. **Repo/UI housekeeping (01, 07, 09, 19):** move stray scripts, setup doc, dev-compose
   profile, design-system/a11y baseline.

## Acceptance criteria (all workstreams)

- [ ] `docs/phase0/` contains reports for all 20 areas with current-state/gaps/actions.
- [ ] Every Phase 0 write action has an audit log entry.
- [ ] CI now: runs migrations, drift check, dep/SAST scans, split tests, frontend gates.
- [ ] Backups exist with a documented restore drill; `backups/` non-empty in CI check.
- [ ] No fabricated AI output introduced or re-introduced (scan chat/analytic fallbacks).
- [ ] RBAC + district-scope negative tests pass for all protected route families.
- [ ] Landing/Login byte-locks verified; `npm run build`, `tsc`, `eslint` all green.

## Definition of Done

Phase 0 is complete when every checkbox above passes and the reports (committed under
`docs/phase0/`) have been reviewed by the maintainer. Feature phases then start from this
stamped baseline.