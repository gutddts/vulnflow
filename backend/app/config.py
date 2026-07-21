"""Application configuration using Pydantic Settings."""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    #  Application
    # ------------------------------------------------------------------ #
    APP_NAME: str = "VulnFlow"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    DEBUG: bool = Field(default=False)

    # Secret key - auto-generated if not provided
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(64))

    # ------------------------------------------------------------------ #
    #  Database
    # ------------------------------------------------------------------ #
    DATABASE_URL: str = "postgresql+asyncpg://vulnflow:vulnflow@localhost:5432/vulnflow"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40

    @computed_field
    @property
    def sync_database_url(self) -> str:
        """Return a synchronous database URL for Alembic."""
        return self.DATABASE_URL.replace("+asyncpg", "")

    # ------------------------------------------------------------------ #
    #  Redis
    # ------------------------------------------------------------------ #
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # ------------------------------------------------------------------ #
    #  Elasticsearch
    # ------------------------------------------------------------------ #
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    ELASTICSEARCH_INDEX_PREFIX: str = "vulnflow"

    # ------------------------------------------------------------------ #
    #  MinIO / Object Storage
    # ------------------------------------------------------------------ #
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "vulnflow"
    MINIO_SECURE: bool = False

    # ------------------------------------------------------------------ #
    #  Qdrant (Vector DB)
    # ------------------------------------------------------------------ #
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None

    # ------------------------------------------------------------------ #
    #  LLM Configuration
    # ------------------------------------------------------------------ #
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o"
    LLM_API_KEY: str = ""
    LLM_API_BASE: str = ""

    LLM_FALLBACK_PROVIDER: str = "openai"
    LLM_FALLBACK_MODEL: str = "gpt-4o-mini"
    LLM_FALLBACK_API_BASE: str = ""

    EMBEDDING_PROVIDER: str = "openai"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_API_KEY: str = ""

    # ------------------------------------------------------------------ #
    #  Docker / Skill Sandbox
    # ------------------------------------------------------------------ #
    DOCKER_HOST: str = "unix:///var/run/docker.sock"
    SKILL_REGISTRY: str = "vulnflow/skills"
    SKILL_NETWORK: str = "vulnflow_skills"
    SKILL_DEFAULT_TIMEOUT: int = 300
    SKILL_MAX_MEMORY_MB: int = 512
    SKILL_MAX_CPU: float = 1.0

    # ------------------------------------------------------------------ #
    #  JWT / Authentication
    # ------------------------------------------------------------------ #
    JWT_SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(64))
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # ------------------------------------------------------------------ #
    #  Rate Limiting
    # ------------------------------------------------------------------ #
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD_SECONDS: int = 60

    # ------------------------------------------------------------------ #
    #  License
    # ------------------------------------------------------------------ #
    LICENSE_PUBLIC_KEY_PATH: str = ""


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
