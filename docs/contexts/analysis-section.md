# Saksha — ANALYSIS Section (`docs/contexts/analysis-section.md`)

> Runtime section label: **ANALYSIS** (sidebar `NavGroup label: 'ANALYSIS'`).
> Analytical engines over the crime data: geospatial hotspots, anomaly
> triage, forecast/predictive intelligence, the intelligence engine/fusion
> authoring tools, sociological correlations, and the command-level strategic
> briefing.

| Page (route)                          | Docs section |
| ------------------------------------- | ------------ |
| Hotspots — `/hotspots`                | §2 |
| Anomaly Detection — `/anomalies`      | §3 |
| Predictive AI — `/predictions`        | §4 |
| Intelligence Engine — `/intelligence-engine` | §5 |
| Intelligence Fusion — `/intelligence-fusion` | §6 |
| Sociological — `/sociological`        | §7 |
| Strategic — `/strategic`              | §8 |

---

## 1. Section overview

### 1.1 Route-level access (`useRBAC.ts`)

| Route | Allowed roles | Notes |
| ----- | ------------- | ----- |
| `/hotspots` | all 7 (`INSIGHT_ROLES`) | predict/current/versions API narrower |
| `/anomalies` | all 7 | detect API narrower |
| `/predictions` | all 7 | risk/forecast API narrower; retrain ADMIN |
| `/intelligence-engine` | ADMIN, SCRB, IO, INSPECTOR, **SP** | |
| `/intelligence-fusion` | all 7 | |
| `/sociological` | all 7 | |
| `/strategic` | all 7 | |

`PRIMARY_BY_ROLE` pins: SP → `hotspot`, `strategic`; INSPECTOR → `hotspot`;
SCRB → `anomaly`, `predictive`.

### 1.2 Backend conventions

- Prediction/hotspot/anomaly **engines** are read for all, but the *runnable*
  endpoints (`POST /ai/hotspot/predict*`, `POST /ai/anomaly/detect`,
  `POST /ai/predictions/risk-scores|forecast`) require
  **ADMIN, CRIME_ANALYST, INVESTIGATOR**; model *retrain* is ADMIN-only.
- Analytics are district-scoped (`app/auth/scope.py`) and TTL-cached; risk and
  anomaly scores are deterministic/rule-based (nothing fabricated — UI shows
  "Unavailable" for nulls).
- "Intelligence" outputs (unified-dossier builder) are stored in an
  intelligence-history table and are audited.

---

## 2. Crime Hotspot Map (`datathon/src/pages/Hotspots.tsx`)

### 2.1 What's on the page

- Header + view toggle **map · karnataka · matrix**:
  - `map` — `KarnatakaMap` vector hotspot map.
  - `karnataka` — `KarnatakaDistrictMap` (+ legend).
  - `matrix` — `SpatiotemporalHeatmap` driven by `timeOfDay` (`useMapStore`).
- Emerging-trend surge ticker (`activeAlertSurges`, up to 3 chips, pulsing),
  red-zone spike banner (`redZones`, `spike_ratio` chips up to 4), top hotspot
  telemetry cards (max 3 with Active/score chips).
- `PageSkeleton` + error/Retry.

### 2.2 How it's done

- API: `getHotspots`, `getStationsSummary`, `getDistrictComparison`,
  `getEmergingTrends`, `getRedZones`, `getSociologicalSocioeconomic`,
  `getRecentIncidents`, `getCrimeCases(district)`, `getRiskScores`; badges via
  `getIntelligenceStatus`; export GeoJSON via `downloadSecureDossier`
  (watermark `CONFIDENTIAL - <badgeId>`) + `addLog EXPORT`.
- District scope: `useUserScope` + `sessionStorage['selected_district_override']`
  (cleared); spike notifications deduped via
  `sessionStorage['spike_notifications_sent']`.
- Surge data may be `demo` source — `hotspotSource`/provenance shown honestly.

### 2.3 Role behaviour

| Role | Page | Predict/versions (backend) |
| ---- | :--: | :-------------------------: |
| ADMIN, SCRB, IO | ✅ | ✅ |
| SP, INSPECTOR, FORENSIC, VIEWER | ✅ | ❌ (engine endpoints 403; UI reads still fine) |

---

## 3. Anomaly Detection (`datathon/src/pages/Anomalies.tsx`)

### 3.1 What's on the page

"CRIMINAL INCIDENT DETECTED" triage workbench.

