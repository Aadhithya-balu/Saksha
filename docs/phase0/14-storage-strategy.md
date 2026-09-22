# Phase 0 — 14 Storage strategy

## Current state

- **Evidence files:** uploaded to **Supabase Storage** bucket (`SUPABASE_STORAGE_BUCKET`) when configured; otherwise stored under local `backend/uploads/` (dev only, gitignored). Includes binary upload/download/delete + `evidence_metadata` (file_type, hash, size) + chain-of-custody.
- **Person demo images:** served via logical refs (`person_image_service`) — internal storage paths never exposed.
- **Model artifacts:** filesystem-backed (`backend/app/ai/models/` + `mlflow/` registry) with drift/dataset versioning.
- **Imports:** uploaded CSV/XLSX via `data-import` (parse → validate → commit).
- **Socioeconomic indicators:** versioned CSV in `backend/data/socioeconomic/` + SQL reference (31 rows).
- **RAG:** in-memory SHA-256 vector store (regenerated at runtime).

## Assessment

- Clear split: external object store (Supabase) when configured vs local dev storage; file metadata trackers exist. Logical refs for demo content prevent path leakage.

## Gaps / risks

1. **No retention/capacity policy** for evidence files (bucket lifecycle rules or archival job).
2. **Uploads are not backed up** — no automated snapshot of Supabase Storage/local uploads.
3. **No CDN/cache strategy** for person images/evidence download; all traffic through backend.
4. **RAG index not persisted** (in-memory) — V3 decision needed (report 05).
5. **`mlflow/` is local fs** — containers lose artifacts on rebuild; decide a persistent volume/object-store for models.

## Phase 0 actions

- Write `docs/operations/storage-strategy.md`: object store layout, buckets/permissions, lifecycle (retention, purge), upload allow-list, size caps, hash verification, backup cadence (report 20).
- Move model artifacts behind a persistent volume in Docker compose (report 19).
- Decide RAG persistence model (recompute-on-boot vs stored index) in an ADR.