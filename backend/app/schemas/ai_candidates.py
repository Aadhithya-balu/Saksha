import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class AICandidateCreate(BaseModel):
    candidate_type: Literal["CRIME_CASE", "FIR"]
    source_entity_type: str
    source_entity_id: uuid.UUID | None = None
    proposed_payload: dict
    confidence: float = 0.0
    provenance: dict | None = None


class AICandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_type: str
    source_entity_type: str
    source_entity_id: uuid.UUID | None
    proposed_payload: dict
    confidence: float
    status: str
    reviewed_by_id: uuid.UUID | None
    reviewed_at: datetime | None
    review_note: str | None
    resolved_record_type: str | None
    resolved_record_id: uuid.UUID | None
    provenance: dict | None
    created_at: datetime


class AICandidateReviewRequest(BaseModel):
    review_note: str | None = None
    # Corrections/field values the reviewer provides; these are merged over the
    # proposed payload and must satisfy the target schema (CrimeCaseCreate /
    # FIRCreate) before the record is materialized.
    overrides: dict = {}


class AICandidateListOut(BaseModel):
    items: list[AICandidateOut]
    total: int