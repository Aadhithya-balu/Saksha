# Phase 0 — 13 Data provenance model

## Current state

- **Docs:** `docs/network/provenance_intelligence.md` — Neo4j intelligence + data provenance; `docs/operations/runbook.md` § data flow.
- **Data mode (#162/#190):** `SAKSHA_DATA_MODE` (`production|demo|test`) is the configurable boundary on silent demo-data fallback. A "mixed provenance" state is reported through the provenance pipeline, never configured.
- **Prediction honesty:** AI responses/stats carry `prediction_mode: "ML" | "FALLBACK"`; fabricated fallbacks (criminal risk/repeat offender `45/MEDIUM/0.72`, hotspot metrics) were removed and now return `null`/"Unavailable".
- **Identity resolution:** results are proposed leads requiring human review (never auto-confirm/auto-accuse).
- **Import jobs:** bulk ingestion records entity_type/status/row report JSON (`import_jobs`).
- Tests: `test_provenance.py`, `test_network_provenance.py`, `test_data_mode.py`.

## Assessment

- Provenance is handled at three levels: data mode (demo vs live), prediction mode (ML vs fallback), and graph edge provenance. Strong.

## Gaps / risks

1. **No unified traceability table** linking every displayed number → source (table/algorithm/provider) across analytics, dashboards, and intelligence modules; it's per-module.
2. Frontend does not systematically display `prediction_mode`/provenance badges on cards (only some).
3. Import provenance (row → source file/job) exists per job but no join to downstream displayed entities (reports/CRUD inherits from case lineage).
4. Neo4j edges lack provenance timestamps/source labels → "hidden relationship discovery" claims need verifiable origin.

## Phase 0 actions

- Define the Phase 0 provenance target model: source → extraction → entity → UI section, with `provenance` field in schemas where policies demand.
- Standardize a `provenance`/`source` metadata contract in API responses (ALPHA) and audit UI display of ML vs rule vs fallback.
- Add edge/relationship provenance fields to Neo4j ingest (source_case, imported_job_id, resolved_at).
- Add a provenance policy doc (`docs/provenance/policy.md`).