# Phase 0 — 15 Background-job strategy

## Current state

- **Auto-retrain scheduler:** background thread started from `main.py` startup (`maybe_refresh_async(db=..., reason="background-scheduler")`) using `app/ai/inference/refresh.py`; gated by `AUTO_RETRAIN_ENABLED`, min interval `AUTO_RETRAIN_MIN_INTERVAL_SECONDS`; returns status via model-management endpoints.
- **Multi-worker CPU/network work:** `ThreadPoolExecutor` — criminal AI workers (`routes/criminals.py:308`, max_workers=5), chat orchestrator/backend fetcher (max_workers=4). Explicitly must NOT share the request session (they open their own `SessionLocal()`/`get_worker_session()`).
- **Pool isolation:** background/worker code uses `app.database.postgres.get_worker_session()` (separate engine, `DB_WORKER_*`, defaults 3/12/300) so long jobs can't starve the request path (QueuePool timeout).
- **Durable job records:** `import_jobs` table for ingestion runs; MLOps CLI for manual cycles.
- Notification/activity pipelines are request-driven (SSE bus), not background.

## Assessment

- Pragmatic in-process scheduling with careful session/pool hygiene — correct for single-instance datathon deployment.

## Gaps / risks

1. **No durable job queue** (no Celery/RQ/Redis) — retry/backoff/resume for long training or ingestion is manual.
2. Scheduler is per-process; **multi-instance** would race the auto-retrain work (needs global lock).
3. No job status/visibility API for model training beyond MLOps registry (import_jobs covers imports only).
4. No graceful shutdown/cancellation semantics for workers.

## Phase 0 actions

- Document the current in-process strategy + constraints (`docs/operations/background-jobs.md`), including the worker-session rule.
- Decide Phase 0-whether V3 introduces a queue: recommend **no** for datathon single-instance; instead add a **global advisory lock** (pg `pg_advisory_lock`) around auto-retrain scheduler.
- Add a lightweight `job_runs` table (kind, status, started/finished, error, payload summary) or extend import-style pattern to training jobs.