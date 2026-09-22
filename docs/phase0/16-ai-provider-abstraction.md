# Phase 0 — 16 AI-provider abstraction

## Current state

- **Chat LLM abstraction (`app/ai/chat/llm_generator.py`):** `LLM_PROVIDER` = `auto | groq | gemini | openai | local`. `auto` builds a failover chain `groq → gemini → openai → local templates`. Per-provider API keys supported as comma-separated fallbacks. Model override via `LLM_MODEL`. Temperature/max-tokens tunable.
- **Chat pipeline:** `backend_fetcher` (threaded, max_workers=4) → `query_planner` → `rag_retriever` → `context_builder` → `entity_extractor` → `intent_router` → `llm_generator` → `response_validator`. Rule-based answers are explicitly labelled; hosted-LLM answers come only from extraction + retrieval + fetchers (never fabricated).
- **Face recognition:** `FACE_RECOGNITION_PROVIDER` = `auto | zoho | local` (Zoho Catalyst/Zia SDK when installed, else bundled local engine).
- **Positioning:** MLOps registry abstracts model lifecycle; inference uses rule-based fallbacks (`prediction_mode`).

## Assessment

- LLM and face-recognition already have provider abstractions with failover. Good precedent for V3.

## Gaps / risks

1. **ML predictive models are not provider-pluggable** — algorithms are fixed implementations; no pluggable inference for hotspot/risk/criminal/anomaly beyond in-repo code.
2. `auto` failover behavior is opaque to consumers (no surfaced "which provider served this"); minimizing latency vs availability trade-off unverified.
3. No per-provider request/byte quotas beyond global AI rate-limit budget.
4. Local templates path must remain deterministic and footnoted rule-based — risk of silently producing "LLM-like" non-LLM answers.

## Phase 0 actions

- Write `docs/ai/provider-abstraction.md`: provider interface contract, config, failover semantics, and honesty labels.
- Surface `provider_used`/`generation_mode` in chat responses for observability.
- Define the Phase 0 decision-recommendation on ML model pluggability (keep fixed algorithms; standardize interface only).