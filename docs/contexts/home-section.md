# Saksha — HOME Section (`docs/contexts/home-section.md`)

> Runtime section label: **HOME** (sidebar `NavGroup label: 'HOME'`). This is the
> operator's landing area: analytics overview + the communication/inbox center.
>
> If you were expecting **Dashboard, Admin, Crime Cases, Reports, AI Chat** to all
> live here, see the mapping at the end of this page — the app's sidebar groups
> those under their functional sections (SYSTEM / INVESTIGATIONS / REPORTS /
> ASSISTANCE), while this HOME group contains **Dashboard** and **Notifications**.
> Every one of the six pages you named is covered exactly once across this docs set.

| Page (route)                    | This doc? | Notes |
| ------------------------------- | :-------: | ----- |
| Dashboard — `/dashboard`        | ✅ here   | Analytics overview, every role read-only |
| Notifications — `/notifications`| ✅ here   | Communication Center / inbox + health |
| AI Chat — `/ai-chat`            | assistance-section.md | Read-only assistant, every role |
| Crime Cases — `/crime-cases`    | investigations-section.md | |
| Reports — `/reports`            | reports-section.md | |
| Admin — `/admin`                | system-section.md | ADMIN-only |

---

## 1. Section overview

### 1.1 Pages in this section (`datathon/src/components/layout/Sidebar.tsx`)

| id           | label | path               | icon            |
| ------------ | ----- | ------------------ | --------------- |
| `dashboard`  | Dashboard | `/dashboard`   | `LayoutDashboard` |
| `notifications` | Notifications | `/notifications` | `Bell` |

### 1.2 Role first-destinations that pin HOME items (`PRIMARY_BY_ROLE`)

Every role pins Dashboard. Notifications is pinned for every role **except IO**.

| Role | Pinned HOME items (this section) |
| ---- | --------------------------------- |
| ADMIN | dashboard, notifications |
| SP (Policymaker) | dashboard, notifications |
| INSPECTOR | dashboard, notifications |
| SCRB (Crime Analyst) | dashboard |
| IO (Investigator) | dashboard |
| FORENSIC | dashboard |
| VIEWER | dashboard, notifications |

### 1.3 Route-level access (`USE_RBAC.ts → ROUTE_PERMISSIONS`)

Both pages use `INSIGHT_ROLES = ALL_UI_ROLES` (all 7 roles: ADMIN, SCRB, IO, SP,
INSPECTOR, FORENSIC, VIEWER). The sidebar renders an item only when
`checkPermission(path)` is true, so every signed-in role sees the full HOME group.

### 1.4 Backend role conventions that apply

- `backend/app/auth/rbac.py`: `ALL_ROLES` (= every role), `REVIEW_ROLES`
  (`admin, crime_analyst, investigator, inspector`), `require_roles(...)`.
- Both routers here are router-level `ALL_ROLES` (read for all; a few write
  actions exist but are not admin-narrowed on the backend — see below).
- All cross-tab navigation uses `window.dispatchEvent(new CustomEvent('navigate-tab', …))`
  and `sessionStorage['selected_entity_id']`; audit via `addLog` / `audit_service`.

---

## 2. Dashboard (`datathon/src/pages/Overview.tsx`)

### 2.1 What's on the page

Single-scroll analytics command view ("Analytics Dashboard").

- **Header** — `PageHeader`, title per i18n, subtitle; right slot holds the
  **ExportMenu** (downloads the dashboard dataset as `pdf/docx/txt/csv/xlsx`
  watermark-badged, watermarked `CONFIDENTIAL - <badgeId>`) and the live
  **realtime indicator** (`useRealtimeStore`).
- **Statistic cards** — `StatCard`: Total FIRs, Open Cases, Criminals, Victims,
  Officers, Evidences, etc. derived from `getDashboardSummary`.
