"""Evidence schemas."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EvidenceBase(BaseModel):
    case_id: uuid.UUID
    title: str = Field(min_length=2, max_length=255)
    evidence_type: str = Field(min_length=2, max_length=50)
    description: str | None = None
    status: str = Field(default="Pending", max_length=50)
    created_by: str | None = None
    assigned_to: uuid.UUID | None = None
    storage_path: str | None = None


class EvidenceCreate(EvidenceBase):
    pass


class EvidenceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    evidence_type: str | None = Field(default=None, min_length=2, max_length=50)
    description: str | None = None
    status: str | None = Field(default=None, max_length=50)
    assigned_to: uuid.UUID | None = None
    storage_path: str | None = None


class EvidenceOut(EvidenceBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None


class EvidenceMetadataOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    evidence_id: uuid.UUID
    filename: str
    filepath: str
    filesize: int
    mime_type: str
    uploaded_by: str | None = None
    storage_url: str | None = None
    extracted_data: dict[str, Any] | None = None
    created_at: datetime


class EvidenceTimelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    evidence_id: uuid.UUID
    action: str
    performed_by: str
    role: str
    description: str | None = None
    created_at: datetime


class EvidenceAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    evidence_id: uuid.UUID
    assigned_by: uuid.UUID
    assigned_to: uuid.UUID
    status: str
    assigned_at: datetime
    accepted_at: datetime | None = None
    completed_at: datetime | None = None


class ChainOfCustodyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    evidence_id: uuid.UUID
    from_user: uuid.UUID | None = None
    to_user: uuid.UUID | None = None
    action: str
    location: str | None = None
    remarks: str | None = None
    timestamp: datetime


class EvidenceAISummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    evidence_id: uuid.UUID
    summary: str
    model: str
    created_at: datetime


class EvidenceDetailOut(EvidenceOut):
    metadata: EvidenceMetadataOut | None = None
    timeline: list[EvidenceTimelineOut] = Field(default_factory=list)
    assignments: list[EvidenceAssignmentOut] = Field(default_factory=list)
    chain_of_custody: list[ChainOfCustodyOut] = Field(default_factory=list)
    ai_summaries: list[EvidenceAISummaryOut] = Field(default_factory=list)


class CustodyTransferRequest(BaseModel):
    to_user: str = Field(..., description="Badge number, full name, or user UUID")
    action: str = Field(default="Custody Transfer", max_length=100)
    to_state: str = Field(default="Transferred", max_length=50)
    location: str | None = Field(default="Evidence Locker / Forensic Lab", max_length=255)
    reason: str | None = Field(default=None, max_length=1000)


class EvidenceHashVerificationOut(BaseModel):
    evidence_id: uuid.UUID
    filename: str
    recorded_hash: str
    current_hash: str
    verified: bool
    message: str
    checked_at: datetime


