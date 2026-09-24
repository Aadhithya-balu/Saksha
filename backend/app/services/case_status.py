"""Canonical CrimeCase status definitions and centralized transition validation.

Issue #252: Immutable Crime/Case Status.

This is the SINGLE source of truth for:
  - Valid status values
  - Allowed transitions
  - Immutable (locked) statuses that cannot be overwritten by normal users

All update paths (crimes.py, crime_cases.py, ingest_service.py, network) must
call ``validate_transition`` before persisting a status change.
"""
from __future__ import annotations

from app.core.exceptions import AppException
from fastapi import status as http_status

# ---------------------------------------------------------------------------
# Canonical status values
# ---------------------------------------------------------------------------

STATUS_ACTIVE = "active"
STATUS_UNDER_INVESTIGATION = "under_investigation"
STATUS_ARRESTED = "arrested"
STATUS_CHARGESHEETED = "chargesheeted"
STATUS_CONVICTED = "convicted"
STATUS_CLOSED = "closed"

# Legacy values that exist in the database from before this issue.
# They are preserved as-is and mapped to canonical equivalents for transition
# logic only — we never blindly overwrite them.
_LEGACY_TO_CANONICAL: dict[str, str] = {
    "open": STATUS_ACTIVE,
    "unsolved": STATUS_ACTIVE,
    "assigned": STATUS_ACTIVE,
    "investigating": STATUS_UNDER_INVESTIGATION,
    "evidence collected": STATUS_UNDER_INVESTIGATION,
    "charge sheet filed": STATUS_CHARGESHEETED,
    "charge_sheeted": STATUS_CHARGESHEETED,
    "closed": STATUS_CLOSED,
    "compounded": STATUS_CLOSED,
    # Already-canonical values map to themselves
    STATUS_ACTIVE: STATUS_ACTIVE,
    STATUS_UNDER_INVESTIGATION: STATUS_UNDER_INVESTIGATION,
    STATUS_ARRESTED: STATUS_ARRESTED,
    STATUS_CHARGESHEETED: STATUS_CHARGESHEETED,
    STATUS_CONVICTED: STATUS_CONVICTED,
    STATUS_CLOSED: STATUS_CLOSED,
}

# All values accepted by the API (canonical + legacy for backward compat)
ALL_VALID_STATUSES: frozenset[str] = frozenset(_LEGACY_TO_CANONICAL.keys())

# Statuses that are IMMUTABLE once set — no normal user may overwrite them.
# Admin-only override is intentionally not implemented: the requirement states
# that once ARRESTED is recorded it must not be modifiable through normal editing.
IMMUTABLE_STATUSES: frozenset[str] = frozenset({STATUS_ARRESTED, STATUS_CONVICTED})

# ---------------------------------------------------------------------------
# Transition table  (from_canonical -> set of allowed to_canonical)
# ---------------------------------------------------------------------------

_ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    STATUS_ACTIVE: frozenset({STATUS_UNDER_INVESTIGATION, STATUS_ARRESTED, STATUS_CLOSED}),
    STATUS_UNDER_INVESTIGATION: frozenset({STATUS_ARRESTED, STATUS_CHARGESHEETED, STATUS_CLOSED}),
    STATUS_ARRESTED: frozenset({STATUS_CHARGESHEETED}),          # ARRESTED is immutable — only forward
    STATUS_CHARGESHEETED: frozenset({STATUS_CONVICTED, STATUS_CLOSED}),
    STATUS_CONVICTED: frozenset({STATUS_CLOSED}),
    STATUS_CLOSED: frozenset(),                                   # terminal
}


class InvalidStatusTransitionError(AppException):
    """Raised when a requested status transition violates the business rules."""

    def __init__(self, from_status: str, to_status: str, reason: str | None = None) -> None:
        self.from_status = from_status
        self.to_status = to_status
        default_reason = (
            f"Status transition from '{from_status}' to '{to_status}' is not permitted."
        )
        super().__init__(
            message=reason or default_reason,
            code="INVALID_STATUS_TRANSITION",
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


def _canonical(raw: str | None) -> str:
    """Map a raw (possibly legacy) status string to its canonical equivalent."""
    if raw is None:
        return STATUS_ACTIVE
    return _LEGACY_TO_CANONICAL.get(raw.strip().lower(), raw.strip().lower())


def validate_transition(current_status: str | None, new_status: str) -> str:
    """Validate and return the canonical form of *new_status*.

    Raises ``InvalidStatusTransitionError`` when:
    - *new_status* is not a recognised value.
    - The current status is immutable (ARRESTED / CONVICTED) and the requested
      new status is not the single allowed forward step.
    - The transition is not in the allowed-transitions table.
    - The transition is a no-op (same canonical status).

    Returns the canonical string for *new_status* so callers can persist it.
    """
    new_canonical = _canonical(new_status)
    if new_canonical not in _ALLOWED_TRANSITIONS:
        raise InvalidStatusTransitionError(
            current_status or "none",
            new_status,
            f"'{new_status}' is not a recognised case status. "
            f"Valid values: {sorted(ALL_VALID_STATUSES)}",
        )

    # No current status means this is a creation — any non-immutable initial
    # status is fine (ARRESTED/CONVICTED cannot be set at creation time).
    if current_status is None:
        if new_canonical in IMMUTABLE_STATUSES:
            raise InvalidStatusTransitionError(
                "none",
                new_status,
                f"Cannot create a case with status '{new_status}'. "
                "Cases must start as active or under_investigation.",
            )
        return new_canonical

    current_canonical = _canonical(current_status)

    # No-op: same canonical status
    if current_canonical == new_canonical:
        raise InvalidStatusTransitionError(
            current_status,
            new_status,
            f"Case is already in status '{current_status}'. No update needed.",
        )

    # Immutability guard: once ARRESTED (or CONVICTED), only the single
    # forward step is allowed — any other change is rejected.
    if current_canonical in IMMUTABLE_STATUSES:
        allowed = _ALLOWED_TRANSITIONS[current_canonical]
        if new_canonical not in allowed:
            raise InvalidStatusTransitionError(
                current_status,
                new_status,
                f"Case status '{current_status}' is locked. "
                f"The only permitted transition is: {sorted(allowed) or 'none (terminal)'}.",
            )

    allowed_from_current = _ALLOWED_TRANSITIONS.get(current_canonical, frozenset())
    if new_canonical not in allowed_from_current:
        raise InvalidStatusTransitionError(
            current_status,
            new_status,
            f"Transition from '{current_status}' to '{new_status}' is not allowed. "
            f"Permitted next statuses: {sorted(allowed_from_current) or 'none (terminal)'}.",
        )

    return new_canonical


def is_immutable(status: str | None) -> bool:
    """Return True when the given status is locked against normal edits."""
    return _canonical(status) in IMMUTABLE_STATUSES


def status_display_label(status: str | None) -> str:
    """Human-readable label for a status value (used in audit details)."""
    labels = {
        STATUS_ACTIVE: "Active",
        STATUS_UNDER_INVESTIGATION: "Under Investigation",
        STATUS_ARRESTED: "Arrested",
        STATUS_CHARGESHEETED: "Chargesheeted",
        STATUS_CONVICTED: "Convicted",
        STATUS_CLOSED: "Closed",
        # legacy
        "open": "Open (Active)",
        "assigned": "Assigned (Active)",
        "investigating": "Investigating",
        "evidence collected": "Evidence Collected",
        "charge sheet filed": "Charge Sheet Filed",
    }
    return labels.get((status or "").lower(), status or "unknown")
