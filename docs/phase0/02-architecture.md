# Phase 0 — 02 Architecture documentation

## Current state

- `CONTEXT.md` (649 lines) is the authoritative developer architecture doc: stack, diagrams, data flow, repo layout, 16+ tables, Neo4j schema, 75+ endpoints, RBAC, AI/ML architecture, UI/UX, CI/CD, MLOps, seed data, known limitations, commands.
- `docs/ai/predictive_models.md` — model architecture and metrics.
- `docs/network/provenance_intelligence.md` — Neo4j intelligence + data provenance.
- `docs/operations/runbook.md` — verified production runbook (deploy/config/start/monitor/recover).
- `docs/validation/final-test-v2.md` — validation/certification record.
- `V3-PROPOSED.md` — full V3 vision (detect/extract/connect/analyze/etc.), the target architecture.

## Assessment

- Coverage is unusually thorough; the V3 vision is already written down. The stated Phase 0 goal ("architecture documentation") is largely satisfied by existing docs.

## Gaps / risks

1. No **ADR (Architecture Decision Records)** log — key decisions (data mode, provider failover, honest fallbacks, worker pool split) live only in commit messages and comments.
2. No **C4-level diagrams** (system context / container / component) beyond ASCII box diagrams in `CONTEXT.md`.
3. **`CONTEXT.md` vs `runbook.md` duplication**: runbook restates architecture; single source of truth is not defined.
4. No dedicated doc for the **frontend architecture** (page decomposition, store/hook usage, `navigate-tab` event flow) — it is embedded in `CONTEXT.md` only.

## Phase 0 actions

- Add `docs/adr/` with lightweight entries for: data mode gating (#162/#190), district scoping fails-closed, LLM provider failover, worker session pool, honest fallback policy, DB pool tuning, TTL cache invalidation.
- Add a frontend architecture doc (`docs/frontend/architecture.md`) covering `api.ts` service layer, Zustand stores, `navigate-tab` flow, `selected_entity_id`, and byte-locked pages.
- Make `CONTEXT.md` the single architecture source and have `runbook.md` link to it rather than restating.