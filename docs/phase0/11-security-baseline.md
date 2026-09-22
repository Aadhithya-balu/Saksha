# Phase 0 — 11 Security baseline

## Current state (verified)

- **Passwords:** Argon2id (`app/core/password_hashing.py`), legacy SHA-256 verifiable with seamless rehash-on-login.
- **JWTs:** HS256 via python-jose; claims `iss`/`aud`/`type`/`jti`(uuid); explicit algorithm allow-list (no confusion attacks); access 30 min + refreshing 7-day refresh tokens; revocation via `revoked_tokens` table.
- **AuthN/O:** JWT bearer dependency, RBAC (`require_roles`), district scoping that fails closed (403 if district-bound user lacks a district).
- **Brute-force:** login lockout (5 fails / 15 min, configurable).
- **Rate limiting:** per-client-IP sliding window, category budgets (default/auth/upload/AI), XFF-aware behind trusted nginx.
- **Request hardening:** `MAX_REQUEST_BODY_BYTES` cap, upload byte limits (face max image bytes), security headers module (`app/core/security_headers.py`).
- **Production guards:** startup hard-fails in `APP_ENV=production` on weak JWT entropy, open CORS, debug flags, default passwords, SQLite.
- **Data mode:** production data mode disables demo-data fallback (connectivity vs fabrication boundary).
- **Secrets:** `.env` gitignored; service role key documented as server-only.
- Tests: `test_security_hardening.py`, `test_identity_security.py`, `test_config_production.py`, `test_rbac_and_isolation.py`. `SECURITY.md` present (reporting policy).

## Assessment

- Strong, defensive, fail-closed posture with matching tests. Considerably beyond typical datathon scope.

## Gaps / risks

1. **No CI security scanning**: no `pip-audit`/`npm audit`, no SAST (bandit/semgrep/ruff security rules), no dependency CVE gate.
2. **No CSP / headers verification test** — `security_headers.py` exists; assert via tests that headers are set on responses.
3. LLM providers and Supabase keys are high-value secrets; rotation strategy undocumented.
4. Multiple instances share a bulk rate-limit store? (in-memory per instance; comment documents nginx/Redis requirement) — verify multi-instance limits are understood.
5. Uploads: file-type sniffing/allow-list for evidence files — verify enforcement beyond byte caps.

## Phase 0 actions

- Add CI scan steps: `pip-audit`, `npm audit --omit=dev`, and a SAST lint stage (ruff `S` rules or bandit) — report-only first, gate later.
- Add response-header assertion tests (HSTS, X-Content-Type-Options, CSP, referrer-policy).
- Document key rotation + incident response in `docs/security/`.
- Enumerate evidence upload allow-lists and storage isolation for production uploads (report 14).