# Dashboard Module LLD

**Project:** SAKSHA — AI-Powered Crime Intelligence Platform  
**Component:** Investigation Overview & Command Center Telemetry  
**Inspection Date:** September 2026  
**Status:** Implementation Blueprint (Based on Actual Codebase Inspection)

---

## 1. Module Overview

| Item | Details |
|---|---|
| **Purpose** | Aggregates, visualizes, and coordinates multi-domain investigation intelligence into high-level telemetry, workload metrics, spatio-temporal trends, and triage launchpads. |
| **Responsibilities** | 1. Aggregate and render high-level crime KPIs (Total Cases, Active/Open Cases, Total FIRs, Registered Criminals, Resolution Rate).<br>2. Filter analytics by District (30 Karnataka districts), Crime Category, Assigned Officer, Priority, Status, and Date Range.<br>3. Plot temporal trajectories (`TrendChart`) and categorical distributions (`DonutChart`).<br>4. Provide federated quick-launch search (`CommandCenter`) across Persons, Victims, Cases, FIRs, Stations, and MO patterns.<br>5. Display live operational feeds: recent case incidents, active anomalies, and triage notifications.<br>6. Expose operational status indicators: Backend connection, Realtime SSE bus state, and Data Mode (`production`/`demo`).<br>7. Prevent database query thrashing using server-side in-memory TTL caching (`ttl_cached`). |
| **Inputs** | Filter parameters (dates, district, category, officer, status, priority), real-time SSE event payloads (`case_created`), full-text natural language search strings. |
| **Outputs** | Rendered KPI cards (`StatCard`), Recharts visual graphs, district comparison heatmaps, incident activity tables, command palette search results, exported PDF/CSV dossiers. |
| **Dependencies** | FastAPI, SQLAlchemy 2.0, `ttl_cache.py`, Recharts, Lucide Icons, Zustand (`appStore`, `authStore`, `auditStore`, `realtimeStore`), Tailwind CSS. |

---

## 2. Scope

### Include
* **Analytics Dashboard (`Overview.tsx`):** KPI summary cards, crime trend charts, category breakdown donut charts, district distribution heatmaps, officer workload cards, evidence status pipeline, recent incident feeds, predictive outlook cards, and PDF/CSV dossier exporting.
* **Investigation Command Center (`CommandCenter.tsx`):** Unified multi-entity search, natural language interpretation query bar, face/image search launcher, critical alert triage counters, and direct entity routing.
* **Backend Aggregation API (`routes/dashboard.py`):** Dedicated endpoints for summary metrics, monthly trends, category distributions, district comparisons, officer stats, evidence stats, recent incidents, and risk projections.
* **Query Caching Layer (`services/ttl_cache.py`):** In-memory time-to-live caching (45s–120s) to guard PostgreSQL against high-frequency UI polling.
* **Realtime Invalidation & Streaming:** Optimistic UI state updates on incoming Server-Sent Events (`case_created`).

