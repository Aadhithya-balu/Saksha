"""CaseAccess model for cross-authority case-level access control."""
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class CaseAccess(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "case_access"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crime_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    access_level: Mapped[str] = mapped_column(String(20), default="READ", nullable=False)
    scope: Mapped[str] = mapped_column(String(30), default="CASE", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    granted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    case: Mapped["CrimeCase"] = relationship()
    organization: Mapped["Organization"] = relationship(back_populates="case_accesses")
    grantor: Mapped["User | None"] = relationship(foreign_keys=[granted_by])
