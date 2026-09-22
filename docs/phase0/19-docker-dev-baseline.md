# Phase 0 — 19 Docker / local development baseline

## Current state

- **Fully-containerized production image:** root `Dockerfile` (multi-stage: Node 20 builds frontend → python:3.12-slim + nginx serves static + proxies `/api`); `nginx.conf`, `supervisord.conf`, `start.sh`, `docker-compose.deploy.yml` for single-container deploy.
- **Compose for core services:** `backend/docker-compose.yml` — `backend` (build, port 8000, env_file), `postgres:16-alpine` (healthcheck, volume), `neo4j:5.24-community` (GDS plugin, healthcheck, volume). `restart: unless-stopped` everywhere.
- **MLOps compose:** `docker/mlops.Dockerfile` + `docker/mlops-compose.yml`.
- **CI**: `ci.yml` validates compose config.
- Healthchecks: pg_isready for postgres; wget :7474 for neo4j; backend depends on both.

## Assessment

- Solid baseline for both dev (compose DBs + local backend) and deploy (single nginx image). Healthchecks + restart policy are production-ready habits.

## Gaps / risks

1. **No dev-compose profile with volume-mounted hot-reload** — the compose backend is a build image; the documented dev flow uses `dev-all.js` on host instead. Provide both clearly.
2. Default `POSTGRES_PASSWORD`/`NEO4J_PASSWORD` fallbacks (`saksha_user`/`neo4j`) — production posture requires explicit env (startup validation already rejects default Neo4j password in prod).
3. **Model artifacts not on a volume** in compose (report 14) — `mlflow/` in-image only.
4. No pinning of base image digests; supply-chain risk for `python:3.12-slim`/`node:20`.
5. Docker build test in CI only validates compose syntax, not `docker build`.

## Phase 0 actions

- Add `docker-compose.dev.yml` (postgres/neo4j only, named dev volumes) and document host-vs-container dev flow.
- Mount `mlflow/` and `backend/uploads/` as volumes in deploy compose.
- Optionally pin image digests in a `docker/` audit note; add a Docker build smoke stage to CI if infra allows.