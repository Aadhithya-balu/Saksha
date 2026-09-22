# Phase 0 — 05 Existing AI assessment

## Current state

- `backend/app/ai/` (~40 files) organized as `inference/`, `models/`, `features/`, `pipelines/`, `vectorstore/`, `prompts/`, plus `chat/` (extraction, intent routing, RAG retrieval, orchestration, generation, response validation) and `face/`.
- Algorithms: LightGBM+Optuna hotspot, RandomForest district risk, XGBoost/LightGBM forecast, weighted-linear criminal risk, logistic-GD repeat offender, cosine-KNN similar offender, mini k-means clustering, z-score anomaly, TF-IDF+LSA MO semantic search + rule-based NER, composite victimology index, pre/post intervention verdicts.
- MLOps: fs-backed registry (`mlflow/`), training→evaluate→register pipeline, drift thresholds (`monitoring/drift_rules.json`), dataset versioning, CLI.
- Auto-refresh scheduler: background thread started in `main.py` (`maybe_refresh_async`) with `AUTO_RETRAIN_ENABLED` + min-interval config.
- Honesty guarantees: fallbacks return null / `prediction_mode: FALLBACK`; `network /search` no longer fabricates risk_score; criminal risk/repeat-offender return "Unavailable" instead of invented numbers.

## Assessment

- Strong breadth, standardizeable interface (`train/evaluate/predict/save/load`), auto-train on first inference, `lru_cache` model singletons. Recent passes removed fabricated outputs.

## Gaps / risks

1. **RAG vector store is in-memory** (SHA-256 hash embeddings) — lost on restart; no persistence path for V3's larger corpus.
2. **Model artifacts** live on the local filesystem under `backend/app/ai/models/` and `mlflow/` — no object-store backing, no artifact integrity/versioning audit.
3. Model **metrics/validation docs** exist in `docs/ai/predictive_models.md` but are not machine-verifiable (no golden-score regression tests).
4. Some feature files remain empty stubs (documented: consolidated into `feature_engineering.py`) — decide whether to delete or document as canonical.
5. Face recognition references are disk/cache based after seeding; keep DB-independent (documented constraint).

## Phase 0 actions

- Decide and document the **persistent embedding store** strategy (postgres table vs external) in an ADR.
- Add artifact registry to include checksums + provenance metadata (aligned with MLOps registry).
- Add golden-score smoke assertions for the 8 algorithms (bounds, not exact) to CI.
- Document AI decision model (what is "rule-based" vs "hosted-LLM" vs "ML") in `docs/ai/` to prevent regressions.