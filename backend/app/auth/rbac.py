"""Role-Based Access Control and Capability-Based Authorization.

Usage in a route:
    @router.get("/x", dependencies=[Depends(require_roles("admin", "crime_analyst"))])
    @router.get("/y", dependencies=[Depends(require_capabilities(CAP_CASE_READ))])
"""
from typing import Any
from fastapi import Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.models.user import User

# Canonical role set for SAKSHA
ROLE_ADMIN = "admin"
ROLE_CRIME_ANALYST = "crime_analyst"
ROLE_INVESTIGATOR = "investigator"
ROLE_POLICYMAKER = "policymaker"
ROLE_INSPECTOR = "inspector"
ROLE_FORENSIC = "forensic"
ROLE_VIEWER = "viewer"

# Court-oriented roles (Issue #286)
ROLE_COURT_ADMIN = "court_admin"
ROLE_JUDICIAL_AUTHORITY = "judicial_authority"
ROLE_COURT_ANALYST = "court_analyst"

COURT_ROLES = [
    ROLE_COURT_ADMIN,
    ROLE_JUDICIAL_AUTHORITY,
    ROLE_COURT_ANALYST,
]

ALL_ROLES = [
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INVESTIGATOR,
    ROLE_POLICYMAKER,
    ROLE_INSPECTOR,
    ROLE_FORENSIC,
    ROLE_VIEWER,
    ROLE_COURT_ADMIN,
    ROLE_JUDICIAL_AUTHORITY,
    ROLE_COURT_ANALYST,
]

# Roles that can confirm/reject identity relationships, integrity alerts and
# proxy patterns. Identity is never auto-confirmed — only these reviewers can
# change lifecycle state (issue #225 section 15).
REVIEW_ROLES = [
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INVESTIGATOR,
    ROLE_INSPECTOR,
]

# Authority types (Issue #286)
AUTH_LAW_ENFORCEMENT = "LAW_ENFORCEMENT"
AUTH_COURT = "COURT"
AUTH_PROSECUTION = "PROSECUTION"
AUTH_FORENSIC = "FORENSIC"
AUTH_ANALYSIS = "ANALYSIS"
AUTH_SUPERVISORY = "SUPERVISORY"
AUTH_ADMINISTRATION = "ADMINISTRATION"
AUTH_OTHER = "OTHER"

ALL_AUTHORITIES = [
    AUTH_LAW_ENFORCEMENT,
    AUTH_COURT,
    AUTH_PROSECUTION,
    AUTH_FORENSIC,
    AUTH_ANALYSIS,
    AUTH_SUPERVISORY,
    AUTH_ADMINISTRATION,
    AUTH_OTHER,
]

# Capability definitions (Issue #286)
CAP_CASE_READ = "CASE_READ"
CAP_CASE_WRITE = "CASE_WRITE"
CAP_FIR_READ = "FIR_READ"
CAP_FIR_WRITE = "FIR_WRITE"
CAP_EVIDENCE_READ = "EVIDENCE_READ"
CAP_EVIDENCE_WRITE = "EVIDENCE_WRITE"
CAP_EVIDENCE_CUSTODY = "EVIDENCE_CUSTODY"
CAP_INTELLIGENCE_READ = "INTELLIGENCE_READ"
CAP_INTELLIGENCE_REVIEW = "INTELLIGENCE_REVIEW"
CAP_AI_FINDING_REVIEW = "AI_FINDING_REVIEW"
CAP_AI_JOB_RUN = "AI_JOB_RUN"
CAP_REPORT_GENERATE = "REPORT_GENERATE"
CAP_REPORT_EXPORT = "REPORT_EXPORT"
CAP_USER_ADMIN = "USER_ADMIN"
CAP_AUDIT_READ = "AUDIT_READ"
CAP_SYSTEM_ADMIN = "SYSTEM_ADMIN"
CAP_COURT_CASE_READ = "COURT_CASE_READ"
CAP_JUDICIAL_REPORT_READ = "JUDICIAL_REPORT_READ"
CAP_AI_CHAT_READ = "AI_CHAT_READ"

ALL_CAPABILITIES = {
    CAP_CASE_READ,
    CAP_CASE_WRITE,
    CAP_FIR_READ,
    CAP_FIR_WRITE,
    CAP_EVIDENCE_READ,
    CAP_EVIDENCE_WRITE,
    CAP_EVIDENCE_CUSTODY,
    CAP_INTELLIGENCE_READ,
    CAP_INTELLIGENCE_REVIEW,
    CAP_AI_FINDING_REVIEW,
    CAP_AI_JOB_RUN,
    CAP_REPORT_GENERATE,
    CAP_REPORT_EXPORT,
    CAP_USER_ADMIN,
    CAP_AUDIT_READ,
    CAP_SYSTEM_ADMIN,
    CAP_COURT_CASE_READ,
    CAP_JUDICIAL_REPORT_READ,
    CAP_AI_CHAT_READ,
}

