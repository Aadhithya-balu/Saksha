"""Forensic reports table — formal scientific and technical analysis linked to cases and evidence."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class ForensicReport(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "forensic_reports"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crime_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    crime_case: Mapped["CrimeCase"] = relationship()

    evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evidence.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evidence: Mapped["Evidence"] = relationship()

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    forensic_type: Mapped[str] = mapped_column(String(50), nullable=False)  # digital, ballistics, fingerprint, dna, toxicology, cyber, document, other
    examiner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    lab_name: Mapped[str] = mapped_column(String(255), default="State Forensic Science Laboratory (SFSL), Bengaluru")
    
    # Status: draft, submitted, under_analysis, verified, inconclusive, rejected
    status: Mapped[str] = mapped_column(String(50), default="submitted", index=True)
    
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    methodology: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # AI transparency: whether AI assistance was used and what it produced
    ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Authoritative sign-off by senior certified officer
    verified_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
