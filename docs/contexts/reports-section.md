# Saksha — REPORTS Section (`docs/contexts/reports-section.md`)

> Runtime section label: **REPORTS** (sidebar `NavGroup label: 'REPORTS'`).
> One page: the unified report generator/builder.

| Page (route)             | Docs section |
| ------------------------ | ------------ |
| Reports — `/reports`     | §2 |

---

## 1. Section overview

### 1.1 Pages (`datathon/src/components/layout/Sidebar.tsx`)

| id       | label  | path        | icon            |
| -------- | ------ | ----------- | --------------- |
| `reports`| Reports| `/reports`  | `FileBarChart2` |

### 1.2 Route-level access — UI vs backend mismatch (important)

| Surface | Allowed roles |
| ------- | ------------- |
| Frontend `ROUTE_PERMISSIONS['/reports']` | **all 7** (`INSIGHT_ROLES`) — sidebar shows Reports to everyone |
| Backend `routes/reports.py` router | **ADMIN, SCRB, IO, INSPECTOR, SP** — **VIEWER and FORENSIC are NOT included** |

Consequence: **VIEWER and FORENSIC can open `/reports` but every API call
403s** — the page renders its empty/error state. `PRIMARY_BY_ROLE.ADMIN` also
pins `reports`. When touching this page, either narrow the frontend route set or
widen the backend guard; do not leave the mismatch undocumented.

Backend guard source (router-level dependency):
`require_roles("admin", "crime_analyst", "investigator", "inspector",
"policymaker")` in `backend/app/routes/reports.py`.

---

## 2. Reports (`datathon/src/pages/Reports.tsx`)

### 2.1 What's on the page

- **Template gallery** — prebuilt report templates (discussion/analysis cases
  mirrored from the dashboard "Generate Report" modal: crime analysis, hotspot,
  intervention, network, victimology, strategic brief — exact list rendered from
  a `templates`/`sections` config in the page/component), each with title,
  description, section chips, "Generate" CTA.
- **Builder** — report type/template select, date-range + district + category
  filters (`useUserScope` constrains district when bound), section toggles
  (overview, trends, hotspots, top-offenders, interventions, appendix…), preview
  pane with live section rendering from fetched analytics.
- **Export bar** — format menu (pdf / docx / txt / csv / xlsx) via shared
  `ExportMenu` + `downloadSecureDossier` (watermark `CONFIDENTIAL -
  <badgeId>`), optional classification/marking selector (OFFICIAL/RESTRICTED/
  CONFIDENTIAL as configured), "Download" and "Email/Share" (share is
  notification-based where wired).
- **History panel** (when backed by managed reports): generated-report list
  (title, type, created-at, size, status), re-download, delete (admin-leaning),
  provenance badges (`SignalTag` LIVE/DEMO on data sections).
- Loading/empty/error states; export disabled until preview has data.

### 2.2 How it's done

- **Frontend** — `datathon/src/pages/Reports.tsx` + shared report components
  (`components/reports/*`, `ExportMenu`, `utils/downloader.ts` →
  `downloadSecureDossier`). Data assembled from the same dashboard/analytics
  service wrappers in `services/api.ts` (district param included) so the report
  mirrors on-screen analytics exactly; **no hardcoded report metrics** —
  unavailable series render "Unavailable".
- **Backend** — `routes/reports.py` (guard above): report-render endpoints pull
  from `analytics_service` (+ district scoping); where a report payload is
  expensive it uses `ttl_cached` with targeted
  `invalidate_ttl_cache_prefix(...)` on writes. Any managed-report record
  create/delete is audited (`audit_service.log_action(...)`).
- **Watermarking/export** — handled client-side by `downloadSecureDossier`
  (badge-id watermark embedded per format).

### 2.3 Current behaviour

- On mount: templates + last-used filters from localStorage; preview refetches
  on filter change (debounced); district-bound users see a scope chip instead of
  a free district dropdown.
- Generate → preview sections hydrate → export menu available; each export
  fires `addLog('EXPORT', …)`.
- Deep-link: `sessionStorage['selected_entity_id']` accepted when arriving from
  FIR/case pages (seeds the "case-focused" template when present).
- Audit: `PAGE_VIEW` on open, `EXPORT` per download, `DELETE` per history
  removal.

### 2.4 Role behaviour

| Role | Page (UI) | Backend reports API | Export | Notes |
| ---- | :-------: | :-----------------: | :----: | ----- |
| ADMIN | ✅ | ✅ | ✅ | full template set + history delete |
| SCRB (Crime Analyst) | ✅ | ✅ | ✅ | generate + export |
| IO (Investigator) | ✅ | ✅ | ✅ | generate + export |
| INSPECTOR | ✅ | ✅ | ✅ | generate + export |
| SP (Policymaker) | ✅ | ✅ | ✅ | strategic/brief templates |
| FORENSIC | ✅ (UI) | ❌ 403 | ❌ | mismatch — page loads, calls fail |
| VIEWER | ✅ (UI) | ❌ 403 | ❌ | mismatch — page loads, calls fail |

---

## 3. Cross-cutting notes

- Resolve the VIEWER/FORENSIC mismatch deliberately:
  - Option A (narrow UI): set `ROUTE_PERMISSIONS['/reports'] =
    INVESTIGATION_ROLES ∪ {SP}` — i.e. drop VIEWER/FORENSIC from the route.
  - Option B (widen API): add `"viewer"`/`"forensic"` to the router guard if the
    product wants read-only report access — but note export of confidential
    aggregates is the risk being guarded today.
- Reports must stay honest: only real analytics columns, provenance-labelled
  demo sections, "Unavailable" for nulls — same as the dashboard.

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. -->