"""
Notification routes — inter-station communication center endpoints.

Provides:
- GET /notifications — list notifications (paginated, filterable)
- GET /notifications/count — unread notification counts
- GET /notifications/recent — recent notifications for bell dropdown
- GET /notifications/dashboard — dashboard summary cards
- POST /notifications — create a new notification (Inform Station)
- PUT /notifications/{id}/read — mark single notification as read
- PUT /notifications/read-all — mark all notifications as read
- PUT /notifications/{id}/acknowledge — acknowledge a notification
- PUT /notifications/{id}/resolve — resolve a notification
- DELETE /notifications/{id} — dismiss a notification
- DELETE /notifications/{id}/remove — permanently delete a notification
- DELETE /notifications/clear — bulk remove all broadcasts
- GET /notifications/activity-feed — unified activity feed
- GET /notifications/live-timeline — live event timeline
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_CRIME_ANALYST,
    ROLE_INSPECTOR,
    ROLE_INVESTIGATOR,
    ALL_ROLES,
    require_roles,
)
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.notification import (
    ActivityFeedOut,
    NotificationActionOut,
    NotificationCountOut,
    NotificationCreate,
    NotificationDashboardSummary,
    NotificationListOut,
    NotificationOut,
)
from app.services.notifications import (
    activity_service,
    notification_service,
)
from app.services.ttl_cache import ttl_cached

router = APIRouter(prefix="/notifications", tags=["Notifications"], dependencies=[Depends(require_roles(*ALL_ROLES))])

# Roles allowed to broadcast to all stations and to permanently remove or
# bulk-clear notifications (issue #282 §26 — destructive/global actions must
# not be available to read-only roles such as VIEWER).
_BROADCAST_ROLES = (ROLE_ADMIN, ROLE_CRIME_ANALYST, ROLE_INVESTIGATOR, ROLE_INSPECTOR)


@router.get("", response_model=NotificationListOut)
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    notification_type: str | None = Query(None),
    severity: str | None = Query(None),
    priority: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    sender_id: str | None = Query(None),
    search: str | None = Query(None),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated notifications for the current user."""
    return notification_service.get_notifications(
        db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        notification_type=notification_type,
        severity=severity,
        priority=priority,
        category=category,
        status=status,
        sender_id=sender_id,
        search=search,
        unread_only=unread_only,
    )


@router.get("/count", response_model=NotificationCountOut)
def get_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get unread notification counts for the bell indicator."""
    return ttl_cached(
        "notifications:count",
        (current_user.id,),
        15,
        lambda: notification_service.get_unread_count(db, current_user.id),
        scope=db.get_bind(),
    )


@router.get("/recent", response_model=list[NotificationOut])
def get_recent_notifications(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recent notifications for the bell dropdown."""
    def _load():
        data = notification_service.get_recent_notifications(db, current_user.id, limit)
        return [NotificationOut.model_validate(d).model_dump(mode="json") for d in data]

    return ttl_cached(
        "notifications:recent",
        (current_user.id, limit),
        15,
        _load,
        scope=db.get_bind(),
    )


@router.get("/dashboard", response_model=NotificationDashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard summary cards for the communication center."""
    return ttl_cached(
        "notifications:dashboard",
        (current_user.id,),
        30,
        lambda: notification_service.get_dashboard_summary(db, current_user.id),
        scope=db.get_bind(),
    )


@router.post("", response_model=NotificationOut)
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new notification (Inform Station)."""
    payload.sender_id = current_user.id

    if payload.is_broadcast:
        role_name = current_user.role.name if current_user.role else None
        if role_name not in _BROADCAST_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Broadcast requires an authorized review role",
            )
        # Store a copy for the sender too so the broadcast is never lost when
        # no other stations are active.
        notifications = notification_service.create_broadcast_notification(db, payload)
        if notifications:
            enriched = notification_service._enrich_notification(notifications[0], db)
            return NotificationOut.model_validate(enriched)
    else:
        # Direct messages need an addressable recipient — never persist a row
        # that no user's message list could retrieve.
        resolved = notification_service._resolve_recipient_id(payload.recipient_id, db)
        if resolved is None:
            raise HTTPException(
                status_code=400,
                detail="Recipient not found — enter a valid station/officer badge",
            )
        notification = notification_service.create_notification(db, payload)
        enriched = notification_service._enrich_notification(notification, db)
        return NotificationOut.model_validate(enriched)

    raise HTTPException(status_code=400, detail="Failed to create notification")


@router.put("/{notification_id}/read", response_model=NotificationActionOut)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    result = notification_service.mark_notification_read(
        db, notification_id, current_user.id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationActionOut(success=True, message="Notification marked as read")


@router.put("/read-all", response_model=NotificationActionOut)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all unread notifications as read."""
    count = notification_service.mark_all_read(db, current_user.id)
    return NotificationActionOut(
        success=True,
        message=f"{count} notification(s) marked as read",
    )


@router.delete("/clear", response_model=NotificationActionOut, dependencies=[Depends(require_roles(*_BROADCAST_ROLES))])
def clear_notifications(
    scope: str = Query("broadcasts", description="broadcasts only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-remove notifications (currently removes all broadcasts)."""
    if scope not in ("broadcasts",):
        raise HTTPException(status_code=400, detail=f"Unsupported clear scope: {scope}")
    count = notification_service.clear_broadcast_notifications(db)
    db.commit()
    return NotificationActionOut(
        success=True,
        message=f"{count} broadcast notification(s) removed",
    )


@router.put("/{notification_id}/acknowledge", response_model=NotificationActionOut)
def acknowledge_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge a notification."""
    result = notification_service.acknowledge_notification(
        db, notification_id, current_user.id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationActionOut(success=True, message="Notification acknowledged")


@router.put("/{notification_id}/resolve", response_model=NotificationActionOut)
def resolve_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve a notification."""
    result = notification_service.resolve_notification(
        db, notification_id, current_user.id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationActionOut(success=True, message="Notification resolved")


@router.delete("/{notification_id}", response_model=NotificationActionOut)
def dismiss_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismiss (soft-delete) a notification."""
    result = notification_service.dismiss_notification(
        db, notification_id, current_user.id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationActionOut(success=True, message="Notification dismissed")


@router.delete("/{notification_id}/remove", response_model=NotificationActionOut, dependencies=[Depends(require_roles(*_BROADCAST_ROLES))])
def remove_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a notification (and all broadcast copies)."""
    count = notification_service.delete_notification(
        db, notification_id, current_user.id
    )
    db.commit()
    if count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationActionOut(
        success=True,
        message=f"{count} notification record(s) removed",
    )


@router.get("/activity-feed", response_model=ActivityFeedOut)
def get_activity_feed(
    limit: int = Query(50, ge=1, le=200),
    event_type: str | None = Query(None),
    resource_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get unified activity feed from audit logs, notifications, and evidence timeline."""
    return activity_service.get_activity_feed(
        db,
        user_id=current_user.id,
        limit=limit,
        event_type=event_type,
        resource_type=resource_type,
    )


@router.get("/live-timeline")
def get_live_timeline(
    case_id: uuid.UUID | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get live event timeline, optionally filtered by case_id."""
    return activity_service.get_live_event_timeline(
        db,
        case_id=case_id,
        limit=limit,
    )
