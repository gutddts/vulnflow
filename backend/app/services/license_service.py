"""License service - business logic for license validation."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.license import License


class LicenseService:
    """Service for license-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings = get_settings()

    async def get_by_id(self, license_id: UUID) -> License | None:
        result = await self.db.execute(select(License).where(License.id == license_id))
        return result.scalar_one_or_none()

    async def get_by_key(self, license_key: str) -> License | None:
        result = await self.db.execute(
            select(License).where(License.license_key == license_key)
        )
        return result.scalar_one_or_none()

    async def list_licenses(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[License], int]:
        query = select(License)
        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(License.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_license(
        self,
        license_type: str,
        holder_name: str,
        holder_email: str,
        max_users: int = 10,
        max_projects: int = 50,
        max_agents: int = 5,
        features: Optional[list[str]] = None,
        expires_at: Optional[datetime] = None,
    ) -> License:
        import secrets
        license_key = f"VLF-{secrets.token_hex(8).upper()}-{secrets.token_hex(4).upper()}"

        license_obj = License(
            license_key=license_key,
            license_type=license_type,
            holder_name=holder_name,
            holder_email=holder_email,
            max_users=max_users,
            max_projects=max_projects,
            max_agents=max_agents,
            features=features,
            expires_at=expires_at,
        )
        self.db.add(license_obj)
        await self.db.flush()
        await self.db.refresh(license_obj)
        return license_obj

    async def validate_license(self, license_key: str) -> dict:
        """Validate a license key and return its status."""
        license_obj = await self.get_by_key(license_key)

        if license_obj is None:
            return {
                "valid": False,
                "license_type": None,
                "expires_at": None,
                "message": "License not found",
            }

        if not license_obj.is_active:
            return {
                "valid": False,
                "license_type": None,
                "expires_at": None,
                "message": "License is revoked",
            }

        if license_obj.expires_at and license_obj.expires_at < datetime.now(timezone.utc):
            return {
                "valid": False,
                "license_type": None,
                "expires_at": None,
                "message": "License has expired",
            }

        # Verify cryptographic signature if public key is configured
        if self.settings.LICENSE_PUBLIC_KEY_PATH and license_obj.signature:
            if not self._verify_signature(license_obj):
                return {
                    "valid": False,
                    "license_type": None,
                    "expires_at": None,
                    "message": "License signature verification failed",
                }

        return {
            "valid": True,
            "license_type": license_obj.license_type,
            "expires_at": license_obj.expires_at,
            "message": "License is valid",
        }

    def _verify_signature(self, license_obj: License) -> bool:
        """Verify the cryptographic signature of a license."""
        try:
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import padding
            from cryptography.hazmat.backends import default_backend

            key_path = Path(self.settings.LICENSE_PUBLIC_KEY_PATH)
            if not key_path.exists():
                return False

            with open(key_path, "rb") as f:
                public_key = serialization.load_pem_public_key(
                    f.read(), backend=default_backend()
                )

            message = f"{license_obj.license_key}:{license_obj.holder_email}:{license_obj.license_type}"
            signature_bytes = bytes.fromhex(license_obj.signature)

            public_key.verify(
                signature_bytes,
                message.encode(),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
        except Exception:
            return False

    async def revoke_license(self, license_id: UUID) -> License | None:
        license_obj = await self.get_by_id(license_id)
        if license_obj is None:
            return None

        license_obj.is_active = False
        license_obj.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(license_obj)
        return license_obj
