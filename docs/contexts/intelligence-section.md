# Saksha — INTELLIGENCE Section (`docs/contexts/intelligence-section.md`)

> Runtime section label: **INTELLIGENCE** (sidebar `NavGroup label:
> 'INTELLIGENCE'`). Discovery surface: cross-entity search (Command Center),
> criminal network graph, identity resolution, data ingestion, knowledge graph,
> alert-findings review, and the registries (criminals, victims, offenders).

| Page (route)                   | Docs section |
| ------------------------------ | ------------ |
| Command Center — `/command-center` | §2 |
| Criminal Network — `/network` | §3 |
| Identity Resolution — `/identity-resolution` | §4 |
| Universal Data Ingestion — `/ingestion` | §5 |
| Knowledge Graph — `/intelligence-graph` | §6 |
| Alert Findings — `/alerts-review` | §7 |
| Criminals — `/criminals` | §8 |
| Victims — `/victims` | §9 |
| Offenders — `/offenders` | §10 |

---

## 1. Section overview

### 1.1 Route-level access (`useRBAC.ts`)

| Route | Allowed roles | Notes |
| ----- | ------------- | ----- |
| `/command-center` | all 7 (`INSIGHT_ROLES`) | read-only discovery |
| `/network` | all 7 | read-only graph + export |
| `/identity-resolution` | ADMIN, SCRB, IO, INSPECTOR | reviews = same set |
| `/ingestion` | ADMIN, SCRB, IO, INSPECTOR | source-admin narrower |
| `/intelligence-graph` | ADMIN, SCRB, IO, INSPECTOR, **SP** | rebuild narrower |
| `/alerts-review` | ADMIN, SCRB, IO, INSPECTOR | generate narrower |
| `/criminals` | ADMIN, SCRB, IO, INSPECTOR | writes = ADMIN/IO |
| `/victims` | all 7 | writes = ADMIN/IO |
| `/offenders` | all 7 | read-only + export |

`PRIMARY_BY_ROLE` pins: SCRB → `command_center`, `network`; VIEWER →
`command_center`.

### 1.2 Backend conventions

- Registries (`criminals.py`, `victims.py`) are router-level `ALL_ROLES` for
  reads; specific writes ADMIN/INVESTIGATOR.
- Identity/alert-findings/KG "review" sets mirror backend `REVIEW_ROLES` /
  dedicated `REBUILD_ROLES`.
- Never auto-confirm identities or auto-accuse: all identity/proxy/alert findings
  are proposed leads requiring human review (see §4, §7).
- District scoping enforced end-to-end via `app/auth/scope.py`; network graph,
  KG, offenders, and intelligence reads are district-filtered server-side.

---

## 2. Command Center (`datathon/src/pages/CommandCenter.tsx`)

### 2.1 What's on the page

- **Home view** — hero investigation search card, "Investigation Command Center"
  badge + `{role} clearance` chip, `SectionHeader` "OPERATOR CONTEXT / What can we
  investigate, {firstName}?", 6 **quick-action cards** (Search Person, Search
  FIR/Case, Upload Image, Find Similar Cases, Search MO, Search Location —
  filtered by `useRBAC().checkPermission`), KPI row (`Metric`: Critical Alerts,
  Unread, Saved, Recent), Recent/Saved Investigations (`useInvestigationPersistence`),
  Important Alerts (`NotificationRecord` + `sevChip`), Recent Cases
  (`RecentIncident`).
- **Search view** — grouped results `GROUPS = persons / victims / cases / firs /
  stations / locations / mo_matches` with `PersonAvatar`, status chips, bookmark
  save, provenance `SignalTag` (LIVE/DEMO).
- **Search aids** — `NlModal` (natural-language/voice, incl. Kannada `kn-IN`
  via `webkitSpeechRecognition`, example chips, low-confidence warning) and
  `ImageModal` (`searchInvestigationImage`).

### 2.2 How it's done

- `searchInvestigation(term, 15)`, `interpretInvestigationQuery`,
  `searchInvestigationImage`, `getRecentNotifications(6)`,
  `getNotificationDashboard`, `getRecentIncidents` (all `api.ts` wrappers; no
  direct `apiRequest`).
- 300 ms debounce; `Promise.allSettled` home load; manual refresh bumps
  `retryKey`. Cross-tab routing: `openItem → goTo(tab,targetId) →
  dispatchEvent('navigate-tab')`; `isUuid()` guards `resource_id` before use.
  Target mapping: person→criminals, victim→victims, case/fir→crime_cases,
  mo→criminals/crime_cases, location/station→districts.
- Audit `PAGE_VIEW` on route open.

### 2.3 Role behaviour

