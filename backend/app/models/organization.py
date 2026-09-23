"""Organization model for multi-authority architecture."""
import uuid
from typing import Any

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Organization(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    authority_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True, default="LAW_ENFORCEMENT")
    jurisdiction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parent_organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    org_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    case_accesses: Mapped[list["CaseAccess"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
