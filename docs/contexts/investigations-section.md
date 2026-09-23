# Saksha — INVESTIGATIONS Section (`docs/contexts/investigations-section.md`)

> Runtime section label: **INVESTIGATIONS** (sidebar `NavGroup label:
> 'INVESTIGATIONS'`). Case-lifecycle tooling: register and manage crime cases,
> run the investigation workspace, administer FIRs, and handle the evidence chain.

| Page (route)      | Docs section |
| ----------------- | ------------ |
| Crime Cases — `/crime-cases` | §2 |
| Investigation — `/investigation` | §3 |
| FIRs — `/firs` | §4 |
| Evidence — `/evidence` | §5 |

---

## 1. Section overview

### 1.1 Pages (`datathon/src/components/layout/Sidebar.tsx`)

| id           | label            | path              | icon            |
| ------------ | ---------------- | ----------------- | --------------- |
| `crime_cases`| Crime Cases      | `/crime-cases`    | `FolderOpen`    |
| `investigation` | Investigation  | `/investigation`  | `Crosshair`     |
| `fir`        | FIRs             | `/firs`           | `FileWarning`   |
| `evidence`   | Evidence         | `/evidence`       | `ShieldCheck`   |

### 1.2 Route-level access (`useRBAC.ts`)

All four routes use **`INVESTIGATION_ROLES = ADMIN | SCRB | IO | INSPECTOR`**.
This mirrors backend `REVIEW_ROLES` (`admin, crime_analyst, investigator,
inspector`).

| Role | Can open section | Prime reason |
| ---- | :--------------: | ------------ |
| ADMIN | ✅ | Full write + delete |
| SCRB (Crime Analyst) | ✅ | Reads + case create/update; case notes write |
| IO (Investigator) | ✅ | Primary operator — create/update/notes/FIR/evidence |
| INSPECTOR | ✅ | Reads + evidence custody; case create/update on backend |
| SP (Policymaker) | ❌ | Not in INVESTIGATION_ROLES |
| FORENSIC | ❌ (route) | NOTE: FORENSIC is separately allowed on **/evidence** only (see §5) |
| VIEWER | ❌ | |

`PRIMARY_BY_ROLE` pins: ADMIN, INSPECTOR, IO → `crime_cases`; IO/INSPECTOR →
`investigation`, `fir`, `evidence`; FORENSIC → `evidence` and `crime_cases`.

### 1.3 Middleware conventions

- Backend routers are router-level `ALL_ROLES` for *reads*, with write/delete
  guards per endpoint (see each §x.2). Reads are district-scoped
  (`app/auth/scope.py`) and fail closed (403) for district-less bound users.
- Cross-tab: `navigate-tab` CustomEvent + `sessionStorage['selected_entity_id']`
  deep-links (used heavily from search pages and other sections).

---

## 2. Crime Cases (`datathon/src/pages/CrimeCases/index.tsx`)

### 2.1 What's on the page

- **List view** — `CrimeCasesList`: search, status/priority/district filters,
  rows with case number, category, district/station, priority chip, status chip;
  "New Case" button; deep-link badge when a `selected_entity_id` exists.
- **Create view** — `CreateCrimeCase`: guided form (case type, FIR linking,
  victim/person, category, severity, dates, details). Also auto-opened by
  `quick_action_intent` values `'Add Missing Person'` / `'Assign Case'`
  (sessionStorage), preserving the quick-action context.
- **Details view** — `CrimeCaseDetails`: header (case number, status, priority),
  overview cards, timeline of notes, linked FIRs, victim/person list, suspect
  links, notes composer, "Edit"/"New Note"/"Link FIR" affordances.
- **Edit view** — `EditCrimeCase`: full edit form; validation errors inline.

### 2.2 How it's done

- **Frontend** — view-mode switch (`list | create | details | edit`); consumes
  `sessionStorage['selected_entity_id']` and `sessionStorage['quick_action_intent']`
  on mount (then clears). Service calls via `api.ts` (`getCrimeCases`, `getCrimeCase`,
  `createCrimeCase`, `updateCrimeCase`, `deleteCrimeCase`, `addCaseNote`,
  `deleteCaseNote`, `linkFirsToCase`).
