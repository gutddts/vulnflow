"""MinIO object storage service for file uploads and downloads."""

from __future__ import annotations

import io
from typing import Optional

from minio import Minio

from app.config import get_settings
from app.core.logging import logger

settings = get_settings()


class StorageService:
    """Service for MinIO object storage operations."""

    def __init__(self) -> None:
        self.client: Optional[Minio] = None

    async def connect(self) -> None:
        """Initialize the MinIO client."""
        try:
            self.client = Minio(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
            # Ensure bucket exists
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
                logger.info("minio_bucket_created", bucket=settings.MINIO_BUCKET)
            logger.info("minio_connected", endpoint=settings.MINIO_ENDPOINT)
        except Exception as exc:
            logger.error("minio_connection_failed", error=str(exc))
            self.client = None

    async def upload_file(
        self,
        object_name: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> bool:
        """Upload a file to MinIO."""
        if self.client is None:
            return False
        try:
            self.client.put_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
            return True
        except Exception as exc:
            logger.error("minio_upload_error", error=str(exc))
            return False

    async def download_file(self, object_name: str) -> Optional[bytes]:
        """Download a file from MinIO."""
        if self.client is None:
            return None
        try:
            response = self.client.get_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
            )
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except Exception as exc:
            logger.error("minio_download_error", error=str(exc))
            return None

    async def delete_file(self, object_name: str) -> bool:
        """Delete a file from MinIO."""
        if self.client is None:
            return False
        try:
            self.client.remove_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
            )
            return True
        except Exception as exc:
            logger.error("minio_delete_error", error=str(exc))
            return False

    async def file_exists(self, object_name: str) -> bool:
        """Check if a file exists in MinIO."""
        if self.client is None:
            return False
        try:
            self.client.stat_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
            )
            return True
        except Exception:
            return False

    async def generate_presigned_url(self, object_name: str, expires: int = 3600) -> Optional[str]:
        """Generate a presigned download URL."""
        if self.client is None:
            return None
        try:
            return self.client.presigned_get_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
                expires=expires,
            )
        except Exception as exc:
            logger.error("minio_presigned_error", error=str(exc))
            return None
