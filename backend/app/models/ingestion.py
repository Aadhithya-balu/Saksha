"""Phase 1 (issue #269): universal data ingestion models.

`DataSource` is a declarative record of where data comes from (a department's
FIRS export, an open-data CSV, a CCTV feed, a structured API...). `IngestionJob`
tracks a single artifact through a state machine:

    RECEIVED -> VALIDATING -> NORMALIZING -> STORED -> READY_FOR_AI -> COMPLETED
                                                          |-> REQUIRES_REVIEW
                                                          |-> FAILED

No jurisdiction (district/state) is hard-coded here: provenance carries a
configurable ``jurisdiction`` JSON block supplied at upload time and surfaced to
the review UI.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class DataSource(Base, UUIDPKMixin, TimestampMixin):
    """A declarative source definition (pre-configured data origin)."""

    __tablename__ = "ingestion_sources"

    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # DOCUMENT|IMAGE|VIDEO|CSV|JSON|DATABASE|API|MANUAL
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    jurisdiction: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    jobs: Mapped[list["IngestionJob"]] = relationship(
        "IngestionJob", back_populates="source", cascade="all, delete-orphan"
    )


class IngestionJob(Base, UUIDPKMixin, TimestampMixin):
    """A single ingested artifact and its lifecycle state."""

    __tablename__ = "ingestion_jobs"
    __table_args__ = (
        Index("ix_ingestion_jobs_status_created", "status", "created_at"),
    )

    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingestion_sources.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source: Mapped["DataSource | None"] = relationship("DataSource", back_populates="jobs")

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="RECEIVED", index=True)

    # Artifact description (never expose server-side storage paths).
    artifact_kind: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # document|image|video|csv|json|database|api|manual
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_ref: Mapped[str | None] = mapped_column(String(1000), nullable=True)  # opaque logical ref (e.g. storage URL)
    mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Provenance: who/what/where the artifact came from.
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Normalized output of Phase 1 (metadata + structured payload).
    parsed_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    normalized_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # AI handoff (Phase 2 orchestrator).
    ai_job_spawned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    error_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    normalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)