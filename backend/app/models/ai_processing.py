import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, ForeignKey, JSON, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.postgres import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

class AIProcessingJob(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ai_processing_jobs"
    
    target_entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # e.g. "evidence"
    target_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    
    job_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "OCR", "NER", "VISION"
    status: Mapped[str] = mapped_column(String(30), default="QUEUED", index=True) # QUEUED, PROCESSING, COMPLETED, FAILED, REQUIRES_REVIEW
    
    error_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class AIOcrResult(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ai_ocr_results"
    
    source_entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    bounding_boxes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    provider: Mapped[str] = mapped_column(String(100), nullable=False)

class AIEntity(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ai_entities"
    
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # PERSON, LOCATION, VEHICLE
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    source_entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    verification_status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True) # PENDING, CONFIRMED, REJECTED
    
    provider: Mapped[str] = mapped_column(String(100), nullable=False)

class AIEvent(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ai_events"
    
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    source_entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    
    timestamp_reference: Mapped[str | None] = mapped_column(String(100), nullable=True) # e.g. "00:01:23" for video
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    
    provider: Mapped[str] = mapped_column(String(100), nullable=False)

class AIMatchRecord(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ai_match_records"
    
    candidate_ai_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_entities.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_ai_entity = relationship("AIEntity")
    
    source_entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # "criminal" or "victim"
    source_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    
    match_score: Mapped[float] = mapped_column(Float, default=0.0)
    matching_attributes: Mapped[dict] = mapped_column(JSON, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True) # PENDING, CONFIRMED, REJECTED
    
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by = relationship("User")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
