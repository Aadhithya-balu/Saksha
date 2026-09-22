import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from sqlalchemy.orm import Session


class KGNodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_type: str
    ref_type: str
    ref_id: uuid.UUID
    label: str
    attributes: dict
    districts: list
    status: str


class KGRelationshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    relationship_type: str
    direction: str
    strength: float
    basis: str | None
    status: str


class KGFragmentOut(BaseModel):
    nodes: list[KGNodeOut]
    edges: list[KGRelationshipOut]
    depth: int


class KGRelationshipCreate(BaseModel):
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    relationship_type: str = Field(min_length=2, max_length=80)
    direction: str = Field(default="DIRECT", pattern="^(DIRECT|DERIVED)$")
    strength: float = Field(default=1.0, ge=0.0, le=1.0)
    basis: str | None = None
    provenance: dict = {}


class KGStatsOut(BaseModel):
    node_total: int
    edge_total: int
    nodes_by_type: dict[str, int]
    edges_by_direction: dict[str, int]


class KGSearchOut(BaseModel):
    items: list[KGNodeOut]
    total: int