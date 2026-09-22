"""Schemas for forensic reports and examination workflows."""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ForensicReportBase(BaseModel):
    case_id: uuid.UUID
    evidence_id: uuid.UUID | None = None
    title: str = Field(min_length=2, max_length=255)
    forensic_type: str = Field(min_length=2, max_length=50)  # digital, ballistics, fingerprint, dna, toxicology, cyber, document, other
    examiner_name: str | None = Field(default=None, max_length=255)
    lab_name: str | None = Field(default="State Forensic Science Laboratory (SFSL), Bengaluru", max_length=255)
    status: str = Field(default="submitted", max_length=50)
    findings: str | None = None
    methodology: str | None = None
    ai_assisted: bool = False
    ai_notes: str | None = None


class ForensicReportCreate(ForensicReportBase):
    pass


class ForensicReportUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    findings: str | None = None
    methodology: str | None = None
    ai_assisted: bool | None = None
    ai_notes: str | None = None
    status: str | None = Field(default=None, max_length=50)


class ForensicReportVerifyRequest(BaseModel):
    status: str = Field(default="verified", max_length=50)
    verification_notes: str | None = None


class ForensicReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    evidence_id: uuid.UUID | None = None
    title: str
    forensic_type: str
    examiner_name: str
    lab_name: str
    status: str
    findings: str | None = None
    methodology: str | None = None
    ai_assisted: bool = False
    ai_notes: str | None = None
    verified_by: str | None = None
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None
