"""District and Multi-Authority scoping for authorized users.

Multi-district roles (admin, crime_analyst/SCRB, inspector, policymaker/SP) may
query any district they are authorised for. Every other role is bound to a
single district resolved from their profile; requests are silently forced to
that district, and a user with no resolvable district is denied (fail closed).

Court authorities (court_admin, judicial_authority, court_analyst) operate
under jurisdiction/case-level access grants rather than police station bindings.

This is the server-side counterpart to the UI-level scoping in
``datathon/src/hooks/useUserScope.ts`` — the client can only *narrow* what it
sees, never widen it.
"""
import uuid
from sqlalchemy.orm import Session

from app.auth.rbac import (
    COURT_ROLES,
    ROLE_ADMIN,
    ROLE_COURT_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_POLICYMAKER,
    get_user_authority,
)
from app.core.exceptions import ForbiddenException
from app.models.user import User

# Roles that are not tied to a single district.
MULTI_DISTRICT_ROLES = frozenset(
    {ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INSPECTOR, ROLE_POLICYMAKER, ROLE_COURT_ADMIN}
)


def is_court_user(user: User) -> bool:
    """True when user belongs to a court authority or holds a court role."""
    role = getattr(user, "role", None)
    if role and role.name in COURT_ROLES:
        return True
    return get_user_authority(user) == "COURT"


def is_multi_district(user: User) -> bool:
    """True when the user's role may query any district."""
    role = getattr(user, "role", None)
    if role is not None and role.name in MULTI_DISTRICT_ROLES:
        return True
    if is_court_user(user):
        scope_level = getattr(user, "scope_level", "DISTRICT")
        if scope_level in ("GLOBAL", "JURISDICTION"):
            return True
    return False


def resolve_user_district(user: User, db: Session | None = None) -> str | None:
    """Resolve a user's district from ``User.district`` then the linked officer."""
    district = (getattr(user, "district", None) or "").strip()
    if district:
        return district

    jurisdiction = (getattr(user, "jurisdiction", None) or "").strip()
    if jurisdiction:
        return jurisdiction

    officer = None
    if db is not None:
        from app.models.officer import Officer

        officer = db.query(Officer).filter(Officer.user_id == user.id).first()
    else:
        try:
            officer = user.officer_profile
        except Exception:  # noqa: BLE001 — detached instance / lazy-load failure
            officer = None

    officer_district = (getattr(officer, "district", None) or "").strip()
    return officer_district or None


def enforce_district_scope(
    user: User, requested_district: str | None = None, db: Session | None = None
) -> str | None:
    """Return the effective district filter for a read.

    * Multi-district roles / Court authority: the caller-supplied district (may be ``None``).
    * District-bound roles: always their own district; the supplied value is
      ignored so a client can never widen scope by changing a query param.
    * District-bound roles with no district: 403 (fail closed).
    """
    if is_multi_district(user) or is_court_user(user):
        return (requested_district or "").strip() or None

    district = resolve_user_district(user, db)
    if not district:
        raise ForbiddenException(
            "Your account has no assigned district. Access to district-scoped data is denied."
        )
    return district


def check_case_access(user: User, case_id: uuid.UUID, db: Session) -> bool:
    """Check whether a user has authority to access a specific case."""
    role = getattr(user, "role", None)
    if role and role.name == ROLE_ADMIN:
        return True

    from app.models.crime import CrimeCase
    case = db.query(CrimeCase).filter(CrimeCase.id == case_id).first()
    if not case:
        return False

    # Check case_access table for explicit organizational grant
    org_id = getattr(user, "organization_id", None)
    if org_id:
        from app.models.case_access import CaseAccess
        grant = (
            db.query(CaseAccess)
            .filter(
                CaseAccess.case_id == case_id,
                CaseAccess.organization_id == org_id,
                CaseAccess.status == "active",
            )
            .first()
        )
        if grant:
            return True

    if is_court_user(user):
        scope_level = getattr(user, "scope_level", "DISTRICT")
        if scope_level == "GLOBAL":
            return True
        return False

    # Multi-district roles have global district read
    if is_multi_district(user):
        return True

    # District-bound police check
    own_district = resolve_user_district(user, db)
    case_district = case.location.district if case.location else None
    if own_district and case_district and own_district == case_district:
        return True

    return False


def enforce_record_district(
    user: User, record_district: str | None, db: Session | None = None
) -> None:
    """Deny access to a single record that is outside the user's district.

    Multi-district roles always pass. A district-bound user is denied when the
    record's district differs — or when the record has no district at all
    (fail closed).
    """
    if is_multi_district(user) or is_court_user(user):
        return

    own = resolve_user_district(user, db)
    if not own:
        raise ForbiddenException(
            "Your account has no assigned district. Access to district-scoped data is denied."
        )

    record = (record_district or "").strip()
    if not record or record != own:
        raise ForbiddenException(
            "This record belongs to another district and is outside your scope."
        )


def enforce_any_record_district(
    user: User, record_districts, db: Session | None = None
) -> None:
    """Deny access unless at least one associated record is in the user's district.

    Used for entities whose district is derived from links (criminals, victims)
    that may span several cases. Multi-district roles always pass.
    """
    if is_multi_district(user) or is_court_user(user):
        return

    own = resolve_user_district(user, db)
    if not own:
        raise ForbiddenException(
            "Your account has no assigned district. Access to district-scoped data is denied."
        )

    if not any(((d or "").strip()) == own for d in record_districts):
        raise ForbiddenException(
            "This record belongs to another district and is outside your scope."
        )


__all__ = [
    "MULTI_DISTRICT_ROLES",
    "is_court_user",
    "is_multi_district",
    "resolve_user_district",
    "enforce_district_scope",
    "enforce_record_district",
    "enforce_any_record_district",
    "check_case_access",
]
