"""Writes an AuditLog row for every write action (CREATE/UPDATE/DELETE)."""
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def log_action(
    db: Session,
    user: User | None = None,
    action: str = "",
    resource_type: str = "",
    resource_id: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
    *,
    current_user: User | None = None,
    result: str = "success",
    metadata_json: str | None = None,
) -> AuditLog:
    """Append an audit event.

    ``result`` is ``success``/``failure``. ``metadata_json`` is compact JSON
    only — never include passwords, tokens, secrets, or full sensitive payloads.
    """
    effective_user = user or current_user
    if effective_user is None:
        raise ValueError("User must be provided to log_action")

    from app.auth.rbac import get_user_authority

    org_id = getattr(effective_user, "organization_id", None)
    authority = get_user_authority(effective_user)

    entry = AuditLog(
        user_id=effective_user.id,
        organization_id=org_id,
        authority_type=authority,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        result=result,
        meta_data=metadata_json,
    )
    db.add(entry)
    db.flush()
    return entry