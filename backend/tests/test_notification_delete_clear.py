"""Notification hard-delete, bulk broadcast clear, and list-filter behavior.

Covers:
- dismissed rows no longer surface in the message list
- status == "broadcast" list filter
- hard-delete of a single notification (removes broadcast fan-out copies too)
- bulk clear of all broadcasts
"""
from app.auth.dependencies import get_current_user
from app.core.security import hash_password
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.schemas.notification import NotificationCreate
from app.services.notifications.notification_service import (
    clear_broadcast_notifications,
    create_broadcast_notification,
    create_notification,
    delete_notification,
    dismiss_notification,
    get_notifications,
)

NOTIF = "/api/v2/notifications"


def _role(db_session, name: str = "investigator") -> Role:
    role = db_session.query(Role).filter_by(name=name).first()
    if role is None:
        role = Role(name=name, description=name.title())
        db_session.add(role)
        db_session.flush()
    return role


def _active_user(db_session, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        full_name=username.title(),
        hashed_password=hash_password("Password123!"),
        role_id=_role(db_session).id,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


def _broadcast_payload(subject: str = "CRITICAL MASS ALERT") -> NotificationCreate:
    return NotificationCreate(
        sender_id=None,
        recipient_id=None,
        subject=subject,
        notification_type="alert",
        category="emergency_broadcast",
        title=subject,
        message="Broadcast to all stations",
        severity="critical",
        priority="critical",
        is_broadcast=True,
    )


# ---------------------------------------------------------------------------
# Service-level behavior
# ---------------------------------------------------------------------------


def test_dismissed_direct_notification_hidden_from_list(db_session):
    user_a = _active_user(db_session, "USER-DISMISS-A")
    db_session.commit()

    notif = create_notification(
        db_session,
        NotificationCreate(
            recipient_id=user_a.id,
            notification_type="message",
            category="administrative",
            subject="Dismiss me",
            title="Dismiss me",
            message="hidden after dismissal",
        ),
    )
    db_session.commit()

    assert get_notifications(db_session, user_a.id).total == 1

    dismiss_notification(db_session, notif.id, user_a.id)
    db_session.commit()

    listed = get_notifications(db_session, user_a.id)
    assert listed.total == 0
    assert all(n.subject != "Dismiss me" for n in listed.results)


def test_broadcast_status_filter_returns_only_broadcasts(db_session):
    user_a = _active_user(db_session, "USER-BC-A")
    _active_user(db_session, "USER-BC-B")
    db_session.commit()

    create_broadcast_notification(db_session, _broadcast_payload())
    create_notification(
        db_session,
        NotificationCreate(
            recipient_id=user_a.id,
            notification_type="message",
            category="administrative",
            subject="Direct note",
            title="Direct note",
            message="personal",
        ),
    )
    db_session.commit()

    listed = get_notifications(db_session, user_a.id, status="broadcast")
    assert listed.total == 1
    assert listed.results[0].is_broadcast is True
    assert listed.results[0].subject == "CRITICAL MASS ALERT"


def test_delete_broadcast_removes_all_fan_out_copies(db_session):
    user_a = _active_user(db_session, "USER-DEL-A")
    _active_user(db_session, "USER-DEL-B")
    db_session.commit()

    copies = create_broadcast_notification(db_session, _broadcast_payload())
    db_session.commit()
    assert len(copies) == 2

    deleted = delete_notification(db_session, copies[0].id, user_a.id)
    db_session.commit()
    assert deleted == 2
    assert db_session.query(Notification).filter(Notification.is_broadcast.is_(True)).count() == 0


def test_clear_broadcast_notifications_keeps_direct(db_session):
    user_a = _active_user(db_session, "USER-CLR-A")
    _active_user(db_session, "USER-CLR-B")
    db_session.commit()

    create_broadcast_notification(db_session, _broadcast_payload())
    direct = create_notification(
        db_session,
        NotificationCreate(
            recipient_id=user_a.id,
            notification_type="message",
            category="administrative",
            subject="Keep me",
            title="Keep me",
            message="direct",
        ),
    )
    db_session.commit()

    cleared = clear_broadcast_notifications(db_session)
    db_session.commit()
    assert cleared == 2
    assert db_session.query(Notification).filter(Notification.is_broadcast.is_(True)).count() == 0

    remaining = db_session.query(Notification).filter(Notification.id == direct.id).first()
    assert remaining is not None
    assert get_notifications(db_session, user_a.id).total == 1


def test_broadcast_stored_and_visible_to_sender(db_session):
    """The sender must always see their own broadcast (never a silent loss)."""
    sender = _active_user(db_session, "USER-SENDER")
    _active_user(db_session, "USER-SENDER-RCPT")
    db_session.commit()

    create_broadcast_notification(db_session, _broadcast_payload())
    db_session.commit()

    listed = get_notifications(db_session, sender.id)
    assert listed.total == 1
    assert listed.results[0].is_broadcast is True
    assert listed.results[0].subject == "CRITICAL MASS ALERT"


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------


def test_delete_single_notification_endpoint(client, db_session):
    user = _active_user(db_session, "USER-API-DEL")
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user

    created = client.post(
        NOTIF,
        json={
            "recipient_id": user.username,
            "subject": "Delete me via API",
            "title": "Delete me via API",
            "message": "permanent delete test",
            "notification_type": "message",
        },
    ).json()

    resp = client.delete(f"{NOTIF}/{created['id']}/remove")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    listed = client.get(f"{NOTIF}").json()
    assert all(n["id"] != created["id"] for n in listed["results"])

    client.app.dependency_overrides.pop(get_current_user, None)


def test_clear_broadcasts_endpoint(client, db_session):
    user = _active_user(db_session, "USER-API-CLR")
    recipient = _active_user(db_session, "USER-API-RCPT")
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user

    client.post(
        NOTIF,
        json={
            "recipient_id": str(recipient.id),
            "subject": "Read me directly",
            "title": "Read me directly",
            "message": "direct message",
            "notification_type": "message",
        },
    )
    broadcast = client.post(
        NOTIF,
        json={
            "subject": "Bulk clear alert",
            "title": "Bulk clear alert",
            "message": "removed by clear",
            "notification_type": "alert",
            "category": "emergency_broadcast",
            "priority": "critical",
            "severity": "critical",
            "is_broadcast": True,
        },
    )
    assert broadcast.status_code == 200

    resp = client.delete(f"{NOTIF}/clear?scope=broadcasts")
    assert resp.status_code == 200
    assert "0" not in resp.json()["message"]

    listed = client.get(f"{NOTIF}?page_size=100").json()
    assert all(n["subject"] != "Bulk clear alert" for n in listed["results"])
    assert listed["total"] == 0  # sender's own broadcast copy is removed too

    # The direct message was stored for the recipient and survives.
    details = get_notifications(db_session, recipient.id)
    assert sum(1 for n in details.results if n.subject == "Read me directly") == 1

    client.app.dependency_overrides.pop(get_current_user, None)


def test_non_broadcast_role_cannot_create_broadcast(client, db_session):
    """Only admin/SCRB/IO/INSPECTOR may broadcast (issue #282 RBAC gate)."""
    user = _active_user(db_session, "USER-VIEW-BC")
    user.role_id = _role(db_session, name="viewer").id
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user
    try:
        resp = client.post(
            NOTIF,
            json={
                "subject": "Viewer broadcasts",
                "title": "Viewer broadcasts",
                "message": "must be refused",
                "notification_type": "alert",
                "category": "emergency_broadcast",
                "priority": "critical",
                "severity": "critical",
                "is_broadcast": True,
            },
        )
        assert resp.status_code == 403, resp.text
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_non_broadcast_role_cannot_delete_or_clear(client, db_session):
    """readers/forensics may not hard-delete or clear broadcasts (issue #282)."""
    user = _active_user(db_session, "USER-VIEW-DEL")
    user.role_id = _role(db_session, name="viewer").id
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: user

    writer = _active_user(db_session, "USER-WRITER-DEL")
    db_session.commit()
    client.app.dependency_overrides[get_current_user] = lambda: writer
    created = client.post(
        NOTIF,
        json={"recipient_id": writer.username, "subject": "Guard", "title": "Guard", "message": "keep"},
    ).json()

    client.app.dependency_overrides[get_current_user] = lambda: user
    assert client.delete(f"{NOTIF}/{created['id']}/remove").status_code == 403
    assert client.delete(f"{NOTIF}/clear?scope=broadcasts").status_code == 403

    client.app.dependency_overrides.pop(get_current_user, None)