# Role to default capabilities mapping
ROLE_CAPABILITIES: dict[str, set[str]] = {
    ROLE_ADMIN: set(ALL_CAPABILITIES),
    ROLE_CRIME_ANALYST: {
        CAP_CASE_READ, CAP_FIR_READ, CAP_EVIDENCE_READ, CAP_INTELLIGENCE_READ,
        CAP_INTELLIGENCE_REVIEW, CAP_AI_FINDING_REVIEW, CAP_REPORT_GENERATE,
        CAP_REPORT_EXPORT, CAP_AI_CHAT_READ,
    },
    ROLE_INVESTIGATOR: {
        CAP_CASE_READ, CAP_CASE_WRITE, CAP_FIR_READ, CAP_FIR_WRITE,
        CAP_EVIDENCE_READ, CAP_EVIDENCE_WRITE, CAP_EVIDENCE_CUSTODY,
        CAP_INTELLIGENCE_READ, CAP_REPORT_GENERATE, CAP_AI_CHAT_READ,
    },
    ROLE_INSPECTOR: {
        CAP_CASE_READ, CAP_CASE_WRITE, CAP_FIR_READ, CAP_EVIDENCE_READ,
        CAP_INTELLIGENCE_READ, CAP_REPORT_GENERATE, CAP_REPORT_EXPORT,
        CAP_AI_CHAT_READ,
    },
    ROLE_FORENSIC: {
        CAP_CASE_READ, CAP_EVIDENCE_READ, CAP_EVIDENCE_WRITE,
        CAP_REPORT_GENERATE, CAP_REPORT_EXPORT, CAP_AI_CHAT_READ,
    },
    ROLE_POLICYMAKER: {
        CAP_CASE_READ, CAP_INTELLIGENCE_READ, CAP_REPORT_GENERATE,
        CAP_REPORT_EXPORT, CAP_AI_CHAT_READ,
    },
    ROLE_VIEWER: {
        CAP_CASE_READ, CAP_REPORT_GENERATE,
    },
    ROLE_COURT_ADMIN: {
        CAP_CASE_READ, CAP_COURT_CASE_READ, CAP_EVIDENCE_READ,
        CAP_INTELLIGENCE_READ, CAP_REPORT_GENERATE, CAP_REPORT_EXPORT,
        CAP_USER_ADMIN, CAP_AUDIT_READ, CAP_AI_CHAT_READ,
    },
    ROLE_JUDICIAL_AUTHORITY: {
        CAP_CASE_READ, CAP_COURT_CASE_READ, CAP_FIR_READ, CAP_EVIDENCE_READ,
        CAP_INTELLIGENCE_READ, CAP_REPORT_GENERATE, CAP_REPORT_EXPORT,
        CAP_JUDICIAL_REPORT_READ, CAP_AI_CHAT_READ,
    },
    ROLE_COURT_ANALYST: {
        CAP_CASE_READ, CAP_COURT_CASE_READ, CAP_FIR_READ, CAP_EVIDENCE_READ,
        CAP_INTELLIGENCE_READ, CAP_REPORT_GENERATE, CAP_AI_CHAT_READ,
    },
}


def get_user_authority(user: User) -> str:
    """Return the primary authority type for a user."""
    org = getattr(user, "organization", None)
    if org and org.authority_type:
        return org.authority_type

    role_name = getattr(getattr(user, "role", None), "name", "")
    if role_name in COURT_ROLES:
        return AUTH_COURT
    if role_name == ROLE_FORENSIC:
        return AUTH_FORENSIC
    if role_name == ROLE_ADMIN:
        return AUTH_ADMINISTRATION
    if role_name in (ROLE_CRIME_ANALYST, ROLE_POLICYMAKER):
        return AUTH_ANALYSIS
    return AUTH_LAW_ENFORCEMENT


def get_user_capabilities(user: User, db: Session | None = None) -> set[str]:
    """Resolve all active capabilities for a user."""
    role = getattr(user, "role", None)
    if not role:
        return set()

    # Check custom role permissions if DB available
    if db is not None:
        try:
            from app.routes.admin import RolePermission
            persisted = db.query(RolePermission.permission).filter(RolePermission.role_id == role.id).all()
            if persisted:
                persisted_caps = {p[0] for p in persisted if p[0] in ALL_CAPABILITIES}
                if persisted_caps:
                    return persisted_caps
        except Exception:
            pass

    return set(ROLE_CAPABILITIES.get(role.name, set()))


def has_capability(user: User, capability: str, db: Session | None = None) -> bool:
    """True when user possesses the given capability."""
    caps = get_user_capabilities(user, db)
    return capability in caps


def require_roles(*allowed_roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in allowed_roles:
            raise ForbiddenException(
                f"Role '{current_user.role.name}' is not permitted to perform this action"
            )
        return current_user

    return dependency


def require_capabilities(*required_capabilities: str):
    """Require the user to have at least one of the specified capabilities."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_caps = get_user_capabilities(current_user)
        if not any(cap in user_caps for cap in required_capabilities):
            raise ForbiddenException(
                f"User lacks required capability ({', '.join(required_capabilities)}) for this action"
            )
        return current_user

    return dependency


def require_any_authenticated_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
