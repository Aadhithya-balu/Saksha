# Phase 0 — 10 Configuration system

## Current state

- **`app/core/config.py`** — pydantic-settings `Settings` singleton via `lru_cache`, field validators + model_validator. Env-driven via `backend/.env`.
- **Data modes** (`SAKSHA_DATA_MODE`: `production | demo | test`, issue #162/#190) — production disables silent fallback to seeded data; invalid value refuses to start; validated in `app/core/data_mode.py`.
- **Startup safety validation** (`APP_ENV=production`): hard-fails on weak JWT entropy, open CORS, debug flags, default passwords, SQLite — verified by `tests/test_config_production.py` + `test_config.py`.
- Env inventory (from `.env.example`): app, data mode, Supabase PG, Supabase auth, Neo4j, JWT, model auto-refresh, login lockout, rate limits, notification dedup, body cap, LLM providers/models/temperature, CORS, file storage, face recognition, worker pool tuning.

## Assessment

- Fluent, validated, mode-aware config with **production hard-fail** safety — a strong baseline that V3 can build on.

## Gaps / risks

1. **Secrets storage** — env file only; no vault/secret-manager integration (acceptable for datathon scope, but document the boundary).
2. No **environment inventory doc** (field → meaning → prod constraint) beyond `.env.example` comments.
3. Some values are runtime-switchable via env only; no admin UI for non-secret tuning (system_settings table exists — unused for these?).
4. CORS list and rate-limit budgets differ per deployment; drift risk between `nginx.conf`, compose, and `core/config.py`.

## Phase 0 actions

- Write `docs/config-inventory.md` enumerating each setting, its validator, data-mode interaction, and production constraint.
- Document secrets hygiene (never in repo; `.env.*` ignored except example; ND-`JWT_SECRET_KEY` generation) in the security baseline report.
- Add a startup self-check that the loaded config matches `.env.example` keys (detect typos/spelling drift).