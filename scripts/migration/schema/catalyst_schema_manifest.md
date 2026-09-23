# Catalyst Data Store — Console Table Creation Guide

Project: **Datathon-1** (`49978000000018001`) — Development

Create each table below in the Catalyst console using the [Data Store → Tables](https://console.catalyst.zoho.com) editor, then add the columns exactly as specified. Catalyst automatically adds `ROWID`, `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME` — do NOT create those.

Legend: **PK** primary key · **M** mandatory · **U** unique · **FK→table.column** foreign key.

## roles

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| name | varchar | 50 | Y | Y |  |  | app type VARCHAR(50) |
| description | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## crime_categories

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| name | varchar | 150 | Y | Y |  |  | app type VARCHAR(150) |
| section_code | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| severity | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## locations

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| address | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| district | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| station | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| latitude | double | 17 | Y |  |  |  |  |
| longitude | double | 17 | Y |  |  |  |  |
| pincode | varchar | 10 |  |  |  |  | app type VARCHAR(10) |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

Unique constraints: (station, address)

## system_settings

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| id | varchar | 36 | Y |  | Y |  | app type VARCHAR(36) |
| key | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| value | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| description | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| created_at | datetime |  |  |  |  |  |  |
| updated_at | datetime |  |  |  |  |  |  |

## users

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| username | varchar | 100 | Y | Y |  |  | app type VARCHAR(100) |
| email | varchar | 255 | Y | Y |  |  | app type VARCHAR(255) |
| full_name | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| hashed_password | text | 10000 | Y |  |  |  | app String(400) > 255 -> text |
| is_active | boolean |  | Y |  |  |  |  |
| failed_login_attempts | int | 10 | Y |  |  |  |  |
| locked_until | datetime |  |  |  |  |  |  |
| role_id | varchar | 36 | Y |  |  | roles.id | UUID stored as varchar(36) |
| district | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| station | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## officers

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| supabase_user_id | varchar | 36 |  |  |  |  | UUID stored as varchar(36) |
| user_id | varchar | 36 |  | Y |  | users.id | UUID stored as varchar(36) |
| badge_number | varchar | 50 | Y | Y |  |  | app type VARCHAR(50) |
| name | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| rank | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| station | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| district | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| designation | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| phone | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| email | varchar | 255 |  | Y |  |  | app type VARCHAR(255) |
| status | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| image_url | text | 10000 |  |  |  |  | app String(1000) > 255 -> text |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

Unique constraints: (email), (user_id)

## criminals

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| full_name | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| aliases | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| date_of_birth | date |  |  |  |  |  |  |
| gender | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| address | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| identifying_marks | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| mo_summary | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| gang_affiliation | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| neo4j_node_id | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| image_url | text | 10000 |  |  |  |  | app String(1000) > 255 -> text |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## victims

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| full_name | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| contact_number | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| address | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| gender | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| age | int | 10 |  |  |  |  |  |
| statement | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| neo4j_node_id | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| image_url | text | 10000 |  |  |  |  | app String(1000) > 255 -> text |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## crime_cases

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| case_number | varchar | 50 | Y | Y |  |  | app type VARCHAR(50) |
| category_id | varchar | 36 | Y |  |  | crime_categories.id | UUID stored as varchar(36) |
| location_id | varchar | 36 | Y |  |  | locations.id | UUID stored as varchar(36) |
| occurred_at | datetime |  | Y |  |  |  |  |
| reported_at | datetime |  | Y |  |  |  |  |
| description | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| mo_tags | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| priority | varchar | 30 |  |  |  |  | app type VARCHAR(30) |
| progress | int | 10 |  |  |  |  |  |
| assigned_officer_id | varchar | 36 |  |  |  | officers.id | UUID stored as varchar(36) |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## firs

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| fir_number | varchar | 50 | Y | Y |  |  | app type VARCHAR(50) |
| crime_case_id | varchar | 36 | Y |  |  | crime_cases.id | UUID stored as varchar(36) |
| investigating_officer_id | varchar | 36 |  |  |  | officers.id | UUID stored as varchar(36) |
| complainant_name | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| complainant_contact | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| sections | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| filed_at | datetime |  | Y |  |  |  |  |
| status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| narrative | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| attachments | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## fir_criminal_links

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| fir_id | varchar | 36 | Y |  |  | firs.id | UUID stored as varchar(36) |
| criminal_id | varchar | 36 | Y |  |  | criminals.id | UUID stored as varchar(36) |
| role | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

Unique constraints: (fir_id, criminal_id)

## fir_victim_links

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| fir_id | varchar | 36 | Y |  |  | firs.id | UUID stored as varchar(36) |
| victim_id | varchar | 36 | Y |  |  | victims.id | UUID stored as varchar(36) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

Unique constraints: (fir_id, victim_id)

## evidence

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| case_id | varchar | 36 | Y |  |  | crime_cases.id | UUID stored as varchar(36) |
| title | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| description | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| evidence_type | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| status | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| created_by | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| assigned_to | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| storage_path | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| dataset_provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| source_import_job_id | varchar | 36 |  |  |  | import_jobs.id | UUID stored as varchar(36) |
| source_file | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## evidence_metadata

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| evidence_id | varchar | 36 | Y | Y |  | evidence.id | UUID stored as varchar(36) |
| filename | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| filepath | text | 10000 | Y |  |  |  | app String(500) > 255 -> text |
| filesize | int | 10 | Y |  |  |  |  |
| mime_type | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| uploaded_by | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| storage_url | text | 10000 |  |  |  |  | app String(1000) > 255 -> text |
| extracted_data | text | 10000 |  |  |  |  | JSON/JSONB stored as text |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## evidence_timeline

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| evidence_id | varchar | 36 | Y |  |  | evidence.id | UUID stored as varchar(36) |
| action | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| performed_by | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| role | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| description | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## evidence_assignments

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| evidence_id | varchar | 36 | Y |  |  | evidence.id | UUID stored as varchar(36) |
| assigned_by | varchar | 36 | Y |  |  | users.id | UUID stored as varchar(36) |
| assigned_to | varchar | 36 | Y |  |  | users.id | UUID stored as varchar(36) |
| status | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| assigned_at | datetime |  | Y |  |  |  |  |
| accepted_at | datetime |  |  |  |  |  |  |
| completed_at | datetime |  |  |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## chain_of_custody

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| evidence_id | varchar | 36 | Y |  |  | evidence.id | UUID stored as varchar(36) |
| from_user | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| to_user | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| action | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| location | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| remarks | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| timestamp | datetime |  | Y |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## evidence_ai_summary

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| evidence_id | varchar | 36 | Y |  |  | evidence.id | UUID stored as varchar(36) |
| summary | text | 10000 | Y |  |  |  | app String(None) > 255 -> text |
| model | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## reports

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| template | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| report_type | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| title | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| requested_by_id | varchar | 36 | Y |  |  | users.id | UUID stored as varchar(36) |
| district | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| date_from | datetime |  |  |  |  |  |  |
| date_to | datetime |  |  |  |  |  |  |
| format | varchar | 10 | Y |  |  |  | app type VARCHAR(10) |
| status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| file_url | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| version | int | 10 | Y |  |  |  |  |
| case_id | varchar | 36 |  |  |  | crime_cases.id | UUID stored as varchar(36) |
| provenance | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| integrity_hash | varchar | 64 |  |  |  |  | app type VARCHAR(64) |
| generation_method | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| analysis_fingerprint | varchar | 200 |  |  |  |  | app type VARCHAR(200) |
| failure_reason | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| source_record_count | int | 10 | Y |  |  |  |  |
| evidence_count | int | 10 | Y |  |  |  |  |
| generated_at | datetime |  |  |  |  |  |  |
| reviewed_at | datetime |  |  |  |  |  |  |
| finalized_at | datetime |  |  |  |  |  |  |
| archived_at | datetime |  |  |  |  |  |  |
| reviewed_by_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| finalized_by_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| content_snapshot | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| ai_reported | boolean |  | Y |  |  |  |  |
| ai_metadata | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## report_versions

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| report_id | varchar | 36 | Y |  |  | reports.id | UUID stored as varchar(36) |
| version_number | int | 10 | Y |  |  |  |  |
| created_by_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| reason | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| integrity_hash | varchar | 64 |  |  |  |  | app type VARCHAR(64) |
| content_snapshot | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| ai_metadata | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## report_source_links

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| report_id | varchar | 36 | Y |  |  | reports.id | UUID stored as varchar(36) |
| source_type | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| source_id | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| source_label | varchar | 255 |  |  |  |  | app type VARCHAR(255) |
| created_at | datetime |  | Y |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## report_evidence_links

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| report_id | varchar | 36 | Y |  |  | reports.id | UUID stored as varchar(36) |
| evidence_id | varchar | 36 | Y |  |  | evidence.id | UUID stored as varchar(36) |
| role | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| created_at | datetime |  | Y |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## audit_logs

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| user_id | varchar | 36 | Y |  |  | users.id | UUID stored as varchar(36) |
| action | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| resource_type | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| resource_id | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| details | text | 10000 |  |  |  |  | app String(1000) > 255 -> text |
| ip_address | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| result | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| metadata | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| timestamp | datetime |  | Y |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## notifications

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| user_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| sender_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| subject | text | 10000 | Y |  |  |  | app String(500) > 255 -> text |
| notification_type | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| category | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| title | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| message | text | 10000 | Y |  |  |  | app String(None) > 255 -> text |
| severity | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| priority | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| status | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| resource_type | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| resource_id | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| related_case_number | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| related_fir_number | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| is_read | boolean |  | Y |  |  |  |  |
| is_dismissed | boolean |  | Y |  |  |  |  |
| is_broadcast | boolean |  | Y |  |  |  |  |
| parent_id | varchar | 36 |  |  |  | notifications.id | UUID stored as varchar(36) |
| attachment_url | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| created_at | datetime |  | Y |  |  |  |  |
| read_at | datetime |  |  |  |  |  |  |
| acknowledged_at | datetime |  |  |  |  |  |  |
| resolved_at | datetime |  |  |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## investigation_notes

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| case_id | varchar | 36 | Y |  |  | crime_cases.id | UUID stored as varchar(36) |
| officer_id | varchar | 36 |  |  |  | officers.id | UUID stored as varchar(36) |
| officer_name | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| officer_badge | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| content | text | 10000 | Y |  |  |  | app String(None) > 255 -> text |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## chat_conversations

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| user_id | varchar | 36 | Y |  |  | users.id | UUID stored as varchar(36) |
| title | varchar | 200 | Y |  |  |  | app type VARCHAR(200) |
| is_temporary | boolean |  | Y |  |  |  |  |
| message_count | int | 10 | Y |  |  |  |  |
| last_message_at | datetime |  |  |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## chat_messages

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| conversation_id | varchar | 36 | Y |  |  | chat_conversations.id | UUID stored as varchar(36) |
| role | varchar | 16 | Y |  |  |  | app type VARCHAR(16) |
| content | text | 10000 | Y |  |  |  | app String(None) > 255 -> text |
| classification | varchar | 50 |  |  |  |  | app type VARCHAR(50) |
| sources_json | text | 10000 |  |  |  |  | JSON/JSONB stored as text |
| citations_json | text | 10000 |  |  |  |  | JSON/JSONB stored as text |
| seq | int | 10 | Y |  |  |  |  |
| created_at | datetime |  | Y |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## import_jobs

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| entity_type | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| source_format | varchar | 10 | Y |  |  |  | app type VARCHAR(10) |
| mapping_profile | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| source_system | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| filename | text | 10000 |  |  |  |  | app String(500) > 255 -> text |
| status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| total_rows | int | 10 | Y |  |  |  |  |
| imported_rows | int | 10 | Y |  |  |  |  |
| failed_rows | int | 10 | Y |  |  |  |  |
| valid_rows | int | 10 | Y |  |  |  |  |
| invalid_rows | int | 10 | Y |  |  |  |  |
| warning_rows | int | 10 | Y |  |  |  |  |
| exact_duplicate_rows | int | 10 | Y |  |  |  |  |
| potential_duplicate_rows | int | 10 | Y |  |  |  |  |
| conflict_rows | int | 10 | Y |  |  |  |  |
| new_record_rows | int | 10 | Y |  |  |  |  |
| matched_record_rows | int | 10 | Y |  |  |  |  |
| updated_record_rows | int | 10 | Y |  |  |  |  |
| rejected_rows | int | 10 | Y |  |  |  |  |
| review_rows | int | 10 | Y |  |  |  |  |
| error_count | int | 10 | Y |  |  |  |  |
| promoted_rows | int | 10 | Y |  |  |  |  |
| quality_grade | varchar | 10 |  |  |  |  | app type VARCHAR(10) |
| processing_started_at | datetime |  |  |  |  |  |  |
| processing_completed_at | datetime |  |  |  |  |  |  |
| promoted_at | datetime |  |  |  |  |  |  |
| rolled_back_at | datetime |  |  |  |  |  |  |
| validation_report | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| created_by_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| promoted_by_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## import_staging_records

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| job_id | varchar | 36 | Y |  |  | import_jobs.id | UUID stored as varchar(36) |
| row_number | int | 10 | Y |  |  |  |  |
| source_row_ref | varchar | 100 |  |  |  |  | app type VARCHAR(100) |
| raw_data | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| mapped_data | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| validation_status | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| validation_errors | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| validation_warnings | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| duplicate_status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| duplicate_of | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| reconciliation_status | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| reconciliation_details | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| trust_level | varchar | 30 | Y |  |  |  | app type VARCHAR(30) |
| promoted | boolean |  | Y |  |  |  |  |
| promoted_record_id | varchar | 36 |  |  |  |  | UUID stored as varchar(36) |
| promoted_at | datetime |  |  |  |  |  |  |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |

## interventions

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| district | varchar | 100 | Y |  |  |  | app type VARCHAR(100) |
| intervention_type | varchar | 50 | Y |  |  |  | app type VARCHAR(50) |
| title | varchar | 255 | Y |  |  |  | app type VARCHAR(255) |
| description | text | 10000 |  |  |  |  | app String(None) > 255 -> text |
| started_at | datetime |  | Y |  |  |  |  |
| ended_at | datetime |  |  |  |  |  |  |
| status | varchar | 20 | Y |  |  |  | app type VARCHAR(20) |
| created_by_id | varchar | 36 |  |  |  | users.id | UUID stored as varchar(36) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## mo_tags

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| name | varchar | 120 | Y | Y |  |  | app type VARCHAR(120) |
| id | varchar | 36 | Y |  | Y |  | UUID stored as varchar(36) |
| created_at | datetime |  | Y |  |  |  |  |
| updated_at | datetime |  | Y |  |  |  |  |

## case_mo_tags

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| case_id | varchar | 36 | Y |  | Y | crime_cases.id | UUID stored as varchar(36) |
| mo_tag_id | varchar | 36 | Y |  | Y | mo_tags.id | UUID stored as varchar(36) |

Unique constraints: (case_id, mo_tag_id)

## criminal_mo_tags

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| criminal_id | varchar | 36 | Y |  | Y | criminals.id | UUID stored as varchar(36) |
| mo_tag_id | varchar | 36 | Y |  | Y | mo_tags.id | UUID stored as varchar(36) |

Unique constraints: (criminal_id, mo_tag_id)

## revoked_tokens

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| jti | varchar | 64 | Y |  | Y |  | app type VARCHAR(64) |
| revoked_at | datetime |  | Y |  |  |  |  |
| expires_at | datetime |  | Y |  |  |  |  |

## socioeconomic_indicators

| Column | Data Type | Max Length | M | U | PK | FK | Notes |
|---|---|---|---|---|---|---|---|
| district | varchar | 50 | Y |  | Y |  | app type VARCHAR(50) |
| population_lakhs | double | 17 |  |  |  |  |  |
| area_sq_km | double | 17 |  |  |  |  |  |
| literacy_rate | double | 17 |  |  |  |  |  |
| sex_ratio | double | 17 |  |  |  |  |  |
| avg_income_lakhs | double | 17 |  |  |  |  |  |
| unemployment_rate | double | 17 |  |  |  |  |  |
| urbanization_type | varchar | 20 |  |  |  |  | app type VARCHAR(20) |
| urbanization_share_pct | double | 17 |  |  |  |  |  |
| data_year | int | 10 |  |  |  |  |  |

---
_Generated by `scripts/migration/generate_catalyst_schema.py` from the ORM. UUID columns are stored as `varchar(36)`.