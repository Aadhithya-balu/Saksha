"""Users table — platform accounts (officers, analysts, admins log in through this)."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class User(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(400), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Brute-force protection (account lockout). String(400) on hashed_password
    # accommodates Argon2id encoded hashes (~95-100 chars).
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False, server_default="0")
    locked_until: Mapped["datetime | None"] = mapped_column(nullable=True)

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False, index=True)
    role: Mapped["Role"] = relationship(back_populates="users")

    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    station: Mapped[str | None] = mapped_column(String(100), nullable=True)

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    jurisdiction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    scope_level: Mapped[str] = mapped_column(String(30), default="DISTRICT", nullable=False, server_default="DISTRICT")

    organization: Mapped["Organization | None"] = relationship(back_populates="users")
    officer_profile: Mapped["Officer | None"] = relationship(back_populates="user", uselist=False)
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", foreign_keys="Notification.user_id"
    )