- Top HUD: search (FIR id/category/district), scope chip
  `Focus: {scopeDistrict} · {n} alerts` (district-bound), SEVERITY filter
  (`ALL|HIGH|WATCH`), INVESTIGATION filter (`ALL|PENDING|REVIEWED|ESCALATED`).
- Two columns: alert cards (left) + detail workbench (right) with status tag,
  geography cards (TOWN DISTRICT / POLICE BEAT TARGET), offence description,
  assigned-officer banner, actions; "Open Case File" and "Locate on Map"
  deep-links.

### 3.2 How it's done

- `fetchAnomalies`: maps `getAnomalies` → `CrimeAlert` (score×100, severity HIGH
  if ≥0.8 else WATCH, status 'PENDING'), district-filtered client-side.
- `reviewAlert` → REVIEWED + assigned officer; `escalateAlert` → `createNotification`
  (type `escalation`, `is_broadcast: true`) → ESCALATED/HIGH.
- Deep-link: `sessionStorage['selected_entity_id']` + dispatch
  `navigate-tab` → `crime_cases`; `selected_district_override` + dispatch →
  `hotspot`.

### 3.3 Role behaviour

All 7 roles can triage; `detect` (re-run) endpoint requires
ADMIN/SCRB/IO (other roles rely on the rule-generated feed read via
`getAnomalies` which is dashboard-level `ALL_ROLES`).

## 4. Predictive Crime AI (`datathon/src/pages/Predictions.tsx`)

### 4.1 What's on the page

"AI Crime Predictive Intelligence".

- `ForecastChart` + `CorrelationChart` (legend shows **computed r**, not a
  hardcoded value) + `WeatherCorrelationChart` (seasonal).
- Seasonal breakdown cards (`SEASON_COLORS`/`SEASON_ICONS`), Emerging Crime
  Typologies grid (`TREND_META`), Strategic Threat Assessments (top 2 risk rows +
  top 2 anomalies with `getConfidenceLabel`/LOW_CONFIDENCE badges, "Your district"
  chip when district-bound), Predictive Model Metrics (algorithm, RMSE,
  verification dataset, last epoch).
- **Retrain Model Net** button — **ADMIN only**.

### 4.2 How it's done / role behaviour

- API: `getRiskScores`, `getAnomalies`, `getModelInfo`, `getSeasonBreakdown`,
  `getEmergingTrends`, `trainRiskModels`; `Promise.allSettled` load with
  per-section `sectionsLoaded`, redundant section-level refetches.
- Backend `routes/ai_risk.py` (`/ai/predictions`): risk-scores/forecast POST =
  ADMIN/CRIME_ANALYST/INVESTIGATOR; `POST /train` = ADMIN.

| Role | Page | Retrain | Risk/forecast API |
| ---- | :--: | :-----: | :---------------: |
| ADMIN | ✅ | ✅ | ✅ |
| SCRB, IO | ✅ | ❌ | ✅ |
| SP, INSPECTOR, FORENSIC, VIEWER | ✅ | ❌ | ❌ (403 on those sections — UI shows per-section error) |

---

## 5. Intelligence Engine (`datathon/src/pages/InvestigationIntelligence/index.tsx`)

### 5.1 What's on the page

"START FROM ANY FIR, CASE, CRIMINAL OR VICTIM — BUILD A UNIFIED INTELLIGENCE
REPORT".

- Debounced search + filter pills (All/FIR/Case/Criminal/Victim).
- Idle landing: capabilities panel + **user history** panel (entity avatar
  letters, connections/leads/timeline_events counts, per-row delete).
- Detail view: **`IntelligenceWorkspace`** (entityType, entityId, entityLabel)
  building CONNECTIONS → COMMON THREADS → CRIME DNA → LEADS → TIMELINE → NETWORK
  → PATTERN BREAKS.

### 5.2 How it's done / role behaviour

- Route allows ADMIN, SCRB, IO, INSPECTOR, **SP**.
- API: `searchIntelligenceEntities(term,type)`, `getIntelligenceHistory(30)`,
  `deleteIntelligenceHistory(runId)`; history polled silently every 30 s
  (`usePolling`), deduped by `entity_type:entity_id`, keeps newest 20.
- Listens for `navigate-tab` (`tab==='investigation_intelligence'`, targetId +
  targetType).
- Backend `routes/intelligence.py` (`/intelligence`): default `ALL_ROLES`; the
  unified-dossier authoring endpoints at `routes/intelligence.py:472` require
  ADMIN, INVESTIGATOR, INSPECTOR, POLICYMAKER.

