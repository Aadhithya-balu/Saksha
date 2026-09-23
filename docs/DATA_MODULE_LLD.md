# Data Module LLD

**Project:** SAKSHA — AI-Powered Crime Intelligence Platform  
**Component:** Data Management, Ingestion, Staging, Storage, & Provenance  
**Inspection Date:** September 2026  
**Status:** Implementation Blueprint (Based on Actual Codebase Inspection)

---

## 1. Module Overview

| Item | Details |
|---|---|
| **Purpose** | Authoritative data persistence, ingestion staging, validation, deduplication, schema normalization, provenance tracking, and binary forensic object storage for SAKSHA. |
| **Responsibilities** | 1. Ingest bulk historical crime/offender/victim records via CSV/XLSX.<br>2. Map disparate schemas (Standard and CCTNS/ICJS extracts).<br>3. Stage raw and normalized rows in `import_staging_records`.<br>4. Detect exact and potential duplicates against production data.<br>5. Compute quality grades (A, B, C, D, REJECTED).<br>6. Provide audited atomic promotion and rollback.<br>7. Ingest binary forensic files (images, audio, video, PDFs) with magic-byte validation and technical metadata extraction.<br>8. Support dual database connectivity: PostgreSQL/Supabase primary with SQLite local demo fallback. |
| **Inputs** | Multipart CSV/XLSX files, multipart binary evidence/image files, JSON payloads from CRUD routes, CCTNS extract files. |
| **Outputs** | Validated records in production tables (`crime_cases`, `criminals`, `victims`, `evidence`), staged records, validation error reports, quality grades, file metadata JSONB, lineage records. |
| **Dependencies** | PostgreSQL (Supabase), SQLite (fallback), SQLAlchemy 2.0, openpyxl, Pillow, pymediainfo, PyPDF2, FastAPI, Zustand (frontend). |

---

## 2. Scope

### Include
* Core relational tables: `crime_cases`, `firs`, `fir_criminal_links`, `fir_victim_links`, `criminals`, `victims`, `locations`, `officers`, `roles`, `users`.
* Bulk ingestion engine for `crime_cases`, `criminals`, and `victims`.
* Profile-driven header transformation (`standard`, `cctns`).
* Row-level staging and reconciliation tracking (`import_jobs`, `import_staging_records`).
* Quality grading algorithm (letter grades A–D, REJECTED).
* Atomic promotion into operational tables with lineage metadata (`dataset_provenance='migrated'`).
* Atomic rollback deleting all production records derived from a specific import job.
* Forensic file upload, magic-byte sniffing, and metadata extraction (EXIF, PyMediaInfo, PyPDF2).
* Storage routing: local filesystem (`backend/uploads/`) with optional Supabase bucket upload.
* Data mode controls (`production`, `demo`, `test`) and provenance reporting.

