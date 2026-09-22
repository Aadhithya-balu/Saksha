# Phase 0 — 08 Dependency audit

## Current state

### Backend (`backend/requirements.txt`, Python 3.12)
| Group | Packages (bounded) |
|---|---|
| API/DB | fastapi≥0.115, uvicorn, sqlalchemy≥2.0.35, psycopg2-binary, alembic≥1.13.2, pydantic≥2.12.5, pydantic-settings |
| Auth/security | python-jose[cryptography], argon2-cffi, email-validator |
| ML | numpy<2.0, joblib<2.0, pandas<3.0, h3<4.0, scikit-learn<2.0, lightgbm<5.0, xgboost |
| Doc/geo/vision | PyPDF2, pymediainfo, fpdf2, python-docx, openpyxl, opencv-python-headless, Pillow |
| Infra | neo4j, loguru, httpx, python-dotenv, pytest |
| Test/dev | `requirements-dev.txt` (separate) |

Version bounds are carefully set (pandas<3, numpy<2, sklearn<2) — deliberate and good.

### Frontend (`datathon/package.json`, Node 20)
- ~21 runtime deps (react 18, three/r3f/drei, recharts, d3, deck.gl, mapbox, face-api, framer-motion, zustand, axios).
- ~19 devDeps (vite 5, typescript 5.9, vitest 3, testing-library, eslint 8, tailwind). `react-force-graph-3d` is pinned `*` (wildcard — risk).

### Tooling
- `ruff.toml` (strict baseline, documented per-file ignores), `pytest.ini` (strict markers), ESLint 8 + `@typescript-eslint` + unused-imports plugin, `tsc` typecheck.

## Assessment

- Clean split runtime/dev, version-cap-bounded ML stack, repeatable `npm ci`. Good hygiene overall.

## Gaps / risks

1. **No Python lockfile / hash pinning** (`pip freeze` vs requirements drift; supply-chain risk).
2. **`react-force-graph-3d: "*"`** unpinned — lockfile will hold it, but the manifest should cap it.
3. **No automated vulnerability scanning** in CI (`pip-audit`, `npm audit`) — see report 11.
4. Jobs for legacy tooling: several packages (GSAP, D3, Deck.gl) are used only partially; consider TreeShaking flags (none set in Vite config currently).
5. `skills-lock.json` at root is an unusual artifact — confirm its provenance.

## Phase 0 actions

- Generate `backend/requirements.lock` (with `--hash` if feasible) or adopt `uv`/`pip-tools` compile; document regeneration command.
- Pin `react-force-graph-3d` to a major version in `package.json`; verify `package-lock.json` in sync (`npm ci`).
- Add `pip-audit` and `npm audit --omit=dev` steps to CI (non-blocking report or blocking gate by policy).