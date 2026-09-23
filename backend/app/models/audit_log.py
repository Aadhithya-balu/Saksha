"""Audit logs table — records every write operation for accountability (required for law-enforcement data)."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import UUIDPKMixin


class AuditLog(Base, UUIDPKMixin):
    __tablename__ = "audit_logs"
    __table_args__ = ({"comment": "Immutable write-action accountability log"})

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    user: Mapped["User"] = relationship(back_populates="audit_logs")

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    authority_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    organization: Mapped["Organization | None"] = relationship()

    action: Mapped[str] = mapped_column(String(50), nullable=False)  # CREATE/UPDATE/DELETE
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "CrimeCase"
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Issue #176: audit robustness — result + result metadata without copying
    # sensitive payloads into the log. Normal users have no update/delete
    # endpoint for audit rows, so entries are effectively immutable.
    result: Mapped[str] = mapped_column(String(20), nullable=False, default="success")  # success/failure
    meta_data: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)  # compact JSON (no secrets)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
