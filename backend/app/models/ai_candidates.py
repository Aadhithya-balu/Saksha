import uuid
from datetime import datetime
from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class AICandidateRecord(Base, UUIDPKMixin, TimestampMixin):
    """Human-review-gated knowledge record proposed from AI-processed artifacts.

    A candidate is created when an AI pass (entity resolution, OCR/NER, ingestion)
    produces something that looks like a real knowledge record (crime case / FIR).
    It stays PROPOSED until a reviewer ACCEPTs (materializing the record) or
    REJECTs it — never auto-confirm, per the bare-metal rules.
    """
    __tablename__ = "ai_candidate_records"
    __table_args__ = (
        Index("ix_ai_candidate_status_created", "status", "created_at"),
    )

    # CRIME_CASE | FIR (extendable)
    candidate_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # Where the proposal came from: "ingestion_job" | "ai_entity" | "identity_match" | "evidence"
    source_entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # The exact fields that would materialize the record once accepted.
    proposed_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # PROPOSED -> ACCEPTED | REJECTED
    status: Mapped[str] = mapped_column(String(30), default="PROPOSED", nullable=False, index=True)

    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewed_by: Mapped["User"] = relationship()  # noqa: F821
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Populated on accept: what real record was materialized.
    resolved_record_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    resolved_record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # Origin trace: AI job / entity ids, provider, extraction method.
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)