- **Backend** — `routes/crime_cases.py` (`prefix="/crime-cases"`, router-level
  `ALL_ROLES`):

  | Endpoint | Guard |
  | -------- | ----- |
  | `POST ""` | ADMIN, INVESTIGATOR, CRIME_ANALYST |
  | `PUT /{case_id}` | ADMIN, INVESTIGATOR, CRIME_ANALYST |
  | `DELETE /{case_id}` | ADMIN |
  | `POST /{case_id}/notes` | ADMIN, INVESTIGATOR |
  | `DELETE /{case_id}/notes/{note_id}` | ADMIN, INVESTIGATOR |
  | `POST /{case_id}/link-firs` | ADMIN, INVESTIGATOR |

### 2.3 Current behaviour

- Reads are available to all INVESTIGATION_ROLES; writes governed by the table
  above (SCRB can create/update cases but **not** notes alone nor delete).
- Every write is audited (`audit_service.log_action` backend;
  `useAuditStore.addLog` frontend for UI-driven actions such as quick-action).
- District scoping: a case list returns only rows inside the operator's scope.

---

## 3. Investigation Workspace (`datathon/src/pages/Investigation/index.tsx`)

### 3.1 What's on the page

- **List view** — federated, grouped search:
  `searchInvestigation(term)` returns **persons / victims / cases / firs /
  mo_matches** groups (`SEARCH_GROUPS` colors, `#1E6FD9` accent). Click opens the
  case.
- **Detail view** — workspace tabs around a selected case:
  - `CaseOverviewTab` — summary, status, priority, district.
  - `CaseTimelineTab` — chronological events/notes.
  - `CaseEntitiesTab` — persons/victims/suspects reachable.
  - `CaseEvidenceTab` — linked evidence badges + deep-links.
  - `CaseForensicsTab` — forensic report summaries/thresholds.
  - `CaseGraphTab` — small network view of entities.
  - `AIRecommendations` — rule-based AI officer recommendations.
  - `AIChatPanel` — embedded investigation-chat Q&A.
  - `MOPatternExplorer` — matched modus-operandi patterns (district-filtered per
    investigation-hub search).
- `useUserScope` applies district closure on searches.

### 3.2 How it's done

- **Frontend** — `searchInvestigation`, `getInvestigation`, `getCrimeCases` from
  `api.ts`; check on `sessionStorage['selected_entity_id']` to auto-open a case
  (deep-link from Command Center / search pages).
- **Backend** — `routes/investigation.py` (`prefix="/investigation"`, router-level
  `ALL_ROLES`) and `routes/investigation_hub.py` (router-level `ALL_ROLES`;
  MO matching filtered per-doc through `_mo_doc_district`). Multi-worker AI
  endpoints open their own worker sessions (`get_worker_session()`) and must not
  share the request session (`AGENTS.md`).

### 3.3 Current behaviour

- Search results are grouped and labelled with provenance (LIVE vs DEMO).
- Detail workspace is read-heavy; embedded chat streams through the existing
  chat pipeline.
- Audit: page views + any review actions logged.

### 3.4 Role behaviour (Investigation page)

Reads for all INVESTIGATION_ROLES; no in-page write gating beyond route:

| Role | Page | Read | Write (via embedded chat/tools) |
| ---- | :--: | :--: | :------------------------------- |
| ADMIN | ✅ | ✅ | ✅ |
| SCRB | ✅ | ✅ | ✅ (chat) |
| IO | ✅ | ✅ | ✅ (chat, primary operator) |
| INSPECTOR | ✅ | ✅ | ✅ (chat) |
| SP / FORENSIC / VIEWER | ❌ | | |

---

## 4. FIRs (`datathon/src/pages/FIR/index.tsx`)

### 4.1 What's on the page

- **List view** — `listFIRs` (search, status/district filters, 28-district array),
  deep-link via `selected_entity_id`.
- **Detail view** — `FIRTimeline`, `FIRAttachments`, **`FIRRiskScore`** (honest
  rule-based **`RULE-SQL-V2`** gauge — when the backend returns null the UI
  renders "Unavailable", never a fabricated number), `IntelligenceWorkspace`
  (optional intelligence builder on the FIR).
- **Create/Edit views** — `createFIR` / `updateFIR` forms + attachment uploads;
  delete with confirmation.
- `usePolling` + `downloadSecureDossier` + `useAuditStore` throughout.

