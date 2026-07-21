"""Authentication schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

# Simple email pattern for development (allows .local, .test, etc.)
_EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"


# ------------------------------------------------------------------ #
#  Auth request schemas
# ------------------------------------------------------------------ #
class LoginRequest(BaseModel):
    """Login with email or username."""
    email: str = Field(..., description="Email or username", min_length=1)
    password: str = Field(..., min_length=6, max_length=128)


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=1)
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(..., pattern=_EMAIL_PATTERN)


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ------------------------------------------------------------------ #
#  User schemas
# ------------------------------------------------------------------ #
class UserBase(BaseModel):
    email: str = Field(..., pattern=_EMAIL_PATTERN)
    username: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="viewer")


class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, pattern=_EMAIL_PATTERN)
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None


class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    preferences: dict = Field(default_factory=dict)
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
