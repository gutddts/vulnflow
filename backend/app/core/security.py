"""JWT authentication, password hashing, and RBAC utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


# ------------------------------------------------------------------ #
#  Password hashing
# ------------------------------------------------------------------ #
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain password."""
    return pwd_context.hash(password)


# ------------------------------------------------------------------ #
#  JWT tokens
# ------------------------------------------------------------------ #
def create_access_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra_claims:
        to_encode.update(extra_claims)

    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# ------------------------------------------------------------------ #
#  RBAC role hierarchy
# ------------------------------------------------------------------ #
ROLE_HIERARCHY: dict[str, list[str]] = {
    "superuser": ["superuser", "admin", "analyst", "viewer"],
    "admin": ["admin", "analyst", "viewer"],
    "analyst": ["analyst", "viewer"],
    "viewer": ["viewer"],
}


def has_permission(user_role: str, required_role: str) -> bool:
    """Check if a user role satisfies the required role (inclusive)."""
    allowed = ROLE_HIERARCHY.get(user_role, [])
    return required_role in allowed