| Role | Page | Read/search | Notes |
| ---- | :--: | :---------: | ----- |
| any of 7 roles | ✅ | ✅ | Quick-action buttons respect `checkPermission` per target route |

No in-page write gating; saves are per-operator preferences.

---

## 3. Criminal Network Analytics (`datathon/src/pages/Network/index.tsx` + `hooks/useNetwork.ts`)

### 3.1 What's on the page

"Graph-Based Criminal Intelligence & Relationship Analysis — NEO4J CYPHER •
THREE.JS FORCE DIRECTED NETWORK • CONNECTION PATH • GANG SYNDICATES • LINK
CENTRALITY".

- View selector (`useNetwork`): **3d_explorer · shortest_path · path_finder ·
  gangs · link_analysis · timeline · ai_insights**.
  - `3d_explorer` — `CriminalGraph3D` (force-directed), `NodeDetailPanel` /
    `EdgeDetailPanel`, focus-mode (`computeFocusSubgraph`), path highlight
    (`buildNetworkPathHighlight`).
  - `shortest_path` — `ShortestPathPanel` (`calculateShortestPath`).
  - `path_finder` — `PathFinderPanel` (`findNetworkPath(src,tgt,hops)`).
  - `gangs` — `GangNetworkView` (`getGangNetworks`).
  - `link_analysis` — `LinkAnalysisPanel` (`getLinkAnalysis`).
  - `timeline` — `NetworkTimelineSlider` + date-override notice.
  - `ai_insights` — `AIGraphInsightsModal` (`getAIGraphInsights`).
- Filters: `NetworkFilterPanel` (category, min risk, multi-param server-side
  filters) + `NetworkTimelineSlider` date range (default `2025-01-01..2026-12-31`);
  `hasActiveNetworkFilters` empty-state "Clear Filters".
- Export: **"Criminal Link Association Matrix"** JSON via `downloadSecureDossier`
  (watermark `CONFIDENTIAL - <badgeId>`) + `addLog EXPORT`.
- Demo-seed transparency banner when `seedNodeCount > 0`.

### 3.2 How it's done

- `useNetwork` hook centralises state; mount loads graph, gangs, link analysis,
  AI insights; filter changes invalidate connection path/source/target.
- API: `getFullNetworkGraph(cat,minRisk,·,·,filters)`, `getGangNetworks`,
  `calculateShortestPath`, `findNetworkPath`, `getLinkAnalysis`,
  `getAIGraphInsights`, `triggerNeo4jSync` (displays "Analyzing"/sync states).
- Backend `routes/network.py` router-level `ALL_ROLES`; district scoping +
  honest nulls (no fabricated `risk_score`).

### 3.3 Role behaviour

All 7 roles read + export; no in-page write gating.

---

## 4. Identity Resolution & Data Integrity (`datathon/src/pages/IdentityResolution/index.tsx`)

### 4.1 What's on the page

- Policy banner: "**never auto-confirms identity, never auto-accuses — all
  findings require human review.**"
- Header: "Run Full Scan" (`runIdentityResolution`) / "Proxy Only"
  (`runProxyDetection`), gated by `canReview`.
- 6 KPI StatCards (Records Scanned, Possible Duplicates, Proxy Leads, Identifier
  Reuse, Critical Reviews, Open Reviews) + "Requires Review" banner.
- Tabs: **review** (Review Center, status filter Pending/Resolved/All,
  collapsible association pairs) · **proxy** (Proxy Patterns, severity/rule badges,
  "Possible innocent cause", decision buttons) · **alerts** (Integrity Alerts +
  confirm/dismiss/investigate) · **graph** (Identity Graph, 2-col node cards with
  confidence edges) · **search** (Person Search grouped Exact/Probable/Possible).
- `ASSESSMENT_META`: PROBABLE_IDENTITY_MATCH, POSSIBLE_IDENTITY_MATCH,
  POSSIBLE_ASSOCIATED, POSSIBLE_PROXY.

### 4.2 How it's done / role behaviour

- `canReview = isAdmin || isSCRB || isIO || isInspector` (== INVESTIGATION_ROLES).
  Review buttons rendered only for them; table rows read-only otherwise.
- API: `getIdentityDashboard`, `listIdentityRelationships/Alerts/ProxyPatterns`,
  `getIdentityGraph`, `runIdentityResolution/ProxyDetection`,
  `reviewIdentityRelationship(id,decision,note)`, `reviewProxyPattern`,
  `reviewIdentityAlert`, `searchIdentity` — `fetchAll()` with per-call fallbacks.
- Backend `routes/identity.py`: reads `ALL_ROLES`, reviews `REVIEW_ROLES`
  (admin, crime_analyst, investigator, inspector).
- Every decision is recorded (audit trail) — leads are proposals only.

