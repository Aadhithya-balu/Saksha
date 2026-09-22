"""Phase 1 (issue #269): ingestion schemas."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DataSourceCreate(BaseModel):
    name: str
    source_type: str = "MANUAL"
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    jurisdiction: Optional[Dict[str, Any]] = None
    is_active: bool = True


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    jurisdiction: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class DataSourceOut(BaseModel):
    id: uuid.UUID
    name: str
    source_type: str
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    jurisdiction: Optional[Dict[str, Any]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IngestionJobOut(BaseModel):
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    status: str
    artifact_kind: str
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: int
    content_hash: Optional[str] = None
    record_count: int
    ai_job_spawned: bool
    error_details: Optional[str] = None
    created_by_id: Optional[uuid.UUID] = None
    received_at: datetime
    validated_at: Optional[datetime] = None
    normalized_at: Optional[datetime] = None
    stored_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IngestionJobDetailOut(IngestionJobOut):
    source: Optional[DataSourceOut] = None
    provenance: Optional[Dict[str, Any]] = None
    parsed_metadata: Optional[Dict[str, Any]] = None
    normalized_payload: Optional[Dict[str, Any]] = None
    ai_job_id: Optional[uuid.UUID] = None


class IngestionJobProvenanceOut(BaseModel):
    """Provenance view — lineage without any server-side storage details."""

    id: uuid.UUID
    status: str
    artifact_kind: str
    original_filename: Optional[str] = None
    content_hash: Optional[str] = None
    provenance: Optional[Dict[str, Any]] = None
    source: Optional[DataSourceOut] = None
    received_at: datetime
    processed_at: Optional[datetime] = None
    record_count: int


class IngestionStatusOut(BaseModel):
    """Aggregated job counts for the ingestion dashboard."""

    total: int
    received: int
    validating: int
    normalizing: int
    stored: int
    ready_for_ai: int
    completed: int
    requires_review: int
    failed: int
    by_kind: Dict[str, int]


class SourceKindListItem(BaseModel):
    value: str
    label: str
    ai_eligible: bool