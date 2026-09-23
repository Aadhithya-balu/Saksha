"""User schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_password(value: str) -> str:
    """Baseline KSP password policy: a strong password (length + character-class
    requirements) OR a 6-digit numeric badge PIN. Detailed rules are enforced in
    auth_service.validate_password_strength."""
    if len(value) == 6 and value.isdigit():
        return value
    if len(value) < 8 or len(value) > 128:
        raise ValueError("Password must be between 8 and 128 characters")
    if not any(c.islower() for c in value):
        raise ValueError("Password must contain a lowercase letter")
    if not any(c.isupper() for c in value):
        raise ValueError("Password must contain an uppercase letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("Password must contain a digit")
    return value


class UserBase(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    district: str | None = Field(default=None, max_length=100)
    station: str | None = Field(default=None, max_length=100)
    organization_id: uuid.UUID | None = None
    designation: str | None = Field(default=None, max_length=100)
    jurisdiction: str | None = Field(default=None, max_length=100)
    scope_level: str | None = Field(default="DISTRICT", max_length=30)


class UserCreate(UserBase):
    password: str
    role_name: str  # "investigator" | "crime_analyst" | "policymaker" | "admin"

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return _validate_password(value)


class UserUpdate(BaseModel):
    full_name: str | None = None
    district: str | None = None
    station: str | None = None
    organization_id: uuid.UUID | None = None
    designation: str | None = None
    jurisdiction: str | None = None
    scope_level: str | None = None
    is_active: bool | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    role: str
    organization_name: str | None = None
    authority_type: str | None = None
    created_at: datetime