| Role | Page | Review actions |
| ---- | :--: | :------------: |
| ADMIN, SCRB, IO, INSPECTOR | ✅ | ✅ |
| SP, FORENSIC, VIEWER | ❌ (route) | — |

---

## 5. Universal Data Ingestion (`datathon/src/pages/DataIngestion.tsx`)

### 5.1 What's on the page

- Status cards (`statusCards`): Total Jobs, Stored, Ready for AI, Needs Review,
  Failed.
- **Ingest Artifact** card — file picker + Source select (+ auto-tag) + origin +
  "Upload & Validate" (`uploadArtifact`).
- **Register Data Source** card — name, kind (`getIngestionKinds`, fallback
  DOCUMENT/CSV/JSON/MANUAL), description, "Register Source" (`createDataSource`,
  default `srcType='MANUAL'`).
- **Validation Jobs** table — Job, Kind (`artifact_kind`), Records
  (`record_count`), AI (`ai_job_spawned` ? 'queued' : 'n/a'), Status chip
  `JOB_META` tones: received/validating/normalizing/stored/completed/failed.

### 5.2 How it's done / role behaviour

- Router-level route = INVESTIGATION_ROLES; **source writes** backend
  (`routes/ingestion.py`) are `_SOURCE_ADMIN_ROLES = ADMIN, CRIME_ANALYST,
  INVESTIGATOR` (register source, edit source, delete source, retry job).
- Mount `fetchAll()` (4 endpoints in parallel); create/upload → `addLog` (CREATE/
  UPLOAD) → refresh. No polling.

| Role | Page | Register source / retry | Upload |
| ---- | :--: | :----------------------: | :----: |
| ADMIN | ✅ | ✅ | ✅ |
| SCRB, IO | ✅ | ✅ | ✅ |
| INSPECTOR | ✅ | ❌ (backend) | ✅ (UI present) |
| SP, FORENSIC, VIEWER | ❌ | — | — |

---

## 6. Knowledge Graph (`datathon/src/pages/KnowledgeGraph.tsx`)

### 6.1 What's on the page

"Cross-Case Intelligence Graph — Phase 3 · entity relationships mined from FIRs,
cases and victims".

- Rebuild Graph (`canWrite`) + Refresh buttons, error banner.
- 4 stat cards: Nodes / Edges / Node Types / Directions.
- Search & explore: `searchKGNodes(query, 25)` → `NODE_TONES` chips (PERSON, FIR,
  CRIME_CASE, VICTIM, LOCATION) with districts; click opens 2-hop fragment
  (`getKGFragment(nodeId, 2)`) with nodes + edges tables (Relationship/
  Direction/Strength %/Basis).

### 6.2 How it's done / role behaviour

- Route: ADMIN, SCRB, IO, INSPECTOR, **SP** (UI accessibility for SP).
- `canWrite = ADMIN || SCRB` (`useAuthStore`); Rebuild button only for them.
- Backend `routes/knowledge_graph.py`:
  `REBUILD_ROLES = ADMIN, CRIME_ANALYST`; `REVIEW_ROLES = ADMIN, CRIME_ANALYST,
  INVESTIGATOR, INSPECTOR`.
- Rebuild is audited (`addLog CREATE` with node/edge counts).

| Role | Page | Rebuild |
| ---- | :--: | :-----: |
| ADMIN, SCRB | ✅ | ✅ |
| IO, INSPECTOR, SP | ✅ | ❌ (backend) |
| FORENSIC, VIEWER | ❌ | — |

---

## 7. Alert Findings Review (`datathon/src/pages/AlertReview.tsx`)

### 7.1 What's on the page

- Header: **Run Rules** (`canGenerate`) + Refresh.
- Filters: status pills `FILTERS` (All/Open/In Review/Reviewed/Dismissed) +
  type (`Crime spike` / `Repeat offender`).
- Finding cards: severity chip (`SEVERITY_TONES` critical/high/medium/low/
  informational), `finding_type`, district, category, status chip (`STATUS_TONES`
  open/in_review/reviewed/dismissed), explanation, 4-stat grid (Current / Baseline
  / Ratio `spike_ratio×` / Confidence); when `open` and `canReview`:
  **Dismiss / Send to Investigation / Confirm Finding**.
- Counter "N finding(s) · N open".

### 7.2 How it's done / role behaviour

- `canReview = ADMIN|SCRB|IO|INSPECTOR`; `canGenerate = ADMIN|SCRB`
  (`useAuthStore`).
- API: `getAlertFindings({status, finding_type, limit:100})`,
  `regenerateAlertFindings()`, `reviewAlertFinding(id, decision, reviewNote)`.
- Backend `routes/alert_findings.py`: prefix `/alerts/findings`; generate =
  ADMIN, CRIME_ANALYST; review = REVIEW_ROLES; list = ALL_ROLES.