### Exclude
* Authoritative CRUD management for cases, FIRs, evidence, and dossiers (handled by **Crime Cases**, **FIR**, **Evidence**, and **Criminals** modules).
* Native spatial clustering computations (Getis-Ord $G_i^*$, Moran's $I$, KDE) — consumed via **Hotspot Module** APIs (`/ai/hotspots`).
* Deep knowledge graph pathfinding — handled by **Network Module**.
* Direct LLM multi-turn chat dialogues — handled by **AI Copilot Module** (`AIChat.tsx`).

### Future Scope
* Personalized investigator widget customization (drag-and-drop grid layout saving to user profile).
* Real-time automated alert threshold configuration from the dashboard UI.
* Dynamic comparison overlays between historical year-over-year multi-district policing data.

---

## 3. Existing Implementation

| Component | File / Location | Status | Description |
|---|---|---|---|
| **Analytics Dashboard Page** | `datathon/src/pages/Overview.tsx` | Implemented | 50.5KB core dashboard page: multi-filter bar, KPI counters, trend charts, category donut, incident stream, polling, SSE integration. |
| **Command Center Page** | `datathon/src/pages/CommandCenter.tsx` | Implemented | 36KB unified investigation hub: federated search, NL query parser, image search, notification triage, recent search persistence. |
| **KPI Stat Card** | `datathon/src/components/dashboard/StatCard.tsx` | Implemented | Reusable animated KPI card with trend indicator icons (`TrendingUp`, `TrendingDown`), custom glow accents, and optional click routing. |
| **Animated KPI Counter** | `datathon/src/components/dashboard/KPICounter.tsx` | Implemented | Smooth numeric counter animation hook using `requestAnimationFrame`. |
| **Crime Trend Area Chart** | `datathon/src/components/charts/TrendChart.tsx` | Implemented | Recharts area chart rendering monthly total vs solved case trajectories with gradient fills and theme-aware tooltips. |
| **Category Donut Chart** | `datathon/src/components/charts/DonutChart.tsx` | Implemented | Recharts interactive pie/donut chart with inner totals, color legends, and category click filtering. |
| **Spatiotemporal Heatmap** | `datathon/src/components/dashboard/SpatiotemporalHeatmap.tsx` | Implemented | Day-of-week × Hour-of-day incident matrix with intensity grading and fallback Karnataka baseline telemetry. |
| **Active Alerts Bar Chart** | `datathon/src/components/dashboard/ActiveAlerts3D.tsx` | Implemented | Visual threat scoring bar chart combining police station threat scores and anomaly feed records. |
| **Sector Threat Index** | `datathon/src/components/dashboard/SpatialCube3D.tsx` | Implemented | Sector-wise crime density bar chart displaying beat sector threat indices and dominant crime types. |
| **Forecast Chart** | `datathon/src/components/charts/ForecastChart.tsx` | Implemented | 14-day projection area chart (currently labeled with "Demo Data" badge for illustrative outlook). |
| **Top Navigation Header** | `datathon/src/components/layout/Header.tsx` | Implemented | System clock, theme toggle, data mode indicator badge, notification bell counter, user profile popover. |
| **Global Navigation Sidebar** | `datathon/src/components/layout/Sidebar.tsx` | Implemented | Collapsible sidebar with RBAC permission filtering across Command, Investigations, Analytics, and Registry groups. |
| **Role Guard Component** | `datathon/src/components/layout/RoleGuard.tsx` | Implemented | Route-level permission wrapper rendering glowing locked state and clearance errors when access is denied. |
| **Background Polling Hook** | `datathon/src/hooks/usePolling.ts` | Implemented | Runs silent background data refreshes with automatic pausing when browser tab is hidden (`visibilitychange`). |
| **Investigation Persistence** | `datathon/src/hooks/useInvestigationPersistence.ts` | Implemented | Manages local storage persistence for recent searches and saved case dossiers. |
| **Dashboard Backend Router** | `backend/app/routes/dashboard.py` | Implemented | 10 FastAPI endpoints serving cached aggregation payloads with multi-attribute filtering. |
| **Dashboard Service Engine** | `backend/app/services/dashboard/dashboard_service.py` | Implemented | 393-line query aggregation engine performing SQLAlchemy joins, filter clauses, and statistical summaries. |
| **In-Memory TTL Cache** | `backend/app/services/ttl_cache.py` | Implemented | Thread-safe in-memory cache decorator preventing repeated DB hits during concurrent dashboard polling. |

---

## 4. Architecture / Components

### CURRENT Architecture

```text
[Browser: Datathon React Client]
  │
  ├─► Overview.tsx (Analytics Dashboard at /dashboard)
  │    │
  │    ├─► usePolling (30s background cycle)
  │    ├─► useRealtimeStore (SSE on /realtime/stream -> 'case_created')
  │    └─► UI Widgets:
  │         ├─ StatCard (KPI metrics with animated KPICounter)
  │         ├─ TrendChart (Recharts AreaChart: total vs solved)
  │         ├─ DonutChart (Recharts PieChart: category distribution)
  │         ├─ SpatiotemporalHeatmap (Day-of-Week × Time matrix)
  │         ├─ SpatialCube3D / ActiveAlerts3D (Threat score bars)
  │         └─ ForecastChart (Illustrative 14-day trend)
  │
  └─► CommandCenter.tsx (Investigation Launchpad at /command-center)
       ├─► searchInvestigation() -> /investigation/search
       ├─► interpretInvestigationQuery() -> /investigation/interpret
       ├─► getNotificationDashboard() -> /notifications/dashboard
       └─► getRecentIncidents() -> /dashboard/recent-incidents
  │
  ▼ (HTTP REST via apiRequest with Bearer Token)
+────────────────────────────────────────────────────────────────────────+
| FastAPI Gateway & Security Layer                                       |
| - Depends(require_roles(*ALL_ROLES))                                   |
| - Depends(get_current_user)                                            |
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| Dashboard Router (app/routes/dashboard.py)                             |
| - ttl_cached(key, filter_hash, ttl_seconds)                            |
|   * Filtered endpoints: TTL 45s                                        |
|   * Static/General endpoints: TTL 60s                                  |
|   * Predictive/ML endpoints: TTL 120s                                  |
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| Dashboard Service Engine (app/services/dashboard/dashboard_service.py) |
| - _apply_case_filters(): dynamic filtering on CrimeCase & Location     |
| - SQLAlchemy aggregation queries: func.count, joinedload, group_by    |
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| Primary Database: PostgreSQL 16 (Supabase) / Fallback SQLite           |
| Tables: crime_cases, firs, criminals, locations, crime_categories, etc.|
+────────────────────────────────────────────────────────────────────────+
```

### TARGET / REQUIRED Architecture

```text
[Browser: Datathon React Client]
  │
  ├─► Overview.tsx & CommandCenter.tsx
  │    ├─ Live Predictive Model Integration: Bind ForecastChart directly to
  │    │  /dashboard/forecast (currently displays static demo series).
  │    ├─ Investigator Role Customization: Save preferred default filters
  │    │  (e.g., district, assigned officer) into user preferences.
  │    └─ Realtime SSE Bus: Instant delta counters on case status updates.
  │
  ▼ (HTTP REST)
+────────────────────────────────────────────────────────────────────────+
| FastAPI Gateway + TTL In-Memory Cache Layer                            |
| - Immediate targeted invalidation on write events (`case_created`,     |
|   `case_updated`, `evidence_uploaded`) via ttl_cache prefix eviction.  |
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| Dashboard Service Engine                                               |
| - Asynchronous query batching using SQLAlchemy 2.0 select() constructs.|
| - Database-level Materialized Views for large-scale multi-year rollups.|
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| PostgreSQL Database (Supabase)                                         |
+────────────────────────────────────────────────────────────────────────+
```

---

## 5. Components / Classes / Services

### Frontend Components

| Component | File Path | Props / State | Data Source |
|---|---|---|---|
| `Overview` | `datathon/src/pages/Overview.tsx` | State: `summary`, `trends`, `categories`, `selectedDistrict`, `selectedCategory`, `selectedOfficer`, `selectedPriority`, `selectedStatus`, `startDate`, `endDate`, `loading`, `error`. | Calls `getDashboardSummary`, `getCrimeTrends`, `getCategoryBreakdown`, `getOfficerStats`, `getEvidenceStats`, `getRecentIncidents`, `getForecast`, `getRiskPrediction`. |
| `CommandCenter` | `datathon/src/pages/CommandCenter.tsx` | State: `view` ('home'\|'search'), `query`, `results`, `searching`, `alerts`, `notifDash`, `incidents`. | Calls `searchInvestigation`, `interpretInvestigationQuery`, `getNotificationDashboard`, `getRecentIncidents`. |
| `StatCard` | `datathon/src/components/dashboard/StatCard.tsx` | Props: `title`, `value`, `prefix`, `suffix`, `icon`, `trend` ('up'\|'down'\|'stable'), `trendValue`, `subtext`, `glowColor`, `onClick`. | Parent component props; animated via `KPICounter`. |
| `TrendChart` | `datathon/src/components/charts/TrendChart.tsx` | Props: `data: TrendDataPoint[]` (`month`, `totalCrimes`, `solvedCrimes`). | Rendered using Recharts `AreaChart` with theme-tailored series gradients. |
| `DonutChart` | `datathon/src/components/charts/DonutChart.tsx` | Props: `data: PieDataPoint[]`, `onCategoryClick?: (category) => void`. | Recharts `PieChart`; triggers category drill-down on click. |
| `SpatiotemporalHeatmap`| `datathon/src/components/dashboard/SpatiotemporalHeatmap.tsx`| State: `temporal`, `selectedCell`, `loading`. | `getSociologicalTemporalMatrix()`, fallback baseline generator. |
| `Header` | `datathon/src/components/layout/Header.tsx` | Props: `sidebarCollapsed`, `setSidebarCollapsed`. State: `systime`, `emulatorActive`. | `appStore`, `authStore`, `NotificationBell`, `DataModeBadge`. |
| `Sidebar` | `datathon/src/components/layout/Sidebar.tsx` | Props: `activeTab`, `setActiveTab`, `collapsed`, `setCollapsed`. | `appStore`, `authStore`, `useRBAC`, `useNotificationStore`. |

### Backend Routes & Services

| Component | File Path | Responsibility | Important Methods / Functions |
|---|---|---|---|
| `dashboard_router` | `backend/app/routes/dashboard.py` | Exposes cached HTTP REST endpoints for dashboard analytics. | `summary()`, `crime_trends()`, `category_breakdown()`, `district_comparison()`, `officer_stats()`, `evidence_stats()`, `recent_incidents()`, `forecast()`, `risk_prediction()`, `season_breakdown()`. |
| `dashboard_service` | `backend/app/services/dashboard/dashboard_service.py` | Executes database filtering, counts, time-series bucketing, and heuristics. | `_apply_case_filters()`, `get_filtered_summary()`, `get_filtered_trends()`, `get_filtered_category_breakdown()`, `get_filtered_district_comparison()`, `get_officer_stats()`, `get_evidence_stats()`, `get_recent_incidents()`, `get_forecast_data()`, `get_risk_prediction()`, `get_season_breakdown()`. |
| `ttl_cache` | `backend/app/services/ttl_cache.py` | Thread-safe in-memory cache to prevent database saturation. | `ttl_cached(prefix, key_tuple, ttl_seconds, computation_func, scope)` |

---

## 6. Database Design

### Dedicated Dashboard Tables
**No dedicated dashboard database table found. Dashboard consumes data from existing domain tables.**

The dashboard aggregates operational data from the following source tables:

### Consumed Table: `crime_cases`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `case_number` | VARCHAR(50) | NOT NULL, UNIQUE | Human-readable case number displayed in Recent Incidents feed |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | Date & time incident occurred; used for time-series and date filters |
| `reported_at` | TIMESTAMPTZ | NOT NULL | Filing date; used for sorting recent incident stream chronologically |
| `category_id` | UUID | FK -> `crime_categories.id` | Category classification join key |
| `location_id` | UUID | FK -> `locations.id` | Location join key for district comparisons |
| `assigned_officer_id`| UUID | FK -> `officers.id` | Assigned investigator join key for workload statistics |
| `priority` | VARCHAR(20) | NULLABLE | Incident urgency: `low`, `medium`, `high`, `critical` |
| `status` | VARCHAR(30) | NOT NULL | Lifecycle status: `open`, `under_investigation`, `closed` |

### Consumed Table: `firs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `fir_number` | VARCHAR(50) | NOT NULL, UNIQUE | Standardized FIR registration identifier |
| `crime_case_id` | UUID | FK -> `crime_cases.id` | Case link used to compute filter-scoped FIR totals |

### Consumed Table: `criminals`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(255) | NOT NULL | Full name of registered offender |
| `status` | VARCHAR(50) | DEFAULT `'active'` | Offender status; used to compute total offender population |

### Consumed Table: `locations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `district` | VARCHAR(100) | NOT NULL | District name used for filter dropdown and comparison chart |
| `station` | VARCHAR(150) | NULLABLE | Police station name displayed in Recent Incidents |

### Consumed Table: `crime_categories`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | Category title used for category breakdown donut slices |

### Consumed Table: `officers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT `'active'` | Officer duty state (`active`, `on_leave`, `suspended`) |

### Consumed Table: `evidence`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `status` | VARCHAR(50) | NOT NULL | Verification stage: `Collected`, `Pending`, `Verified`, `Rejected` |

### Consumed Table: `notifications`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default: `gen_random_uuid()` | Primary Key |
| `severity` | VARCHAR(20) | NOT NULL | Alert severity: `low`, `medium`, `high`, `critical` |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT FALSE | Flag used for unread notification count badge |

---

## 7. API Design

| Method | Endpoint | Purpose | Request Parameters | Response Schema | Auth / Roles |
|---|---|---|---|---|---|
| `GET` | `/api/v2/dashboard/summary` | Core KPI metrics (crimes, open, firs, criminals, resolution) | Query: `date_from`, `date_to`, `district`, `category_id`, `officer_id`, `priority`, `status` | `DashboardSummary` JSON | All authenticated roles |
| `GET` | `/api/v2/dashboard/crime-trends` | Monthly crime counts for trend visualization | Query: Same filter params as summary | `TrendPoint[]` (`[{date, count}]`) | All authenticated roles |
| `GET` | `/api/v2/dashboard/category-breakdown` | Crime count grouped by category | Query: Same filter params as summary | `CategoryPoint[]` (`[{category, count}]`) | All authenticated roles |
| `GET` | `/api/v2/dashboard/district-comparison`| Crime count grouped by district | Query: Same filter params as summary | `DistrictComparisonPoint[]` | All authenticated roles |
| `GET` | `/api/v2/dashboard/officer-stats` | Total, active, on-duty, investigating officers | None | `OfficerStats` JSON | All authenticated roles |
| `GET` | `/api/v2/dashboard/evidence-stats` | Evidence pipeline counts by status | None | `EvidenceStats` JSON | All authenticated roles |
| `GET` | `/api/v2/dashboard/recent-incidents` | 5 most recent incidents with station and priority | None | `RecentIncident[]` | All authenticated roles |
| `GET` | `/api/v2/dashboard/forecast` | Predictive 14-day projection and trend direction | None | `ForecastResponse` JSON | All authenticated roles |
| `GET` | `/api/v2/dashboard/risk-prediction` | Threat level, risk score, confidence score | None | `RiskPredictionResponse` JSON | All authenticated roles |
| `GET` | `/api/v2/dashboard/season-breakdown` | Historical cases categorized by season | None | `SeasonBreakdownResponse` JSON | All authenticated roles |
| `GET` | `/api/v2/investigation/search` | Federated multi-entity search (Command Center) | Query: `q`, `limit` | `InvestigationGroupedSearchResponse` | All authenticated roles |
| `GET` | `/api/v2/notifications/dashboard` | Triage counters (critical, unread alerts) | None | `NotificationDashboardSummary` | All authenticated roles |

### Required APIs (Missing / Incomplete)

| Method | Endpoint | Purpose | Status | Missing Details |
|---|---|---|---|---|
| `GET` | `/api/v2/dashboard/investigator-workload` | Specific breakdown of active cases assigned per investigator with overdue milestones. | **NOT IMPLEMENTED / REQUIRED** | Currently `/dashboard/officer-stats` only returns aggregate counts, not officer-by-officer caseloads. |
| `POST` | `/api/v2/dashboard/user-preferences` | Persist user-selected dashboard filter defaults across browser sessions. | **NOT IMPLEMENTED / REQUIRED** | Filters reset to empty defaults on page reload; no backend persistence exists. |

---

## 8. Input / Output

### Inputs
* **Filter Bar Selections:**
  * `selectedDistrict`: Dropdown of 30 Karnataka police districts.
  * `selectedCategory`: UUID string referencing `crime_categories.id`.
  * `selectedOfficer`: UUID string referencing `officers.id`.
  * `selectedPriority`: Case priority (`low`, `medium`, `high`, `critical`).
  * `selectedStatus`: Case status (`open`, `under_investigation`, `closed`, `cold`).
  * `startDate` / `endDate`: ISO-8601 date strings.
* **Search Text:** String query inputted into Command Center or global Command Palette (`⌘K`).
* **Real-time SSE Events:** Inbound JSON messages from `/api/v2/realtime/stream` (e.g. `event: case_created`).

### Outputs
* **Rendered Telemetry UI:**
  * 5 Animated Stat Cards: Total Crimes, Open Crimes, Total FIRs, Registered Criminals, Resolution Rate %.
  * Area Chart: Monthly trajectory of total vs. resolved crimes.
  * Donut Chart: Proportional distribution across crime categories.
  * Heatmap: 7×6 matrix of incident density across day-of-week and time slots.
  * Recent Incidents Feed: Table listing case number, category, police station, timestamp, and priority badge.
  * Threat Bar Chart: Sector-level threat score indices.
* **Export Artifacts:** Generated client-side or server-side investigation summary dossiers (PDF/CSV).
* **Navigation Dispatches:** Custom window event `navigate-tab` routing user to `/crime-cases`, `/firs`, `/evidence`, or `/network`.

---

## 9. Data Flow

### 1. Filtered Dashboard Hydration Flow

```text
User selects District / Category / Date Range
  │
  ▼
Overview.tsx: loadFilteredDashboard() [sets loading=true]
  │
  ├─► Stage 1 (Critical Parallel Requests):
  │    ├─► GET /api/v2/dashboard/summary?district=...
  │    ├─► GET /api/v2/dashboard/crime-trends?district=...
  │    └─► GET /api/v2/dashboard/category-breakdown?district=...
  │
  ├─► Backend: ttl_cached lookup
  │    ├─► Cache HIT: Returns in-memory JSON instantly (<10ms)
  │    └─► Cache MISS: Executes SQLAlchemy queries, caches result, returns JSON
  │
  ├─► Frontend renders StatCard, TrendChart, DonutChart (Perceived load complete)
  │
  └─► Stage 2 (Secondary Parallel Requests via Promise.allSettled):
       ├─► GET /api/v2/dashboard/officer-stats
       ├─► GET /api/v2/dashboard/evidence-stats
       ├─► GET /api/v2/dashboard/recent-incidents
       ├─► GET /api/v2/ai/hotspots
       └─► GET /api/v2/ai/predictions/anomalies
  │
  ▼
Overview.tsx renders secondary panels (sets loading=false)
```

### 2. Real-time Incident Update Flow

```text
Backend: New crime case created (POST /api/v2/crime-cases)
  │
  ▼
realtime_bus.publish({"type": "case_created", "payload": {case_number, crime_type, location, time, priority}})
  │
  ▼ (SSE Stream: /api/v2/realtime/stream)
Browser: useRealtimeStore receives 'case_created' event
  │
  ├─► Optimistic Update: Prepend incident to local recentIncidents state immediately
  │
  └─► Debounced Server Reconciliation (1.5s):
       └─► Dispatches silent refetch of GET /dashboard/summary and GET /dashboard/recent-incidents
```

---

## 10. Module Interactions

| Source Module | Interaction | Target Module | Current Status |
|---|---|---|---|
| **Crime Cases** | Supplies incident totals, case statuses, priority ratings, and recent event feeds | **Dashboard** | Current |
| **FIR** | Supplies total FIR counts linked to matching crime cases | **Dashboard** | Current |
| **Criminals** | Supplies total registered offender population counts | **Dashboard** | Current |
| **Officers** | Supplies active vs. investigating officer duty allocations | **Dashboard** | Current |
| **Evidence** | Supplies chain-of-custody verification pipeline counts | **Dashboard** | Current |
| **Hotspot** | Supplies spatial cluster scores and coordinates for the summary map | **Dashboard** | Current |
| **AI / Anomalies** | Supplies system and telemetry anomaly records to the threat index | **Dashboard** | Current |
| **Notifications** | Supplies critical and unread notification counts to the Command Center | **Dashboard** | Current |
| **Dashboard** | Dispatches cross-tab navigation events with pre-selected entity UUIDs | **Cases / FIR / Network** | Current |
| **Auth & Audit** | Authenticates access via JWT Bearer token and logs `PAGE_VIEW` events | **Dashboard** | Current |

---

## 11. Business Logic / Rules

| Rule # | Condition | Action |
|---|---|---|
| **BR-DSH01** | Resolution Rate calculation. | `resolution_rate = round((closed_cases / total_cases) * 100, 2)`. If `total_cases == 0`, returns `0.0` to avoid division by zero. |
| **BR-DSH02** | Filter cascade on FIR counts. | When case filters are active (e.g. district, category), FIR count query must filter FIRs linked to the subquery of matching `crime_case_id`s. |
| **BR-DSH03** | Officer status allocation. | If database has 0 officers seeded, service supplies realistic operational baselines (45 total, 42 active, 36 on-duty, 28 investigating). |
| **BR-DSH04** | TTL Cache eviction policy. | Cached results expire automatically after 45s (filtered queries), 60s (static queries), or 120s (ML forecast). Keyed by SHA-256 hash of filter arguments. |
| **BR-DSH05** | Silent polling throttling. | `usePolling` hook automatically suspends API cycles when `document.visibilityState === 'hidden'`, resuming instantly upon tab focus. |
| **BR-DSH06** | Threat score tiering. | Sector threat score $\ge 85$: 'Critical' (crimson `#C94A2A`); $\ge 70$: 'High' (amber `#D4820A`); $\ge 50$: 'Medium' (blue `#1E6FD9`); $<50$: 'Low' (teal `#0E9E78`). |
| **BR-DSH07** | Demo forecast disclaimer. | In `ForecastChart.tsx`, the 14-day projection is explicitly tagged with a visual `Demo Data` warning chip and tooltip to prevent mistaking illustrative trends for validated operational forecasts. |

---

## 12. Validation

| Input / Condition | Validation Rule | Failure Behaviour |
|---|---|---|
| **Date Filters** | `date_from` and `date_to` must be parseable ISO-8601 strings. | FastAPI returns HTTP 422 Unprocessable Entity if unparseable; frontend falls back to undefined. |
| **UUID Parameters** | `category_id` and `officer_id` must conform to standard UUID v4 format. | Backend `_apply_case_filters` attempts `uuid.UUID(val)`; on `ValueError`, filter is ignored gracefully without failing query. |
| **District Filter** | District string must match registered location districts. | Filter applied via SQL `Location.district == district`. If nonexistent, returns 0 counts without error. |
| **Authentication Token** | Valid JWT token required in HTTP Authorization header. | FastAPI dependency `get_current_user` raises HTTP 401 Unauthorized; frontend redirects to `/login`. |
| **Role Authorization** | User role must be present in `ALL_ROLES`. | Handled by `RoleGuard` on frontend and `require_roles` on backend; blocks unauthorized rendering. |

---

## 13. Error Handling

| Error Scenario | Cause | System Behaviour |
|---|---|---|
| **Primary DB Disconnection** | Supabase/Postgres network drop or pool exhaustion. | Backend engine automatically falls back to `sqlite:///./saksha.db` with warning logged; dashboard continues serving queries. |
| **Stage 1 Filter API Failure** | Network timeout or syntax error in filter parameters. | `Overview.tsx` catches exception, sets `error` message string, and displays retry button; KPI cards show skeleton/empty state. |
| **Stage 2 Secondary API Failure**| Failure in non-critical service (e.g. hotspots, anomalies). | Handled via `Promise.allSettled`; failing panels fail independently without blanking out the main KPI cards and trend charts. |
| **Empty Filter Results** | Filter criteria match zero incidents. | Charts render clean empty-state fallback messages ("No trend data available for selected filters"); KPI counters display `0`. |
| **Realtime SSE Disconnect** | Server restarts or SSE connection drops. | `useRealtimeStore` transitions state to `connecting`, tries exponential reconnect, and falls back to regular 30s background polling. |

---

## 14. Security / Access Control

| Area | Requirement / Current Implementation |
|---|---|
| **Authentication Gate** | All dashboard endpoints require valid JWT Bearer authentication enforced by `Depends(get_current_user)`. |
| **Role-Based Access (Backend)**| `APIRouter(dependencies=[Depends(require_roles(*ALL_ROLES))])` grants read access to all official police roles (`admin`, `crime_analyst`, `investigator`, `inspector`, `forensic`, `policymaker`, `viewer`). |
| **Role-Based Access (Frontend)**| Wrapped in `<RoleGuard path="/dashboard">` and `<RoleGuard path="/command-center">`. Unauthorized roles render a 3D animated lock shield and audit warning. |
| **Audit Logging** | Accessing the dashboard triggers an automatic audit log entry via `useAuditStore.addLog(user.name, user.badgeId, 'PAGE_VIEW', 'Accessed Analytics Dashboard')`. |
| **Data Protection** | Dashboard summaries return numeric aggregates and public case identifiers; sensitive victim personal identifiers (PII) are not exposed on overview cards. |

---

## 15. Existing vs Required Functionality

### Already Implemented
* Complete Analytics Dashboard page (`Overview.tsx`) with 5 KPI stat cards, trend chart, category distribution donut, and incident stream.
* Investigation Command Center (`CommandCenter.tsx`) with federated entity search, natural language interpretation bar, and triage counters.
* Multi-parameter filter bar (District, Crime Category, Officer, Priority, Status, Date Range).
* Backend aggregation endpoints with multi-attribute filtering in `backend/app/routes/dashboard.py`.
* In-memory server-side TTL caching (`ttl_cached`) to guard database against UI polling.
* Real-time Server-Sent Events (SSE) integration for instant incident stream updates.
* Role-based access control guards and automated audit logging for page views.

### Partially Implemented
* **Forecast Integration:** Backend implements `/api/v2/dashboard/forecast` with calculated week-over-week trends, but frontend `ForecastChart.tsx` uses a static illustrative series labeled as "Demo Data".
* **Filter Dropdowns:** Filter dropdown lists are fetched on mount, but user selections are not persisted across browser reloads.
* **Spatiotemporal Heatmap:** Uses demographic distribution when available, but falls back to static Karnataka baseline distribution if temporal data is null.

### Not Implemented
* Dynamic drag-and-drop dashboard widget customization for individual investigators.
* Per-officer active caseload workload analytics endpoint.
* In-dashboard user threshold alert configuration.

### Required Changes
* Connect `ForecastChart.tsx` directly to the `/api/v2/dashboard/forecast` backend endpoint response.
* Persist active dashboard filter selections in `localStorage` or session state so user selections persist during navigation.
* Implement a dedicated investigator workload distribution breakdown widget.

---

## 16. Implementation Tasks

| ID | Task | Files / Components | Priority | Status |
|---|---|---|---|---|
| **DSH-01** | Connect ForecastChart to Live Backend API | `datathon/src/components/charts/ForecastChart.tsx`, `Overview.tsx` | High | Required |
| **DSH-02** | Dashboard Filter State Persistence | `datathon/src/pages/Overview.tsx`, `appStore.ts` | Medium | Required |
| **DSH-03** | Targeted Cache Invalidation on Case Updates | `backend/app/routes/crime_cases.py`, `ttl_cache.py` | Medium | Required |
| **DSH-04** | Officer Workload Caseload Modal / Widget | `backend/app/routes/dashboard.py`, `Overview.tsx` | Low | Required |

---

## 17. Files to Create / Modify

### Modify

| File | Changes |
|---|---|
| `datathon/src/components/charts/ForecastChart.tsx` | Accept live `data?: ForecastResponse` prop from `Overview.tsx` instead of static `FORECAST_SERIES` constant; dynamically map predicted points. |
| `datathon/src/pages/Overview.tsx` | Pass `forecastData` state directly into `<ForecastChart data={forecastData} />`; persist filter state in `sessionStorage`. |
| `backend/app/routes/crime_cases.py` | Call `invalidate_ttl_cache_prefix("dashboard:")` on case creation and status updates to guarantee cache freshness. |

### Create

| File | Purpose |
|---|---|
| `datathon/src/components/dashboard/OfficerWorkloadWidget.tsx` | Specialized card rendering investigator caseload distribution and pending FIR milestones. |

---

## 18. Dependencies

| Dependency | Used For | Current Status |
|---|---|---|
| `recharts` | Rendering area trend charts, category donut charts, and threat index bar graphs. | Current dependency (`package.json`) |
| `lucide-react` | Icons for KPIs, trends, command palette, and navigation links. | Current dependency (`package.json`) |
| `zustand` | Global state management (`appStore`, `authStore`, `auditStore`, `realtimeStore`). | Current dependency (`package.json`) |
| `fastapi` | Backend routing, query parameter validation, and dependency injection. | Current dependency (`requirements.txt`) |
| `sqlalchemy` | ORM aggregation queries, count expressions, and table joins. | Current dependency (`requirements.txt`) |

---

## 19. Testing / Verification

| Test Case | Expected Result |
|---|---|
| Select district "Bangalore City" and category "Cyber Crime" | `GET /dashboard/summary` is called with query params; KPI counters and trend charts update to reflect only Bangalore Cyber Crime cases. |
| Repeatedly poll `/dashboard/summary` within 45 seconds | Returns HTTP 200 with cached response payload; zero SQL queries executed against PostgreSQL. |
| Trigger new case creation in another tab | Realtime SSE event `case_created` is received; new incident appears at top of Recent Incidents table within 1 second. |
| Simulate database disconnection | Backend logs warning and falls back to `sqlite:///./saksha.db`; dashboard metrics continue rendering without HTTP 500 crashes. |
| Unauthenticated user requests `/dashboard` | `RoleGuard` intercepts request, blocks page rendering, and presents the authentication requirement notice. |

---

## 20. Final Implementation Summary

### Current State
* The Dashboard module is mature and dual-faceted: `Overview.tsx` handles analytical intelligence and multi-parameter filtering, while `CommandCenter.tsx` serves as the primary investigative search and triage launcher.
* Backend aggregation is optimized through in-memory TTL caching (`ttl_cache.py`), shielding PostgreSQL/Supabase from high-frequency frontend polling.
* The frontend smoothly combines silent 30s polling (`usePolling`) with Server-Sent Events (`useRealtimeStore`) for immediate reactivity.

### Main Gaps
* `ForecastChart.tsx` currently displays a static sample series labeled as demo projection rather than dynamically plotting the output from `GET /dashboard/forecast`.
* Dashboard filter choices are not retained across browser reloads or tab switches.

### Required Next Steps
1. Wire `ForecastChart.tsx` props to accept live backend `forecastData` (Task DSH-01).
2. Persist active filter state to session storage to improve investigator workflow continuity (Task DSH-02).
3. Add TTL cache prefix invalidation in `crime_cases.py` to ensure instant cache refresh upon write operations (Task DSH-03).
