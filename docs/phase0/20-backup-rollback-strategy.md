# Phase 0 — 20 Backup / rollback strategy

## Current state

- `backups/` directory exists at root but is **empty**.
- No automated DB `pg_dump` / snapshot job, no evidence-uploads backup, no artifact-version rollback procedure documented beyond MLOps registry `promote` semantics.
- Restoration/recovery is partially addressed in `docs/operations/runbook.md` (recovery/troubleshoot), but a concrete backup cadence + restore test is absent.
- Deploy path: single-container image + compose volumes (postgres_data, neo4j_data) — once composed, restoring means DB restore + image rebuild.

## Assessment

- This is the **largest Phase 0 gap**: no automated backups, no tested restore. Everything else is doc/CI-grade; this is an operational must-fix before V3 builds new data models.

## Gaps / risks

1. **No scheduled Postgres backup** (pg_dump hourly/daily + retention) — full data loss risk on the Supabase/local DB.
2. **No uploads backup** (Supabase Storage / local uploads dir).
3. **No restore drill** — backup file is only as good as its last restore test.
4. Neo4j graph DB has no backup job either (neo4j-admin dump).
5. Rollback of schema changes relies on manual restore, not a documented downgrade path (report 17).

## Phase 0 actions

- Implement a `scripts/backup.ps1/.sh` (or scheduled CI cron) that:
  - `pg_dump` (or Supabase backup endpoint/monitor) → dated archive in `backups/` with retention (e.g. keep 7 daily).
  - `neo4j-admin database dump` → archive.
  - Optional: tar `backend/uploads/` + `mlflow/`.
- Add a documented **restore drill** runbook section (`docs/operations/backup-restore.md`): step-by-step restore of Postgres, Neo4j, uploads, artifacts; verify health endpoints and data counts.
- Add a CI/`docs` note on **rollback semantics**: code (git revert + redeploy) vs data (restore) vs ML artifacts (MLOps promote rollback).
- Keep `backups/` gitignored-but-functional; store archive checksums for integrity.

## Post-Phase-0 acceptance criterion

Production databases must have automated daily backups verified by a monthly restore drill by the end of Phase 0.