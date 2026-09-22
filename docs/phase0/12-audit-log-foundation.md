# Phase 0 — 12 Audit-log foundation

## Current state

- **Table:** `audit_logs` (user_id, action, resource_type, resource_id, details, ip_address, result, metadata_json).
- **Backend:** `app/services/audit_service.py::log_action(...)` — appended for every CREATE/UPDATE/DELETE/EXPORT (per AGENTS rule). `result` ∈ success/failure; metadata must never contain secrets.
- **Frontend:** `datathon/src/store/` `useAuditStore.addLog(...)` for UI actions; automatic page-view/action auditing via hooks.
- **Admin surface:** audit logs visible in Admin panel via `GET /api/v2/admin/audit-logs`; RBAC guards manage access.

## Assessment

- Solid write-path foundation with actor, action, resource identity, IP, result, and structured metadata — meets Phase 0 "audit-log foundation."

## Gaps / risks

1. **No retention/immutability policy** — no archival job, no integrity chaining (hash of previous entry) for tamper evidence.
2. **No read-only/export event taxonomy** formalized (EXPORT exists per rules; confirm all export endpoints route through `log_action`).
3. `metadata_json` guidance is a convention, not validated/limited — enforce a size/schema cap.
4. Frontend `addLog` is client-asserted; server logs are authoritative. Ensure UI audit is presentational only for writes the client performs.
5. No test enforcing "every write route calls log_action" — a lint/test could scan route handlers.

## Phase 0 actions

- Document audit taxonomy (`docs/security/audit-foundation.md`): action verbs, resource types, retention, integrity goal.
- Add CI test: for the golden set of write/export endpoints, assert an `AuditLog` row is produced (mirror existing permission tests).
- Add tamper-evident hash chaining or signed log option to the model (ADR decision).
- Enforce `metadata_json` size cap in schema.