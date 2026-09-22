"""Analytics-derived alert finding with an explicit human review lifecycle.

Phase 5 (issue #269): rule-driven warnings computed from analytics patterns
(category crime spikes, repeat offenders). Every finding is a *proposed lead*
— never a confirmed accusation. Lifecycle state is only changed by a reviewer
with a REVIEW_ROLES decision (confirm | investigate | dismiss), audited via
``audit_service.log_action``.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

SEVERITY_LOW = "low"
SEVERITY_MEDIUM = "medium"
SEVERITY_HIGH = "high"
SEVERITY_CRITICAL = "critical"

FINDING_STATUS_OPEN = "open"
FINDING_STATUS_IN_REVIEW = "in_review"
FINDING_STATUS_REVIEWED = "reviewed"
FINDING_STATUS_DISMISSED = "dismissed"

REVIEW_DECISIONS = ("confirm", "investigate", "dismiss")


class AlertFinding(UUIDPKMixin, Base, TimestampMixin):
    """A rule-driven finding generated from analytics patterns.

    ``grouping_key`` collapses identical findings across regenerate runs so the
    operator is not flooded, mirroring IntegrityAlert/ProxyPattern dedup.
    """

    __tablename__ = "alert_findings"

    finding_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)

    severity: Mapped[str] = mapped_column(String(20), nullable=False, default=SEVERITY_MEDIUM, index=True)
    confidence: Mapped[str] = mapped_column(String(30), nullable=False, default="INSUFFICIENT_DATA")
    provenance: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")

    current_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    baseline_count: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    spike_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    evidence: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    time_window: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)

    grouping_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    observation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default=FINDING_STATUS_OPEN, index=True)
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)


def finding_payload(f: AlertFinding) -> dict:
    """Serialize a finding for API responses (logical refs only, no paths)."""
    return {
        "id": str(f.id),
        "finding_type": f.finding_type,
        "district": f.district,
        "category": f.category,
        "entity_type": f.entity_type,
        "entity_id": str(f.entity_id) if f.entity_id else None,
        "severity": f.severity,
        "confidence": f.confidence,
        "provenance": f.provenance,
        "current_count": f.current_count,
        "baseline_count": f.baseline_count,
        "spike_ratio": f.spike_ratio,
        "evidence": f.evidence or [],
        "time_window": f.time_window,
        "explanation": f.explanation,
        "status": f.status,
        "observation_count": f.observation_count,
        "review_decision": f.review_decision,
        "review_note": f.review_note,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }