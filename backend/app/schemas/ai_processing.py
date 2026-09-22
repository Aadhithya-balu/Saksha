from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

class AIEntityResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    attributes: Dict[str, Any]
    source_entity_type: str
    source_entity_id: uuid.UUID
    confidence: float
    verification_status: str
    provider: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class AIMatchRecordResponse(BaseModel):
    id: uuid.UUID
    candidate_ai_entity_id: uuid.UUID
    candidate_ai_entity: Optional[AIEntityResponse] = None
    source_entity_type: str
    source_entity_id: uuid.UUID
    match_score: float
    matching_attributes: Dict[str, Any]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class AIProcessingJobResponse(BaseModel):
    id: uuid.UUID
    target_entity_type: str
    target_entity_id: uuid.UUID
    job_type: str
    status: str
    error_details: Optional[str] = None
    retry_count: int
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class VerifyMatchRequest(BaseModel):
    decision: str # "CONFIRM" or "REJECT"

class SpawnJobRequest(BaseModel):
    target_type: str
    target_id: uuid.UUID
    job_type: str