- **Analytics strip**
  - `TrendChart` — crime trend over time (`getCrimeTrends`).
  - `DonutChart` — category breakdown (`getCategoryBreakdown`).
  - `SpatiotemporalHeatmap` — time-of-day × day-of-week heat.
  - `SpatialCube3D` (Three.js) — spatial crime cube.
  - `ActiveAlerts3D` — rotating alert snippet cards.
  - `ForecastChart` — 7-day forecast (`getForecast`) and district risk
    (`getRiskScores`).
- **Tables/groups** — Recent Incidents (`getRecentIncidents`), Officer Stats
  (`getOfficerStats`), Evidence Stats (`getEvidenceStats`), Risk scores, top
  Hotspots, quick **Crime Cases** list, and location select (`getLocationsList`,
  `getCrimeCategories`).
- **Quick actions** — "Generate Report" (modal: *Specific Report* forms for the
  six discussion/analysis cases; creates a managed report via the app's own
  export pipeline) and **Resource Allocation** (deep-links to `/strategic` via
  `navigate-tab`).
- **Empty/error states** — `EmptyState` cards; each stat surfaces "Unavailable"
  when the backend returns null (UI-honesty pass: no fabricated numbers).

### 2.2 How it's done

- **Frontend** — `Overview.tsx` + shared components
  (`components/dashboard/*`, `components/ui/PageHeader`, `components/reports/ExportMenu`)
  + `utils/downloader.ts` (`downloadSecureDossier`). Data fetched through the
  named service wrappers in `datathon/src/services/api.ts` → Vite proxy `/api` →
  `:8000`, Bearer-token interceptor.
- **Backend** — `backend/app/routes/dashboard.py`:
  `APIRouter(prefix="/dashboard", dependencies=[Depends(require_roles(*ALL_ROLES))])`.
  Heavy analytics are TTL-cached (`services/ttl_cache.py`) and district-scoped
  (`app/auth/scope.py`) — a district-bound user is server-side filtered and fails
  closed (403) only if they have no district. The FIR risk gauge uses the honest
  **`RULE-SQL-V2`** rule-based label.
- **Realtime** — `useRealtimeStore.connect()` (SSE-ish streaming fetch to
  `/realtime/events`, reference-counted so it can share one stream with
  Crime Cases / Notifications).

### 2.3 Current behaviour

- Everything loads via `usePolling`-driven staggered fetches on mount; district
  selection (`useUserScope`) re-fetches with a `district` query param.
- Export menu logs `EXPORT` via `useAuditStore.addLog`.
- Page-view is audited in `App.tsx` (`PAGE_VIEW`).
- Deep-links arrive as `navigate-tab` events; falls back to realtime store for
  live counters.

### 2.4 Role behaviour

All roles read the same dashboard content. There are **no** write actions on this
page. The only role variance is district scope + which districts can be selected:

| Role                       | Page access | Read | Write | Notes |
| -------------------------- | :---------: | :--: | :---: | ----- |
| ADMIN                     | ✅          | ✅   | —     | Full district selector (state-wide) |
| SP (Policymaker)          | ✅          | ✅   | —     | Full district selector |
| INSPECTOR                 | ✅          | ✅   | —     | Full district selector |
| SCRB (Crime Analyst)      | ✅          | ✅   | —     | Full district selector |
| IO (Investigator)         | ✅          | ✅   | —     | District-scoped unless cleared |
| FORENSIC                  | ✅          | ✅   | —     | Scoped read |
| VIEWER                    | ✅          | ✅   | —     | Scoped/most-restricted view |

---

## 3. Notifications / Communication Center (`datathon/src/pages/Notifications/index.tsx`)

### 3.1 What's on the page

"Communication Center — INTER-STATION NOTIFICATION & INTELLIGENCE COMMAND".

- **Header actions** — "Remove All Broadcasts" (shown when
  `dashboard.broadcast_messages > 0`), "Mark All Read" (when `counts.unread > 0`),
  "Inform Station" (opens `InformStationModal`) — plus the 4-tab bar:
  **Messages · Timeline · Activity · Health**.