No in-page role gating; history delete not role-gated.

---

## 6. Intelligence Fusion (`datathon/src/pages/IntelligenceFusion/index.tsx`)

### 6.1 What's on the page

"Fuse live analytics into plain-language crime insights for field officers".

- Filter bar: district selector (**read-only scope chip** when district-bound),
  category (`getCrimeCategories` w/ fallback), time window `TIME_WINDOWS =
  [7,14,30,60,90]`, sensitivity segmented (broad/balanced/strict →
  `min_signals`/`min_risk`/`min_confidence`).
- KPI strip (Emerging Patterns, Do Now, High Priority, Indicators, Districts,
  Avg Confidence), `IntelligencePatternsFeed` (8-col), right rail: Recent Fusion
  Runs (delete per run), "How This Portal Works" explainer with `ML_MODES`,
  Action Pipeline (`PRIORITY_STYLES`), `IntelligenceInvestigationDrawer`.

### 6.2 How it's done / role behaviour

- API: `getEmergingPatterns(params)`, `runIntelligenceFusion`, history list/delete.
- Lazy state caches to `sessionStorage` keys `saksha_fusion_*`. Filter changes
  persist + reload; `runFusion` replaces patterns/caches/reloads runs.
- Route = all 7 roles; no in-page gating (buttons disabled only while loading).

---

## 7. Sociological Intelligence (`datathon/src/pages/Sociological/index.tsx`)

### 7.1 What's on the page

Six-tab analysis: **Overview** (SummaryCards, Urban/Rural Pie, Night/Day gauge,
AI insights, literacy/income correlation cards) · **Demographics** (victim age
Bar + gender Pie) · **Geographic** (population-density Scatter + district crime
density ranking table) · **Socio-Economic** (district overlay table + expandable
insights) · **Temporal** (hourly Area, day-of-week Bar, monthly Line, night/
weekend tiles) · **Offender Profile** (age Bar, status Pie, gender Bar).

### 7.2 How it's done / role behaviour

- API: `getSociologicalDemographics/UrbanRural/Socioeconomic/
  PopulationCorrelation/Temporal/OffenderDemographics`; six independent states,
  `Promise.allSettled`, error only when all primary datasets empty.
- Backend `routes/sociological.py`: `ALL_ROLES`. Route = all 7 roles; no gating.

---

## 8. Strategic Intelligence Command (`datathon/src/pages/Strategic/index.tsx`)

### 8.1 What's on the page

Command-level briefing. Daily summary banner (Today's/Yesterday's crimes, FIRs
filed, Open cases, At Large) + section tabs: **Command Overview** (10 KPICard
tiles, top categories Bar, monthly trend Line) · **Risk Districts** (cards w/
`risk_level` coding + factors bullets) · **Emerging Trends** ("Live Surge
Telemetry" badge, Red-Zone chips, % change, "Locate on Map") · **Deployment**
(Resource Allocation by District Bar + Recommended Actions) · **Interventions**
(`InterventionsPanel`) · **Top Networks** (most-active offenders + recent FIRs).

### 8.2 How it's done / role behaviour

- API: `getStrategicBriefing`, `getDailySummary`, `getResourceAllocation`,
  `getStrategicEmergingTrends` (alias of `getEmergingTrends`).
- Backend `routes/strategic.py` (`ALL_ROLES`) + `routes/interventions.py`
  (interventions create/update = ADMIN, INVESTIGATOR, INSPECTOR, POLICYMAKER).
- Route = all 7 roles; no in-page gating; "Locate on Map" dispatches
  `navigate-tab` → `hotspot`.
- Honest rendering: risk scores reflect rule-based outputs only.

---

## 9. Cross-cutting notes

- Engines are inspectable by every role; *running* a model/job is
  ADMIN/CRIME_ANALYST/INVESTIGATOR on the backend even where the UI page is open
  to everyone — expect per-section 403s for SP/INSPECTOR/FORENSIC/VIEWER on the
  runnable endpoints and keep the UI's per-section error handling.
- Retrain actions (hotspot, risk, criminal) are ADMIN-only backend; the frontend
  mirrors this with `isAdmin` gates on the buttons (Predictions).
- All analytical numbers are deterministic/rule-based or labelless "Unavailable";
  no fabricated forecasts, correlation r-values, or risk scores are rendered.

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. -->