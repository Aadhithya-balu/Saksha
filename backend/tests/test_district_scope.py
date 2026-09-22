"""Unit tests for server-side district scoping (app.auth.scope)."""
import pytest

from app.auth.scope import (
    enforce_district_scope,
    enforce_record_district,
    resolve_user_district,
)
from app.core.exceptions import ForbiddenException
from app.core.security import hash_password
from app.models.officer import Officer
from app.models.role import Role
from app.models.user import User


def _role(db, name):
    role = db.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=name)
        db.add(role)
        db.flush()
    return role


def _user(db, username, role_name, district=None):
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.title(),
        hashed_password=hash_password("Password123!"),
        role_id=_role(db, role_name).id,
        district=district,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_multi_district_role_keeps_requested_district(db_session):
    analyst = _user(db_session, "scope-analyst", "crime_analyst")
    assert enforce_district_scope(analyst, "Mysuru", db_session) == "Mysuru"
    assert enforce_district_scope(analyst, None, db_session) is None


def test_scoped_role_district_is_forced_regardless_of_request(db_session):
    io = _user(db_session, "scope-io", "investigator", district="Bengaluru Urban")
    assert enforce_district_scope(io, "Mysuru", db_session) == "Bengaluru Urban"
    assert enforce_district_scope(io, None, db_session) == "Bengaluru Urban"


def test_scoped_role_falls_back_to_officer_district(db_session):
    io = _user(db_session, "scope-io-2", "investigator", district=None)
    db_session.add(
        Officer(
            badge_number="IO-9001",
            name="Scope Officer",
            rank="Inspector",
            station="Whitefield",
            district="Mysuru",
            user_id=io.id,
        )
    )
    db_session.commit()
    assert resolve_user_district(io, db_session) == "Mysuru"
    assert enforce_district_scope(io, None, db_session) == "Mysuru"


def test_scoped_role_without_district_fails_closed(db_session):
    viewer = _user(db_session, "scope-viewer", "viewer", district=None)
    with pytest.raises(ForbiddenException) as exc:
        enforce_district_scope(viewer, None, db_session)
    assert exc.value.status_code == 403


def test_record_district_access(db_session):
    io = _user(db_session, "scope-io-3", "investigator", district="Bengaluru Urban")
    analyst = _user(db_session, "scope-analyst-2", "crime_analyst")

    enforce_record_district(io, "Bengaluru Urban", db_session)

    with pytest.raises(ForbiddenException):
        enforce_record_district(io, "Mysuru", db_session)
    with pytest.raises(ForbiddenException):
        enforce_record_district(io, None, db_session)

    # Multi-district roles are never restricted by record district.
    enforce_record_district(analyst, "Mysuru", db_session)