### 4.2 How it's done

- **Backend** — `routes/firs.py` (`prefix="/firs"`, router-level `ALL_ROLES`):

  | Endpoint | Guard |
  | -------- | ----- |
  | `POST ""` | ADMIN, INVESTIGATOR |
  | `PUT /{fir_id}` | ADMIN, INVESTIGATOR |
  | `DELETE /{fir_id}` | ADMIN, INVESTIGATOR |
  | `POST /{fir_id}/attachments` | ADMIN, INVESTIGATOR |
  | `DELETE /{fir_id}/attachments/{attachment_id}` | ADMIN, INVESTIGATOR |

  Reads, risk score, export and preview are `ALL_ROLES`.
- FIR numbers are user-facing strings; services resolve them (see evidence
  `_resolve_assignee` pattern in AGENTS.md). All scores are deterministic /
  rule-based server-side; no AI fabrication.

### 4.3 Current behaviour

- SCRB/INSPECTOR can read and export FIRs but **cannot** create/edit (admin/IO
  only per guards above).
- District scoping server-side. Audit on create/update/delete/export.

---

## 5. Evidence (`datathon/src/pages/Evidence/index.tsx`)

> Route-level exception: `/evidence` is allowed to **ADMIN, IO, INSPECTOR,
> FORENSIC, SCRB** (`FACE_OPS`-style set; SP and VIEWER excluded — unlike the
> rest of this section).

### 5.1 What's on the page

- Evidence item cards/table: title, evidence_type, status chip (tone map:
  **Analyzed / Pending / Assigned / Under Analysis / Assignment Rejected /
  Returned**), case link, chain-of-custody timeline, preview/download.
- Actions (role-gated): upload file, verify hash (SHA-256), transfer custody,
  assign to officer, accept/complete/return/assignee-reject, AI summary.
- Embedded `chatQueryStream` panel for evidence Q&A via markdown.

### 5.2 How it's done

- **Frontend** — `canWrite = isAdmin || isSCRB || isIO || isInspector`;
  `canUpload` also includes FORENSIC; buttons hidden/disabled otherwise.
- **Backend** — `routes/evidence.py` (`prefix="/evidence"`, router-level
  `ALL_ROLES`):

  | Endpoint | Guard |
  | -------- | ----- |
  | `POST ""` / `PUT/{id}` | ADMIN, INVESTIGATOR, INSPECTOR, CRIME_ANALYST |
  | `DELETE /{id}` | ADMIN |
  | `POST /{id}/upload` | ADMIN, INVESTIGATOR, FORENSIC, CRIME_ANALYST |
  | `POST /{id}/verify-hash` | ALL_ROLES |
  | `POST /{id}/custody/transfer` | ADMIN, INVESTIGATOR, INSPECTOR, FORENSIC |
  | `POST /{id}/assign` | ADMIN, INVESTIGATOR, INSPECTOR, CRIME_ANALYST |
  | `POST /{id}/assignments/{aid}/accept\|complete\|return\|reject` | ADMIN, INVESTIGATOR, FORENSIC, CRIME_ANALYST |
  | `POST /{id}/summary` | ADMIN, INVESTIGATOR, INSPECTOR, FORENSIC, CRIME_ANALYST |
  | `GET /{id}/preview` , `GET /{id}/download` | ALL_ROLES |

### 5.3 Current behaviour

- **FORENSIC** can upload, perform custody transfers, and complete/reject
  assignment workflows but **cannot** create evidence records standalone.
- **INSPECTOR** can create/assign/transfer; **SP** and **VIEWER** cannot reach
  the route at all (route-level).
- Previews/downloads are available to any authenticated user on the route set.
- Every mutation is audited (`audit_service`/`addLog`).

---

## 6. Cross-cutting notes

- Writes concentrate on ADMIN + IO (+ SCRB/INSPECTOR where noted); every delete
  is ADMIN-only except FIRs (ADMIN+INVESTIGATOR).
- Evidence is the only page here that widens to FORENSIC; it is the only page
  with rich per-action role matrices — keep `useRBAC` flags in sync with the
  backend guards listed above when editing.

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. Keep role tables in sync with
datathon/src/hooks/useRBAC.ts and backend/app/routes/{crime_cases,investigation,
investigation_hub,firs,evidence}.py. -->