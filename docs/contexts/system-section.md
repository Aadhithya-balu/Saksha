# Saksha — SYSTEM Section (`docs/contexts/system-section.md`)

> Runtime section label: **SYSTEM** (sidebar `NavGroup label: 'SYSTEM'`).
> Administration surface: officer/station registry + role admin, product docs,
> and settings/help. (The user's "Admin" page lives here — see
> `home-section.md` §4 for the cross-reference.)

| Page (route)                  | Docs section |
| ----------------------------- | ------------ |
| Officers — `/officers`        | §2 |
| Admin — `/admin`              | §3 |
| Docs — `/docs`                | §4 |
| Settings & Help — `/settings` | §5 |

---

## 1. Section overview

### 1.1 Pages (`datathon/src/components/layout/Sidebar.tsx`)

| id          | label            | path         | icon            |
| ----------- | ---------------- | ------------ | --------------- |
| `officers`  | Officers         | `/officers`  | `Users`         |
| `admin`     | Admin            | `/admin`     | `Settings2`     |
| `docs`      | Docs             | `/docs`      | `BookOpenText`  |
| `settings`  | Settings & Help  | `/settings`  | `LifeBuoy`      |

### 1.2 Route-level access (`useRBAC.ts`)

| Route | Allowed roles | Notes |
| ----- | ------------- | ----- |
| `/officers` | ADMIN, SCRB, IO, INSPECTOR, SP (`OFFICER_READ_ROLES`) | FORENSIC, VIEWER excluded |
| `/admin` | ADMIN only | backend `/admin` also ADMIN-only |
| `/docs` | all 7 | static content |
| `/settings` | all 7 | per-user prefs, local |

`PRIMARY_BY_ROLE` pins: ADMIN → `admin`; SP → `officers`.

### 1.3 Backend conventions

- `routes/admin.py`: `prefix="/admin"`, `require_roles("admin")` for the router.
- Officer/station reads live under officer-admin routes with
  `OFFICER_READ_ROLES`-equivalent guards (admin, crime_analyst, investigator,
  inspector, policymaker); officer writes are ADMIN (+ INSPECTOR for
  assignments where configured).
- RBAC objects: `roles`, `users`, `officers` tables; `users.email` and
  `users.role_id` are NOT NULL; seed data absent in tests (`AGENTS.md`).

---

## 2. Officers (`datathon/src/pages/Officers/index.tsx`)

### 2.1 What's on the page

- **Registry table** — officer name, badge id, rank, station, district, role,
  status (Active/Suspended/Leave), joined; search + rank/station/status/district
  filters; row click → detail drawer.
- **Detail drawer** — profile summary, assignment history, performance counts
  (cases handled, evidence custody items), contact (masked), action buttons:
  Edit Officer, Change Role, Suspend/Activate, Reset Credentials (admin-leaning),
  Delete (ADMIN).
- **Station map/roster tab** (when enabled) — station-wise officer counts via
  `getStationsSummary`-style calls.
- **Create officer** modal (badge, name, rank, station, role) — ADMIN.
- Empty/error states; `TableSkeleton`; audit chip on mutating actions.

### 2.2 How it's done

- **Frontend** — `datathon/src/pages/Officers/index.tsx` + officer components;
  service wrappers in `services/api.ts` (`getOfficers`, `getOfficer`,
  `createOfficer`, `updateOfficer`, `deleteOfficer`, role/station helpers).
  Gated by `useRBAC()`: `canWrite = isAdmin` for create/delete; `canEdit =
  isAdmin || isInspector` for profile/status edits (mirror backend exactly when
  implementing).
- **Backend** — officer router (guards per `OFFICER_READ_ROLES` for reads;
  writes ADMIN / ADMIN+INSPECTOR). Every write audited
  (`audit_service.log_action(...)` CREATE/UPDATE/DELETE). District scoping:
  district-bound users see only their district's officers.
- Page-view audited in `App.tsx` (`PAGE_VIEW`).

### 2.3 Role behaviour

| Role | Page | Read registry | Create/Edit | Delete / Role change |
| ---- | :--: | :-----------: | :---------: | :-------------------: |
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| SCRB, IO | ✅ | ✅ | (per backend) | ❌ |
| INSPECTOR | ✅ | ✅ | ✅ (profile/status) | ❌ |
| SP | ✅ | ✅ | ❌ | ❌ |
| FORENSIC, VIEWER | ❌ (route) | — | — | — |

---

