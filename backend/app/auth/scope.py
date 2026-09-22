"""District scoping for district-bound roles.

Multi-district roles (admin, crime_analyst/SCRB, inspector, policymaker/SP) may
query any district they are authorised for. Every other role is bound to a
single district resolved from their profile; requests are silently forced to
that district, and a user with no resolvable district is denied (fail closed).

This is the server-side counterpart to the UI-level scoping in
``datathon/src/hooks/useUserScope.ts`` — the client can only *narrow* what it
sees, never widen it.
"""
from sqlalchemy.orm import Session

from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_POLICYMAKER,
)
from app.core.exceptions import ForbiddenException
from app.models.user import User

# Roles that are not tied to a single district.
MULTI_DISTRICT_ROLES = frozenset(
    {ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INSPECTOR, ROLE_POLICYMAKER}
)


def is_multi_district(user: User) -> bool:
    """True when the user's role may query any district."""
    role = getattr(user, "role", None)
    return role is not None and role.name in MULTI_DISTRICT_ROLES


def resolve_user_district(user: User, db: Session | None = None) -> str | None:
    """Resolve a user's district from ``User.district`` then the linked officer."""
    district = (getattr(user, "district", None) or "").strip()
    if district:
        return district

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

    * Multi-district roles: the caller-supplied district (may be ``None``).
    * District-bound roles: always their own district; the supplied value is
      ignored so a client can never widen scope by changing a query param.
    * District-bound roles with no district: 403 (fail closed).
    """
    if is_multi_district(user):
        return (requested_district or "").strip() or None

    district = resolve_user_district(user, db)
    if not district:
        raise ForbiddenException(
            "Your account has no assigned district. Access to district-scoped data is denied."
        )
    return district


def enforce_record_district(
    user: User, record_district: str | None, db: Session | None = None
) -> None:
    """Deny access to a single record that is outside the user's district.

    Multi-district roles always pass. A district-bound user is denied when the
    record's district differs — or when the record has no district at all
    (fail closed).
    """
    if is_multi_district(user):
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
    if is_multi_district(user):
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
    "is_multi_district",
    "resolve_user_district",
    "enforce_district_scope",
    "enforce_record_district",
    "enforce_any_record_district",
]