- Audit: `addLog REVIEW` per decision, `CREATE` on regenerate; dedup via
  `grouping_key` in `alert_finding_service`.

---

## 8. Criminals (`datathon/src/pages/Criminals/index.tsx`)

### 8.1 What's on the page

- Left registry list (search + status filter ALL/SEARCHING-WANTED/ARRESTED/ON
  BAIL/UNDER TRIAL/CONVICTED/ACQUITTED/DECEASED).
- Dossier (right): identity banner + photo upload, alias, **Build Intelligence**
  (`IntelligenceWorkspace`), **Ask AI** (dispatches `open-ai-assistant`), status
  selector, Edit Profile / Save / Cancel (inline fields: birth date, gender,
  identifying marks), MO summary + residence cards, **AI Risk Profile Scorer**
  (radial gauge), **Recidivism indexer** (probability bar), **Behaviourally similar
  offenders** (match %), FIR-linked case history table, and an inline radial
  **Associate & Scene Network Diagram** (`renderRelationshipGraph`).

### 8.2 How it's done / role behaviour

- `canWrite = isAdmin || isIO` gates photo upload, status selector, Edit Profile.
- API: `listCriminals`, `getCriminal`, `updateCriminal`, `uploadCriminalImage`.
  Backend writes: ADMIN, INVESTIGATOR only.
- `sessionStorage['selected_entity_id']` consumed/removed (deep-link) ,
  `return_to_case_id`/`return_to_case_number` for "Back to Investigation",
  `usePolling` 30 s list refresh, `addLog` REVIEW/UPDATE.

| Role | Page | Write |
| ---- | :--: | :---: |
| ADMIN | ✅ | ✅ |
| IO | ✅ | ✅ |
| SCRB, INSPECTOR | ✅ | ❌ |
| SP, FORENSIC, VIEWER | ❌ | — |

---

## 9. Victims (`datathon/src/pages/Victims/index.tsx`)

### 9.1 What's on the page

- Header toggle **"Victimology Analytics" ⇄ "Back to Dossiers"** (swaps to
  `VictimologyPanel`).
- Dossier: identity banner, AGE/Gender/Contact, residence, official statement,
  linked-FIR table (status + View→fir), radial **Associate & Scene Network
  Diagram** (click criminal→criminals tab, victim→in-page select).
- **Edit Dossier modal** (Full Name, Age, Gender, Contact, Residence, Statement,
  Photo URL) — gated.

### 9.2 How it's done / role behaviour

- `canEditVictim = user?.role === 'ADMIN' || 'IO'` (`useAuthStore`).
- API: `listVictims`, `getVictim`, `updateVictim`. Backend writes: ADMIN,
  INVESTIGATOR (`routes/victims.py`); `routes/victimology.py` read-only
  `ALL_ROLES`.
- Same `selected_entity_id` deep-link + `usePolling` + `addLog` REVIEW/UPDATE.

| Role | Page | Edit dossier |
| ---- | :--: | :----------: |
| any of 7 | ✅ | only ADMIN, IO |

---

## 10. Offenders (`datathon/src/pages/Offenders.tsx`)

### 10.1 What's on the page

"Registry & System Security Logs — LAW ENFORCEMENT BIO-REGISTRY • BACKEND
DOSSIERS & CLASSIFIED WATERMARK EXPORTS".

- Dossier browser (alias search); active dossier: classification badge,
  threat/risk %, operational state, primary pattern/gang affiliation, key
  sectors/active districts, mugshot description; **watermark selector** (3
  options incl. `CONFIDENTIAL - BADGE: <badgeId>`) + `ExportMenu`
  (pdf/docx/txt/csv/xlsx).
- Right rail: live **Session Activity Log** from `useAuditStore` (per-type
  colours: EXPORT red / AUTH emerald / REVIEW sky / ESCALATION purple), "Clear
  Screen".

### 10.2 How it's done / role behaviour

- `getOffenderDossiers` only (fetch-on-mount); export →
  `addLog('EXPORT',…)` + `downloadSecureDossier('Offender Dossier - …', …)`.
- Read-only for all 7 roles; no in-page gating. Backend `analytics_service`
  (`offender_dossiers`) is district-scoped.

---

## 11. Cross-cutting notes

- Registries (Criminals/Victims) are the only pages here with object-level
  writes — narrow to ADMIN/IO on both sides (frontend flag + backend guard).
- Alert/identity/KG "review" decisions always require a human; UI wording and
  audit entries enforce the "proposed lead" model.
- Exports (Network matrix, Offender dossiers) are watermark-badged and audited.
- Deep-links: Command Center originates `navigate-tab`; Criminals/Victims consume
  `selected_entity_id`; Criminals also emits `open-ai-assistant`.

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. -->