- **Messages tab** — `NotificationFilters` (sender/kind/read state + "Clear
  filters"), error banner, list of `NotificationCard`s (click → `NotificationDetailModal`),
  `TableSkeleton` while first-loading, empty state, pagination footer
  "Page X of Y (N messages)".
- **Timeline tab** — `CommunicationTimeline` fed from current-page `notifications`.
- **Activity tab** — `ActivityFeed limit={100}`.
- **Health tab** — `SystemHealth`: polls `/health/ready` on mount + every 120 s +
  manual refresh; service cards (Backend API latency ms, PostgreSQL/Neo4j/Data
  Source from probe body, Realtime SSE stream), overall critical/degraded/healthy,
  footer "Probe: /health/ready". Idle SSE shows **"Standby"** instead of "down".

### 3.2 How it's done

- **Frontend** — `Notifications/index.tsx` + `components/notifications/*`,
  driven by `store/notificationStore.ts` (state: `notifications`, `total`, `page`,
  `pageSize`, `counts`, `dashboard`, actions `fetchNotifications`, `fetchCounts`,
  `fetchDashboard`, `markAllRead`, `setPage`, `setFilter`, `clearFilters`,
  `removeAllBroadcasts`, `informModalOpen`). Realtime via
  `useRealtimeStore.connect()` on mount / `.disconnect()` on unmount
  (reference-counted `consumerCount`; underlying `connectRealtime` in
  `services/realtime.ts` uses streaming `fetch` to `/realtime/events`, Bearer
  token, auto-reconnect w/ exponential backoff, 401 → `auth:session-expired`).
- **Backend** — `backend/app/routes/notifications.py`:
  `prefix="/notifications"`, router-level `ALL_ROLES`; SSE feeds via
  `routes/realtime.py` (`ALL_ROLES`).

### 3.3 Current behaviour

- Mount → `fetchNotifications(1)`, `fetchCounts()`, `fetchDashboard()`; SSE
  subscription only lives while the page is mounted.
- `markAllRead` / `removeAllBroadcasts` call the notification store actions which
  hit the backend and then re-fetch counts.
- Filters and pagination re-fetch on change; nothing is role-narrowed inside the
  component.

### 3.4 Role behaviour

Every role can read everything here; the "Inform Station" broadcast and
"Remove All Broadcasts" actions are wired to the same `ALL_ROLES` backend router
and are not admin-gated at the API level (they are gated in the UI by
notification-store data availability, not by role):

| Role        | Page access | Read | Write/broadcast | Notes |
| ----------- | :---------: | :--: | :-------------- | ----- |
| ADMIN       | ✅          | ✅   | ✅              | Full access |
| SCRB, IO, SP, INSPECTOR | ✅ | ✅ | ✅ (not backend-restricted) | Broadcast + mark-read available |
| FORENSIC    | ✅          | ✅   | ✅              | Read + actions; health tab available |
| VIEWER      | ✅          | ✅   | ✅ (UI actions available) | Read + actions; most-restricted scenario |

---

## 4. Where the other four requested pages live

Per your grouping, **Admin, Crime Cases, Reports, AI Chat** ("Home Section" pages
for the ADMIN operator) are individually documented as follows:

| Page      | Route            | Documentation                                   | Roles that can open |
| --------- | ---------------- | ------------------------------------------------ | ------------------- |
| Admin     | `/admin`         | `system-section.md` §2                           | ADMIN only          |
| Crime Cases | `/crime-cases` | `investigations-section.md` §2                    | INVESTIGATION_ROLES |
| Reports   | `/reports`       | `reports-section.md` §2                           | UI: all; API: ADMIN/SCRB/IO/INSPECTOR/SP |
| AI Chat   | `/ai-chat`       | `assistance-section.md` §2                        | every role (INSIGHT_ROLES) |

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. Keep route/role tables in sync with
datathon/src/hooks/useRBAC.ts and backend/app/routes/*.py. -->