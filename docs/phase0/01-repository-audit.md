# Phase 0 — 01 Repository audit

## Current state

- Single repo `Aadhithya-balu/Saksha` (local clone `C:\Saksha_Datathon`), MIT license, workspace root `package.json`.
- Top-level dirs: `backend/`, `datathon/`, `scripts/`, `docker/`, `monitoring/`, `mlflow/`, `docs/`, `backups/`, `logs/`, `.github/`, `.agents/`.
- VCS hygiene verified: `.gitignore` excludes `.env`, `*.db`, `backend/uploads/`, `logs/`, caches, `node_modules`, `dist`. `.env*` variants ignored except `.env.example`.
- Docs: `README.md`, `README2.md`, `About.md`, `IMPLEMENTATION.md`, `Version-2.md`, `CONTEXT.md`, `TESTING.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `agent_rules.md`, `Merge_rules`, `V3-PROPOSED.md`, `docs/{ai,network,operations,validation}`.
- Recent commits show active hardening pass (district scoping, UI honesty, RBAC single-source, Sentinel real-data, attachment lifecycle).

## Assessment

- Structure is clear and follows the convention in `CONTEXT.md` § Repository Layout. Git tree clean (`git status` empty aside from this phase's new docs).
- Working tree is on a feature/merge history with no V3 branch yet — V3 phases should branch from `main`.

## Gaps / risks

1. **Duplicate/marketing docs at root**: `README2.md`, `About.md`, `Version-2.md`, `V3-PROPOSED.md` overlap. `V3-PROPOSED.md` is the vision doc (keep); others should be consolidated or clearly labelled.
2. **Stray scripts at `backend/` root**: `test_api*.py`, `test_*.py`, `get_user.py`, `list_users.py`, `check_*.py`, `add_test_users.py`, `_tmp_check.py`, `saksha.db`, `saksha_fallback.db` live next to the package. Tests belong under `backend/tests/`, ad-hoc scripts under `backend/scripts/`. `.db` files are gitignored but still pollute the working dir.
3. **`backups/` is empty** — see report 20.
4. **`skills-lock.json`** at root — verify it is intentional.

## Phase 0 actions

- Create an ADR/`docs/phase0` index and archive obsolete root docs.
- Move or delete stray `backend/` root scripts; keep only `tests/` and `scripts/`.
- Add a `docs/glossary.md` and a V3 branch policy note.
- Baseline SHA-256 for byte-locked Landing/Login if not already recorded.