## 3. Admin (`datathon/src/pages/Admin/index.tsx`) — the "Admin" page

### 3.1 What's on the page

"System Administration & RBAC Console".

- **Tabs** — Users · Roles · Audit · System:
  - **Users** — user table (name, email, role, badge, status), invite/create
    user modal (email + role select — `users.email`/`users.role_id` NOT NULL),
    edit user (role, active), deactivate, reset password; per-row impersonate
    (dev-only where enabled).
  - **Roles** — role cards for all 7 roles with permission matrix (route-level
    permission summary rendered from the same `ROUTE_PERMISSIONS` data),
    create/rename custom role (backend RBAC CRUD), scope (global vs district)
    editor for role templates.
  - **Audit** — audit log viewer: action type (CREATE/UPDATE/DELETE/EXPORT/
    REVIEW/AUTH/PAGE_VIEW/ESCALATION), actor badge, target, timestamp, filters
    (actor, action, date range), export CSV (watermarked).
  - **System** — health/readiness (`/health/ready`), DB/Neo4j status, cache
    stats, feature flags, TTL-cache invalidation trigger (admin-only), seed/reset
    actions (guarded).
- Destructive actions use the shared confirm modal pattern.

### 3.2 How it's done

- **Frontend** — `datathon/src/pages/Admin/index.tsx` (+ admin components);
  wrapped by a route-level `RequireRole`/`checkPermission('/admin')` so non-ADMIN
  never mounts. API: `getUsers`, `createUser`, `updateUser`, `deleteUser`,
  `getRoles`, `createRole`, `updateRole`, `getAuditLogs`, `getSystemHealth`,
  cache-admin helpers — all via `services/api.ts`.
- **Backend** — `routes/admin.py` (`prefix="/admin"`, **ADMIN-only router
  dependency**): user CRUD (creates require email + role_id), role CRUD, audit
  read (`audit_service`), system/health admin endpoints, TTL invalidation.
  Every mutation audited (actor = admin badge).
- `useRBAC` also lists `/admin` under `EXPLICIT_REQUIRED_PATHS` (explicit path
  checks in addition to `ROUTE_PERMISSIONS`) — keep both lists in sync.

### 3.3 Role behaviour

| Role | Page | Users | Roles | Audit read | System actions |
| ---- | :--: | :---: | :---: | :--------: | :------------: |
| ADMIN | ✅ | CRUD | CRUD | ✅ (+export) | ✅ |
| all others | ❌ (403 route + 403 API) | — | — | — | — |

---

## 4. Docs (`datathon/src/pages/Docs.tsx`)

### 4.1 What's on the page

In-product documentation hub: sectioned articles (Getting Started, Roles &
Access, Investigations, Intelligence, Analysis, AI features, Reports, Admin) with
sidebar nav, search, anchors; content sourced from `datathon/src/docs/*`
(compile-time markdown/MDX or TS modules — no backend).

### 4.2 Role behaviour

All 7 roles — static read-only content, no API calls, no gating beyond route.

---

## 5. Settings & Help (`datathon/src/pages/SettingsHelp.tsx`)

### 5.1 What's on the page

- **Profile** — current user card (name, badge, role, station/district), change
  display preferences.
- **Preferences** — theme (light/dark/system), language (i18n store —
  `setLanguage` lives in the i18n store only; `appStore` no longer carries
  `language`), density, default landing route, notification toggles.
- **Help** — keyboard shortcuts table, contact/support, version/build info,
  links to `/docs`.
- Session actions: sign out (`auth:session-expired` flow), active-session list
  where available.

### 5.2 How it's done / role behaviour

- Persisted per-user client-side (localStorage + profile PATCH when the user
  endpoint exists); no role-dependent UI except role badge display.
- All 7 roles; purely local preferences — safe for VIEWER/FORENSIC who cannot
  reach Officers/Admin.

---

## 6. Cross-cutting notes

- `/admin` is double-locked (frontend `ROUTE_PERMISSIONS` +
  `EXPLICIT_REQUIRED_PATHS`, backend router `require_roles("admin")`) — the
  pattern to replicate for any new privileged page (e.g. unlocking
  `ai-processing-section.md` routes).
- Officer writes concentrate on ADMIN (+ INSPECTOR for profile/status); FORENSIC
  and VIEWER cannot reach the officer registry at all.
- Audit viewer in Admin is the system-wide counterpart to per-page `addLog`
  entries — keep action vocabulary consistent across both.

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. -->