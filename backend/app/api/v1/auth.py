"""Authentication API endpoints."""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)

settings = get_settings()
router = APIRouter()


# ------------------------------------------------------------------ #
#  POST /login
# ------------------------------------------------------------------ #
@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Authenticate user and return JWT token. Supports email or username."""
    # Try email first, then username
    result = await db.execute(
        select(User).where(
            (User.email == body.email) | (User.username == body.email)
        )
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role, "email": user.email},
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
    }


# ------------------------------------------------------------------ #
#  POST /register
# ------------------------------------------------------------------ #
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Register a new user account."""
    existing = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=get_password_hash(body.password),
        full_name=body.full_name,
        role="viewer",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


# ------------------------------------------------------------------ #
#  GET /me
# ------------------------------------------------------------------ #
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Get current authenticated user."""
    return current_user


# ------------------------------------------------------------------ #
#  PUT /me
# ------------------------------------------------------------------ #
@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Update current user profile."""
    update_data = body.model_dump(exclude_unset=True)
    # Non-admin users cannot change their own role
    update_data.pop("role", None)
    update_data.pop("is_active", None)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.flush()
    await db.refresh(current_user)
    return current_user


# ------------------------------------------------------------------ #
#  POST /change-password
# ------------------------------------------------------------------ #
@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Change current user's password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = get_password_hash(body.new_password)
    await db.flush()


# ------------------------------------------------------------------ #
#  POST /password-reset-request
# ------------------------------------------------------------------ #
@router.post("/password-reset-request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    body: PasswordResetRequest,
) -> dict:
    """Request a password reset email."""
    # In production, send an email with a reset token.
    # For now, return accepted to avoid user enumeration.
    return {"message": "If the email exists, a reset link has been sent."}


# ------------------------------------------------------------------ #
#  POST /password-reset-confirm
# ------------------------------------------------------------------ #
@router.post("/password-reset-confirm", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def confirm_password_reset(
    body: PasswordResetConfirmRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Confirm password reset with token."""
    # In production, verify the reset token from Redis/cache.
    # For now, this is a stub.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset flow not fully implemented yet",
    )