### Exclude
* Analytical computations (Getis-Ord $G_i^*$, Moran's $I$, KDE) — belongs to **Hotspot Module**.
* Graph pathfinding and link analysis algorithms — belongs to **Network Module**.
* NLP entity extraction and LLM orchestration — belongs to **NER & AI Modules**.
* Live CCTV camera RTSP stream decoding / frame analysis (not implemented in codebase).
* Public social media / web scrapers (not implemented in codebase).

### Future Scope
* Background SFTP/directory watcher daemon for automated police station dropboxes.
* Optical Character Recognition (OCR) engine (Tesseract/PaddleOCR) for scanned PDFs and physical seizure memos.
* Dedicated standalone `vehicles` table (currently vehicles are extracted entity strings or MO text).

---

## 3. Existing Implementation

| Component | File / Location | Status | Description |
|---|---|---|---|
| **Database Engine & Pool** | `backend/app/database/postgres.py` | Implemented | SQLAlchemy 2.0 engine with separate app/worker pools; automatic fallback to local `sqlite:///./saksha.db` if PostgreSQL is unreachable. |
| **Database Config** | `backend/app/core/config.py` | Implemented | Validates `DATABASE_URL`, `SUPABASE_DB_*`, pool sizes, and upload directory settings. |
| **Data Mode Controller** | `backend/app/core/data_mode.py` | Implemented | Enforces `production`, `demo`, and `test` data isolation rules. |
| **Staging & Lineage Models** | `backend/app/models/import_job.py` | Implemented | `ImportJob`, `ImportStagedRecord`, and `ImportProvenanceMixin`. |
| **Core Entity Models** | `backend/app/models/*.py` | Implemented | 28 active models: `CrimeCase`, `FIR`, `Criminal`, `Victim`, `Location`, `Officer`, `Evidence`, `AuditLog`, `Notification`, etc. |
| **Ingestion Engine Service** | `backend/app/services/ingest_service.py` | Implemented | 61KB engine: file gate, mapping, normalization, deduplication, grading, promotion, rollback. |
| **Data Quality Service** | `backend/app/services/data_quality_service.py` | Implemented | Provenance aggregations (`live`, `demo`, `migrated`, `unknown`) across core tables. |
| **Data Import Router** | `backend/app/routes/data_import.py` | Implemented | 10 endpoints for preview, commit, job quality, staged rows, promote, rollback, lineage. |
| **System Provenance Router** | `backend/app/routes/system.py` | Implemented | Exposes `/system/data-mode` and `/system/provenance-summary`. |
| **Evidence File Service** | `backend/app/services/evidence_service.py` | Implemented | Magic-byte checks, local disk + Supabase Storage upload, EXIF/MediaInfo/PyPDF2 metadata extraction. |
| **Person Image Service** | `backend/app/services/person_image_service.py` | Implemented | Upload and storage for criminal, victim, and officer photos. |
| **Seed Script** | `backend/app/database/seed_db.py` | Implemented | 99KB seed file populating initial users, officers, locations, cases, FIRs, and indicators. |
| **SQL Setup Scripts** | `backend/scripts/saksha_full_setup.sql`, `import_pipeline_upgrade.sql` | Implemented | Production SQL DDL schemas for fresh Supabase deployments. |
| **Admin Import UI** | `datathon/src/components/admin/DataImportPanel.tsx` | Partially Implemented | Upload, entity selector, profile selector, dry-run, commit summary. Lacks row review & promote/rollback UI. |
| **Admin Quality UI** | `datathon/src/components/admin/DataQualityPanel.tsx` | Implemented | Provenance distribution table and metric cards. |
| **Frontend API Client** | `datathon/src/services/api.ts` | Partially Implemented | Exposes `getImportEntities`, `analyzeImportFile`, `commitImportFile`, `listImportJobs`. Lacks promote/rollback/lineage bindings. |

---

## 4. Architecture / Components

### CURRENT Architecture

```text
[Frontend: DataImportPanel.tsx / Evidence Page]
                     │
                     ▼ (HTTP Multipart / REST)
+────────────────────────────────────────────────────────────────────────+
| FastAPI Ingestion Layer (app/routes/data_import.py & evidence.py)      |
+────────────────────────────────────────────────────────────────────────+
                     │
        ┌────────────┴──────────────────────────┐
        ▼                                       ▼
+────────────────────────────────+    +─────────────────────────────────+
| ingest_service.py              |    | evidence_service.py             |
| - validate_file()              |    | - validate_upload_file()        |
| - analyze_upload()             |    | - save_upload_file()            |
| - run_import_pipeline()        |    | - extract_metadata()            |
| - compute_quality_grade()      |    +─────────────────────────────────+
| - promote_import()             |                      │
| - rollback_import()            |         ┌────────────┴───────────┐
+────────────────────────────────+         ▼                        ▼
        │                         [Local Disk: uploads/]  [Supabase Storage]
        ▼
+────────────────────────────────────────────────────────────────────────+
| SQLAlchemy ORM (SessionLocal / get_worker_session)                     |
+────────────────────────────────────────────────────────────────────────+
        │
        ▼
+────────────────────────────────────────────────────────────────────────+
| Database Storage Layer                                                 |
| - Primary: PostgreSQL 16 (Supabase)                                    |
| - Fallback: SQLite (sqlite:///./saksha.db if Postgres unreachable)     |
| Tables: import_jobs, import_staging_records, crime_cases, firs, etc.   |
+────────────────────────────────────────────────────────────────────────+
```

### TARGET / REQUIRED Architecture

```text
[Frontend: DataImportPanel.tsx with StagedRecordsViewer]
                     │
                     ▼ (HTTP Multipart / REST)
+────────────────────────────────────────────────────────────────────────+
| FastAPI Ingestion Layer                                                |
+────────────────────────────────────────────────────────────────────────+
                     │
        ┌────────────┴──────────────────────────┐
        ▼                                       ▼
+────────────────────────────────+    +─────────────────────────────────+
| Ingestion & Staging Engine     |    | Enhanced Evidence Service       |
| - Small batches (<=1k rows):   |    | - Magic bytes sniffing          |
|   Synchronous execution        |    | - PyPDF2 text content extraction|
| - Large batches (>1k rows):    |    | - Future: OCR Engine            |
|   Async worker thread pool     |    +─────────────────────────────────+
+────────────────────────────────+                      │
        │                                               ▼
        ▼                                     [Storage Layer (Local/S3)]
+────────────────────────────────────────────────────────────────────────+
| Staging Area (`import_staging_records`)                                |
| - Full review UI for conflict resolution                               |
| - Explicit admin promotion & rollback controls                         |
+────────────────────────────────────────────────────────────────────────+
        │
        ▼ (promote_import)
+────────────────────────────────────────────────────────────────────────+
| Production PostgreSQL Tables with Full Lineage Audit                   |
+────────────────────────────────────────────────────────────────────────+
```

---

## 5. Components / Classes / Services

| Component | Responsibility | Important Methods / Functions |
|---|---|---|
| `ingest_service.py` | Primary bulk parsing, validation, staging, deduplication, and lifecycle engine. | `validate_file(content, filename)`<br>`analyze_upload(db, content, filename, entity, profile)`<br>`run_import_pipeline(db, content, filename, entity, profile, user_id)`<br>`compute_quality_grade(metrics)`<br>`promote_import(db, job, user_id, include_review)`<br>`rollback_import(db, job)`<br>`record_lineage(db, entity, record_id)` |
| `data_quality_service.py` | Aggregates system-wide data provenance metrics. | `get_provenance_summary(db)`<br>`get_provenance_by_entity(db)`<br>`get_provenance_warnings(db)` |
| `evidence_service.py` | Handles forensic file storage, magic bytes, and technical property extraction. | `validate_upload_file(file)`<br>`save_upload_file(upload_file, evidence_id)`<br>`extract_metadata(file_path, mime_type)`<br>`_upload_to_supabase_storage(file_path, key, mime)` |
| `person_image_service.py` | Handles image storage for criminal, victim, and officer dossiers. | `save_person_image(upload_file, entity_type, entity_id)` |
| `data_mode.py` | Enforces runtime data mode isolation and provenance normalization. | `get_data_mode()`<br>`is_production()`<br>`normalize_provenance(value)` |
| `postgres.py` | Engine initialization, connection pooling, and SQLite fallback logic. | `_create_engine(url, worker)`<br>`_engine_options(url, worker)`<br>`get_db()`<br>`get_worker_session()` |

---

## 6. Database Design

### Table: `import_jobs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `filename` | VARCHAR(255) | NOT NULL | Name of uploaded file |
| `entity_type` | VARCHAR(50) | NOT NULL | Target entity: `crime_cases`, `criminals`, `victims` |
| `profile` | VARCHAR(50) | NOT NULL, DEFAULT `'standard'` | Mapping profile: `standard`, `cctns` |
| `source_system` | VARCHAR(100) | NOT NULL, DEFAULT `'manual_upload'` | Source system identifier |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT `'staged'` | Lifecycle: `staged`, `promoted`, `rolled_back`, `failed` |
| `total_rows` | INTEGER | NOT NULL, DEFAULT 0 | Total rows parsed |
| `valid_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows passing all validation rules |
| `invalid_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows with schema/type failures |
| `warning_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows with non-blocking warnings |
| `exact_duplicate_rows` | INTEGER | NOT NULL, DEFAULT 0 | Exact matches against DB / batch |
| `potential_duplicate_rows` | INTEGER | NOT NULL, DEFAULT 0 | Fuzzy/heuristic duplicate matches |
| `conflict_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows conflicting with existing records |
| `new_record_rows` | INTEGER | NOT NULL, DEFAULT 0 | Net new unique records |
| `matched_record_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows matching existing entities |
| `updated_record_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows updating existing entities |
| `rejected_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows blocked from promotion |
| `review_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows requiring human review |
| `error_count` | INTEGER | NOT NULL, DEFAULT 0 | Cumulative error count |
| `promoted_rows` | INTEGER | NOT NULL, DEFAULT 0 | Rows promoted to production |
| `quality_grade` | VARCHAR(10) | NULLABLE | Letter grade: `A`, `B`, `C`, `D`, `REJECTED` |
| `imported_by_id` | UUID | FK -> `users.id` ON DELETE SET NULL | Uploading user |
| `promoted_by_id` | UUID | FK -> `users.id` ON DELETE SET NULL | Authorizing admin |
| `validation_report` | TEXT | NULLABLE | JSON string summarizing errors |
| `processing_started_at` | TIMESTAMPTZ | NULLABLE | Pipeline start time |
| `processing_completed_at`| TIMESTAMPTZ | NULLABLE | Pipeline completion time |
| `promoted_at` | TIMESTAMPTZ | NULLABLE | Promotion timestamp |
| `rolled_back_at` | TIMESTAMPTZ | NULLABLE | Rollback timestamp |
| `created_at` / `updated_at` | TIMESTAMPTZ | DEFAULT `now()` | Standard timestamps |

* **Indexes:** `ix_import_jobs_created_at`, `ix_import_jobs_status`.
* **Relationships:** One-to-many with `import_staging_records`.

---

### Table: `import_staging_records`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `job_id` | UUID | FK -> `import_jobs.id` ON DELETE CASCADE, NOT NULL | Owning import job |
| `row_number` | INTEGER | NOT NULL | CSV/XLSX row index |
| `source_row_ref` | VARCHAR(100) | NULLABLE | External source row identifier |
| `raw_data` | TEXT | NULLABLE | Verbatim mapped source values (JSON) |
| `mapped_data` | TEXT | NULLABLE | Normalized Saksha values (JSON) |
| `validation_status` | VARCHAR(20) | NOT NULL, DEFAULT `'pending'` | `valid`, `invalid`, `warning` |
| `validation_errors` | TEXT | NULLABLE | JSON array `[{code, field, message}]` |
| `validation_warnings` | TEXT | NULLABLE | JSON array `[{code, field, message}]` |
| `duplicate_status` | VARCHAR(30) | NOT NULL, DEFAULT `'unique'` | `unique`, `exact_duplicate`, `potential_duplicate` |
| `duplicate_of` | TEXT | NULLABLE | JSON array of matched UUIDs |
| `reconciliation_status`| VARCHAR(30) | NOT NULL, DEFAULT `'pending'` | `pending`, `resolved`, `manual_override` |
| `reconciliation_details`| TEXT | NULLABLE | JSON object describing field differences |
| `trust_level` | VARCHAR(30) | NOT NULL, DEFAULT `'rejected'` | `trusted`, `review`, `rejected` |
| `promoted` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether row was written to live DB |
| `promoted_record_id` | UUID | NULLABLE | Target entity UUID in production table |
| `promoted_at` | TIMESTAMPTZ | NULLABLE | Timestamp of promotion |
| `created_at` / `updated_at` | TIMESTAMPTZ | DEFAULT `now()` | Standard timestamps |

* **Indexes:**
  * `ix_import_staging_records_job_id` ON (`job_id`)
  * `ix_staging_job_row` ON (`job_id`, `row_number`)
  * `ix_import_staging_records_promoted_record_id` ON (`promoted_record_id`)
  * `ix_import_staging_records_validation_status` ON (`validation_status`)

---

### Table: `evidence_metadata`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `evidence_id` | UUID | FK -> `evidence.id` ON DELETE CASCADE, UNIQUE, NOT NULL | Target evidence item |
| `filename` | VARCHAR(255) | NOT NULL | Sanitized stored filename |
| `filepath` | VARCHAR(500) | NOT NULL | Relative disk storage path |
| `filesize` | INTEGER | NOT NULL | Size in bytes |
| `mime_type` | VARCHAR(100) | NOT NULL | Verified MIME type |
| `uploaded_by` | VARCHAR(255) | NULLABLE | Username or badge ID of uploader |
| `storage_url` | VARCHAR(1000) | NULLABLE | Supabase Storage public/signed URL |
| `extracted_data` | JSON / JSONB | DEFAULT `'{}'` | EXIF, audio/video, or PDF properties |
| `created_at` / `updated_at` | TIMESTAMPTZ | DEFAULT `now()` | Standard timestamps |

---

### Table: `vehicles`
**Status: NOT IMPLEMENTED / REQUIRED**
* **Current State:** Vehicle registration numbers (e.g. `KA-01-AB-1234`) are extracted dynamically via regex NER in `mo_semantic_service.py` or stored as plain strings in case narratives.
* **Missing:** No dedicated relational table exists for vehicle entities, registration certificates, chassis numbers, or owner links.

---

## 7. API Design

| Method | Endpoint | Purpose | Request | Response | Auth / Roles |
|---|---|---|---|---|---|
| `GET` | `/api/v2/data-import/entities` | Supported entities, column specs, and profiles | None | Schema specification JSON | `admin`, `crime_analyst`, `investigator` |
| `GET` | `/api/v2/data-import/template/{entity}` | Download CSV/XLSX starter template | Query: `export_format=csv\|xlsx` | Binary file stream (`attachment`) | Authenticated |
| `POST` | `/api/v2/data-import/preview` | Dry-run upload parsing and error report | Multipart: `file`, `entity_type`, `profile` | Validation report, column mapping, error sample | `admin`, `crime_analyst`, `investigator` |
| `POST` | `/api/v2/data-import/commit` | Execute full staging pipeline and grading | Multipart: `file`, `entity_type`, `profile`, `dry_run`, `source_system` | `ImportJob` summary object with quality grade | `admin`, `crime_analyst` |
| `GET` | `/api/v2/data-import/jobs` | Paginated listing of all import jobs | Query: `page`, `page_size`, `status` | Paginated `ImportJob` list | Authenticated |
| `GET` | `/api/v2/data-import/jobs/{id}` | Get full job detail with report | Path: `id` | Full `ImportJob` object | Authenticated |
| `GET` | `/api/v2/data-import/jobs/{id}/quality` | Detailed quality metrics & problem ratios | Path: `id` | Quality metrics, thresholds, trust summary | Authenticated |
| `GET` | `/api/v2/data-import/jobs/{id}/records` | Row-level inspection of staged rows | Path: `id`, Query: `validation_status`, `reconciliation_status`, `limit`, `offset` | Staged rows list with errors & duplicate info | Authenticated |
| `POST` | `/api/v2/data-import/jobs/{id}/promote` | Promote eligible staged rows to production | Path: `id`, Form: `include_review` | Promotion result: `promoted_rows`, status | `admin` only |
| `POST` | `/api/v2/data-import/jobs/{id}/rollback` | Roll back all rows written by this job | Path: `id` | Rollback result: `removed_records`, status | `admin` only |
| `GET` | `/api/v2/data-import/lineage/{entity}/{id}` | Trace record to origin job and row | Path: `entity_type`, `record_id` | Provenance lineage JSON | Authenticated |
| `POST` | `/api/v2/evidence/{id}/upload` | Upload forensic file for evidence item | Path: `id`, Multipart: `file` | Updated `EvidenceDetail` with metadata | `admin`, `investigator`, `forensic`, `analyst` |
| `GET` | `/api/v2/evidence/{id}/download` | Stream download evidence file | Path: `id` | File stream / Redirect to Supabase Storage | Authenticated |
| `GET` | `/api/v2/system/provenance-summary` | Overall and per-entity dataset provenance breakdown | None | Provenance counts (`live`, `demo`, `migrated`, `unknown`) | Authenticated |

---

## 8. Input / Output

### Inputs
* **Tabular Ingestion Files:** Multipart `.csv` and `.xlsx` files up to 10MB and 5,000 rows.
* **Evidence Binary Files:** Multipart binary files up to 50MB conforming to allowlisted MIME types (JPEG, PNG, GIF, WEBP, MP4, MKV, MOV, MP3, WAV, OGG, PDF, TXT).
* **Administrative Form Actions:** Form-encoded parameters for `include_review` on promotion.
* **CRUD JSON Payloads:** Standard request models (`CrimeCaseCreate`, `FIRCreate`, `CriminalCreate`, `VictimCreate`).

### Outputs
* **Staging DTOs:** Serialized `ImportJob` summaries with counts (`valid_rows`, `invalid_rows`, `conflict_rows`), letter grade (`A`–`D`, `REJECTED`), and row-level error arrays.
* **Lineage-Stamped Records:** Production entities in `crime_cases`, `criminals`, `victims` carrying `dataset_provenance='migrated'` and `source_import_job_id`.
* **Technical Metadata:** `evidence_metadata` records containing technical media properties and local/cloud storage pointers.

---

## 9. Data Flow

```text
1. STRUCTURED BULK INGESTION FLOW
   Upload File (CSV/XLSX)
    ↓
   validate_file(): Verify extension (.csv/.xlsx), size (<=10MB), magic bytes.
    ↓
   openpyxl / csv.DictReader: Parse rows, apply CCTNS/standard column aliases.
    ↓
   Insert ImportJob (status='staging').
    ↓
   For each row:
     - Validate mandatory fields and data types.
     - Query DB for exact matches (case_number, fir_number) or fuzzy matches (name + DOB).
     - Write to import_staging_records (validation_status, raw_data, mapped_data, trust_level).
    ↓
   compute_quality_grade(): Grade = A (>=95%), B (>=85%), C (>=70%), D (>=50%), REJECTED (<50%).
   Update ImportJob (status='staged').
    ↓
   Admin triggers POST /jobs/{id}/promote:
     - Select staged rows WHERE validation_status='valid' AND trust_level='unique'.
     - Batch INSERT into production tables with dataset_provenance='migrated'.
     - Mark staged rows promoted=True.
     - Signal realtime_bus.publish() and mark_data_changed().

2. EVIDENCE FILE INGESTION FLOW
   Upload Multipart Binary File
    ↓
   validate_upload_file(): Sniff leading magic bytes against declared MIME type.
    ↓
   save_upload_file(): Write to backend/uploads/{uuid}.ext (UUID naming prevents path traversal).
    ↓
   Optional push to Supabase Storage bucket.
    ↓
   extract_metadata(): PIL (EXIF/dimensions), PyMediaInfo (codecs/bitrates), PyPDF2 (pages/author).
    ↓
   INSERT INTO evidence_metadata.
    ↓
   INSERT INTO chain_of_custody (action='UPLOADED').
    ↓
   UPDATE evidence SET status='In Analysis'.
```

---

## 10. Module Interactions

| Source Module | Interaction | Target Module | Current Code Status |
|---|---|---|---|
| **Data** | Inserts promoted cases with dates, categories, locations | **Crime Cases** | Current |
| **Data** | Inserts promoted offender profiles with aliases, MO summaries | **Criminals** | Current |
| **Data** | Inserts promoted victim demographics and statements | **Victims** | Current |
| **Data** | Stores forensic files, parses codecs/EXIF, logs custodial upload | **Evidence** | Current |
| **Data** | Emits `mark_data_changed()` signaling dataset modifications | **AI / Model Retraining** | Current |
| **Data** | Supplies new records for co-accused/shared-incident linkage | **Network Graph** | Current |
| **Data** | Supplies incident coordinates and timestamps | **Hotspots** | Current |
| **Data** | Supplies raw text narratives from cases and FIRs | **NER & Semantic MO** | Current |
| **Data** | Supplies total records and provenance counts | **Dashboard** | Current |

---

## 11. Business Logic / Rules

| Rule # | Condition | Action |
|---|---|---|
| **BR-D01** | Quality Grade is `REJECTED` (< 50% valid rows). | System blocks promotion; requires file re-upload or manual data cleaning. |
| **BR-D02** | Exact duplicate detected (`case_number` or `fir_number` exists). | Row marked `duplicate_status='exact_duplicate'`, `trust_level='rejected'`. Row is excluded from promotion. |
| **BR-D03** | Potential duplicate detected (criminal name + DOB match). | Row marked `duplicate_status='potential_duplicate'`, `trust_level='review'`. Staged row held until admin explicitly approves via `include_review=True`. |
| **BR-D04** | Promotion execution. | Admin role required. All promoted rows stamped with `dataset_provenance='migrated'` and `source_import_job_id`. |
| **BR-D05** | Rollback execution. | Admin role required. Performs atomic deletion of all production entities matching `source_import_job_id` and marks staged rows `promoted=False`. |
| **BR-D06** | File upload magic byte check. | Upload rejected if leading magic bytes do not match declared MIME type (e.g. executable renamed as `.jpg`). |
| **BR-D07** | Evidence file storage path. | File stored as `{evidence_id}_{uuid4()}.ext` inside `backend/uploads/` to guarantee zero path traversal vulnerabilities. |
| **BR-D08** | Database fallback. | If PostgreSQL is unreachable, system falls back to `sqlite:///./saksha.db` with warning, preserving read/write functionality in demo mode. |

---

## 12. Validation

| Input / Condition | Validation Rule | Failure Behaviour |
|---|---|---|
| **File Format** | Allowed extensions: `.csv`, `.xlsx`. Size <= 10MB. | HTTP 415 / 400 with `ImportSecurityError`. |
| **Required Case Headers** | Must contain `case_number`, `occurred_at`, `category`, `district`. | HTTP 400 with `missing_required_columns` array. |
| **Occurred At Date** | Must parse to ISO-8601 or standard datetime. | Row marked `validation_status='invalid'`; error recorded in staging record. |
| **Category Mapping** | Must match existing `crime_categories.name`. | If unmatched, auto-mapped to default `'Other'` category and warning logged. |
| **District Validation** | Must match one of 30 Karnataka districts. | If unmatched, validation warning logged; falls back to `'State HQ'`. |
| **Evidence File MIME** | Sniffed magic bytes must match allowlisted MIME set. | HTTP 400: `Unsupported file type`. File deleted immediately from disk. |
| **Evidence File Size** | Max size <= 50MB. | Stream truncated, partial file unlinked, HTTP 400 returned. |

---

## 13. Error Handling

| Error | Cause | System Behaviour |
|---|---|---|
| `ImportSecurityError` | Spoofed file extension or path traversal (`../`) in filename. | Rejects request with HTTP 415 / 400. No staging records created. |
| `UnicodeDecodeError` | CSV encoded with non-UTF8 encoding (e.g. Windows-1252). | Ingestion service catches exception, retries with `latin-1` fallback. If failed, returns HTTP 400. |
| `IntegrityError` (DB) | Duplicate key violation during production promotion. | Transaction automatically rolled back via `db.rollback()`; returns HTTP 409 Conflict. |
| File Size Overflow | Upload exceeds 50MB (evidence) or 10MB (tabular import). | Stream reading loop breaks; `os.remove(file_path)` called immediately; HTTP 400 returned. |
| Supabase Storage Timeout | Supabase cloud bucket unreachable or times out. | Logs warning; smoothly falls back to serving file from local disk path (`backend/uploads/`). |

---

## 14. Security / Access Control

| Area | Requirement / Current Implementation |
|---|---|
| **Authentication** | Mandatory JWT Bearer token authentication validated via `get_current_user`. |
| **RBAC Promotion Gate** | Only users with role `admin` can call `/data-import/jobs/{id}/promote` and `/rollback`. Implemented via `require_roles(ROLE_ADMIN)`. |
| **RBAC Ingestion Gate** | Only `admin` and `crime_analyst` can commit bulk import jobs via `/data-import/commit`. Implemented via `require_roles(ROLE_ADMIN, ROLE_CRIME_ANALYST)`. |
| **Anti-Traversal Protection** | Uploaded filenames sanitized using `os.path.basename` and replaced with server-generated UUIDs on disk. |
| **Magic-Byte Sniffing** | Browser-supplied `Content-Type` is treated as untrusted; true MIME is determined by inspect-sniffing file headers. |
| **Audit Trail** | Every import preview, commit, promotion, rollback, and evidence upload is recorded in `audit_logs` with actor ID and IP address via `audit_service.log_action()`. |

---

## 15. Existing vs Required Functionality

### Already Implemented
* Complete relational schema in PostgreSQL (with SQLite fallback) covering cases, FIRs, criminals, victims, evidence, custody, and audit logs.
* Row-level staging tables `import_jobs` and `import_staging_records` with provenance mixin.
* Ingestion engine with CCTNS header mapping, validation, duplicate detection, and quality grading.
* Backend promotion (`/jobs/{id}/promote`) and rollback (`/jobs/{id}/rollback`) endpoints.
* Evidence file upload with magic-byte validation, PyMediaInfo/PyPDF2/PIL property extraction, and Supabase cloud storage synchronization.
* Data quality service reporting provenance breakdown across tables.

### Partially Implemented
* **Frontend Data Import Workspace:** `DataImportPanel.tsx` in the Admin view handles upload and preview, but lacks UI controls to inspect individual staged rows, review duplicate conflicts, click "Promote", or click "Rollback".
* **Evidence Text Extraction:** `evidence_service.py` extracts PDF document metadata (page count, title), but does not extract plain text for copilot search.

### Not Implemented
* Scanned document OCR pipeline for physical case files.
* Live CCTV video stream decoder.
* Dedicated `vehicles` relational table.
* Automated folder watcher daemon for police station dropboxes.

### Required Changes
* Build frontend staged row inspection drawer and action buttons in `DataImportPanel.tsx`.
* Add missing API client methods to `datathon/src/services/api.ts`.
* Extract text from clean PDF evidence in `evidence_service.py`.

---

## 16. Implementation Tasks

| ID | Task | Files/Components | Priority | Status |
|---|---|---|---|---|
| **D-01** | Frontend Staging & Lifecycle API Bindings | `datathon/src/services/api.ts` | High | Required |
| **D-02** | Staged Records Inspection & Promotion UI | `datathon/src/components/admin/DataImportPanel.tsx` | High | Required |
| **D-03** | Record Provenance Lineage Popover | `datathon/src/components/admin/RecordLineageModal.tsx` | Medium | Required |
| **D-04** | PDF Text Extraction for Evidence | `backend/app/services/evidence_service.py` | Medium | Required |
| **D-05** | Async Batch Processing for Large Imports (>1k rows) | `backend/app/routes/data_import.py`, `ingest_service.py` | Low | Required |

---

## 17. Files to Create / Modify

### Modify

| File | Changes |
|---|---|
| `datathon/src/services/api.ts` | Add typed client functions: `getImportJobQuality`, `getImportJobRecords`, `promoteImportJob`, `rollbackImportJob`, `getRecordLineage`. |
| `datathon/src/components/admin/DataImportPanel.tsx` | Add staged records drawer modal, quality breakdown pill, "Promote to Production" button, and "Rollback" button. |
| `backend/app/services/evidence_service.py` | Add `PdfReader.extract_text()` parsing in `extract_metadata` to save readable PDF text to `extracted_data["text_content"]`. |

### Create

| File | Purpose |
|---|---|
| `datathon/src/components/admin/StagedRecordsViewer.tsx` | Dedicated modal/table for administrators to inspect staged rows, filter by validation status, and review duplicate warnings before promoting. |
| `datathon/src/components/admin/RecordLineageModal.tsx` | UI modal to display origin file name, row number, and import job ID for any record carrying `dataset_provenance='migrated'`. |

---

## 18. Dependencies

| Dependency | Used For | Current Status |
|---|---|---|
| `openpyxl` | Ingestion engine parsing of `.xlsx` Excel spreadsheets. | Current dependency (`requirements.txt`) |
| `csv` (Python stdlib) | Ingestion engine parsing of `.csv` delimited files. | Current dependency (Standard library) |
| `psycopg2-binary` / `SQLAlchemy` | Database ORM, staging persistence, and transaction handling. | Current dependency (`requirements.txt`) |
| `Pillow` (PIL) | Verification and EXIF metadata extraction for uploaded images. | Current dependency (`requirements.txt`) |
| `pymediainfo` | Technical stream extraction (codecs, bitrates, duration) for audio/video evidence. | Current dependency (`requirements.txt`) |
| `PyPDF2` | PDF page count, metadata, and text extraction. | Current dependency (`requirements.txt`) |
| `httpx` | Supabase Storage bucket HTTP API interactions. | Current dependency (`requirements.txt`) |

---

## 19. Testing / Verification

| Test | Expected Result |
|---|---|
| Upload invalid extension (e.g. `.exe` renamed to `.csv`) | HTTP 415 returned with `ImportSecurityError`. Zero rows staged. |
| Commit CCTNS CSV file with duplicate case number | Staged successfully; duplicate row flagged `duplicate_status='exact_duplicate'`, `trust_level='rejected'`. |
| Quality grade calculation on 90% valid dataset | Job assigned Grade `B`; problem ratio computed as `0.10`. |
| Admin executes `POST /jobs/{id}/promote` | Valid rows inserted into `crime_cases` with `dataset_provenance='migrated'`; staged rows marked `promoted=True`. |
| Admin executes `POST /jobs/{id}/rollback` | All records matching `source_import_job_id` deleted from `crime_cases`; job status set to `rolled_back`. |
| Upload PDF evidence and inspect database | `evidence_metadata.extracted_data` contains page count and extracted text content. |
| Simulate PostgreSQL disconnect | Engine falls back to `sqlite:///./saksha.db` with warning logged; server continues responding. |

---

## 20. Final Implementation Summary

### Current State
* The Data Module backend has a complete, production-grade staging, deduplication, quality grading, and promotion pipeline in `ingest_service.py`.
* Storage supports local disk with Supabase Storage cloud mirroring, protected by magic-byte sniffing and anti-path-traversal UUID naming.
* Database supports dual-mode execution (PostgreSQL primary with automatic SQLite fallback).

### Main Gaps
* `DataImportPanel.tsx` lacks UI controls to inspect individual staged rows, review duplicate conflicts, and trigger promotion or rollback.
* Evidence PDF processing does not extract plain text content for copilot search.
* Dedicated relational schema for vehicles is absent.

### Required Next Steps
1. Add typed client methods to `datathon/src/services/api.ts` (Task D-01).
2. Implement staged records drawer and promotion/rollback buttons in `DataImportPanel.tsx` (Task D-02).
3. Extract clean text from readable PDFs in `evidence_service.py` (Task D-04).
