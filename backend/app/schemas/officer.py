"""Officer schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OfficerBase(BaseModel):
    badge_number: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=255)
    rank: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    station: str = Field(min_length=2, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    status: str = Field(default="active", pattern="^(active|inactive|suspended|retired|transferred)$")
    image_url: str | None = None


class OfficerCreate(OfficerBase):
    supabase_user_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class OfficerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    rank: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    station: str | None = Field(default=None, min_length=2, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive|suspended|retired|transferred)$")


class OfficerOut(OfficerBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    supabase_user_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None


class OfficerPerformance(BaseModel):
    officer_id: uuid.UUID
    total_firs_handled: int
    cases_closed: int
    cases_open: int
    avg_resolution_days: float | None = None
