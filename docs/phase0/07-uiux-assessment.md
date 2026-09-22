# Phase 0 — 07 Existing UI/UX assessment

## Current state

- **Frontend:** React 18 + TypeScript 5.9 + Vite 5, Tailwind 3.4, Zustand 4.5 (5 stores), TanStack React Query, Recharts/D3, Three.js/r3f/drei, react-force-graph-3d, Mapbox, Deck.gl, Framer Motion, GSAP.
- **Pages:** ~30 page modules (`Landing`, `Login` byte-locked; `Overview`, `FIR`, `Hotspots`, `Network`, `Predictions`, `Anomalies`, `CrimeCases`, `Investigation`, `InvestigationIntelligence`, `IntelligenceFusion`, `IdentityResolution`, `Notifications`, `Offenders`, `Criminals`, `Victims`, `Officers`, `Evidence`, `Reports`, `AIChat`, `Strategic`, `Sociological`, `Admin/Settings`, `CommandCenter`, `FaceRecognition`, `Docs`).
- **Design system:** CSS custom properties (dark tactical theme, glow tokens), Inter/JetBrains Mono, reusable chart/map/network/notification components, layout `Sidebar`/`Header`.
- Recent "UI honesty" pass removed fabricated metrics (hotspot metrics, fake alerts, hardcoded `r=0.29`, fake model metadata), added deep-links (`navigate-tab` + `selected_entity_id`), per-page titles (`hooks/useTitle`).

## Assessment

- Visually strong, consistent token usage, component reuse high; `api.ts` is a single service layer. Lint/tsc/build green per AGENTS notes.

## Gaps / risks

1. **No design-system documentation** (token semantics, spacing, typography scale); tokens live only in `index.css`.
2. **No accessibility baseline** (contrast on muted text, focus management in modals/drawers, keyboard nav for graph/3D panels).
3. Responsive/tablet behavior for the side-drawer graph panels and 3D canvases is untested.
4. i18n was refactored (single source) — verify no stale `language` state remains in stores/tests.
5. `Landing`/`Login` are **byte-locked** — any future UI work must preserve them or consciously unlock.

## Phase 0 actions

- Write `docs/ui/design-system.md` from the token set + component inventory.
- Run an a11y pass (contrast, keyboard, ARIA) and record results in the audit.
- Define the byte-lock policy for Landing/Login and page-title conventions in `docs/ui/`.
- Add a smoke test suite in Vitest for critical interactions (auth flow, tab navigation, deep-link target handling).