"""Licenses API endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_superuser
from app.core.database import get_db
from app.models.license import License
from app.models.user import User
from pydantic import BaseModel, Field
from datetime import datetime

router = APIRouter()


# ------------------------------------------------------------------ #
#  Schemas
# ------------------------------------------------------------------ #
class LicenseCreate(BaseModel):
    license_type: str = Field(default="enterprise")
    holder_name: str = Field(..., min_length=1, max_length=255)
    holder_email: str = Field(..., min_length=1, max_length=255)
    max_users: int = Field(default=10, ge=1)
    max_projects: int = Field(default=50, ge=1)
    max_agents: int = Field(default=5, ge=1)
    features: list[str] | None = None
    expires_at: datetime | None = None


class LicenseUpdate(BaseModel):
    is_active: bool | None = None
    max_users: int | None = Field(default=None, ge=1)
    max_projects: int | None = Field(default=None, ge=1)
    max_agents: int | None = Field(default=None, ge=1)
    features: list[str] | None = None
    expires_at: datetime | None = None


class LicenseResponse(BaseModel):
    id: UUID
    license_key: str
    license_type: str
    holder_name: str
    holder_email: str
    max_users: int
    max_projects: int
    max_agents: int
    features: list[str] | None = None
    is_active: bool
    issued_at: datetime
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LicenseListResponse(BaseModel):
    items: list[LicenseResponse]
    total: int
    page: int
    page_size: int


class LicenseValidateRequest(BaseModel):
    license_key: str


class LicenseValidateResponse(BaseModel):
    valid: bool
    license_type: str | None = None
    expires_at: datetime | None = None
    message: str | None = None


# ------------------------------------------------------------------ #
#  Endpoints (superuser only)
# ------------------------------------------------------------------ #
@router.post("", response_model=LicenseResponse, status_code=status.HTTP_201_CREATED)
async def create_license(
    body: LicenseCreate,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> License:
    """Create a new license (superuser only)."""
    import secrets
    license_key = f"VLF-{secrets.token_hex(8).upper()}-{secrets.token_hex(4).upper()}"

    license_obj = License(
        license_key=license_key,
        license_type=body.license_type,
        holder_name=body.holder_name,
        holder_email=body.holder_email,
        max_users=body.max_users,
        max_projects=body.max_projects,
        max_agents=body.max_agents,
        features=body.features,
        expires_at=body.expires_at,
    )
    db.add(license_obj)
    await db.flush()
    await db.refresh(license_obj)
    return license_obj


@router.get("", response_model=LicenseListResponse)
async def list_licenses(
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """List all licenses (superuser only)."""
    query = select(License)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(License.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{license_id}", response_model=LicenseResponse)
async def get_license(
    license_id: UUID,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> License:
    """Get a single license (superuser only)."""
    result = await db.execute(select(License).where(License.id == license_id))
    license_obj = result.scalar_one_or_none()
    if license_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    return license_obj


@router.put("/{license_id}", response_model=LicenseResponse)
async def update_license(
    license_id: UUID,
    body: LicenseUpdate,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> License:
    """Update a license (superuser only)."""
    result = await db.execute(select(License).where(License.id == license_id))
    license_obj = result.scalar_one_or_none()
    if license_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(license_obj, field, value)

    await db.flush()
    await db.refresh(license_obj)
    return license_obj


@router.post("/{license_id}/revoke", response_model=LicenseResponse)
async def revoke_license(
    license_id: UUID,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> License:
    """Revoke a license (superuser only)."""
    result = await db.execute(select(License).where(License.id == license_id))
    license_obj = result.scalar_one_or_none()
    if license_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")

    from datetime import datetime, timezone
    license_obj.is_active = False
    license_obj.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(license_obj)
    return license_obj


@router.post("/validate", response_model=LicenseValidateResponse)
async def validate_license(
    body: LicenseValidateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Validate a license key (public endpoint)."""
    result = await db.execute(
        select(License).where(License.license_key == body.license_key)
    )
    license_obj = result.scalar_one_or_none()

    if license_obj is None:
        return {"valid": False, "license_type": None, "expires_at": None, "message": "License not found"}

    if not license_obj.is_active:
        return {"valid": False, "license_type": None, "expires_at": None, "message": "License is revoked"}

    from datetime import datetime, timezone
    if license_obj.expires_at and license_obj.expires_at < datetime.now(timezone.utc):
        return {"valid": False, "license_type": None, "expires_at": None, "message": "License has expired"}

    return {
        "valid": True,
        "license_type": license_obj.license_type,
        "expires_at": license_obj.expires_at,
        "message": "License is valid",
    }
