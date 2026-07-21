"""Redis client with connection pool."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from app.config import get_settings

settings = get_settings()

_redis_pool: aioredis.ConnectionPool | None = None
_redis_client: aioredis.Redis | None = None


async def init_redis() -> None:
    """Initialize the Redis connection pool."""
    global _redis_pool, _redis_client
    _redis_pool = aioredis.ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_MAX_CONNECTIONS,
        decode_responses=True,
    )
    _redis_client = aioredis.Redis(connection_pool=_redis_pool)


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _redis_client, _redis_pool
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None


def get_redis() -> aioredis.Redis:
    """Return the shared Redis client. Must be called after init_redis()."""
    if _redis_client is None:
        raise RuntimeError("Redis client has not been initialized. Call init_redis() first.")
    return _redis_client


# ------------------------------------------------------------------ #
#  Convenience helpers
# ------------------------------------------------------------------ #
async def cache_get(key: str) -> Any | None:
    """Get a cached JSON value."""
    client = get_redis()
    data = await client.get(key)
    if data is not None:
        return json.loads(data)
    return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Set a cached JSON value with TTL (seconds)."""
    client = get_redis()
    await client.set(key, json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    """Delete a cached key."""
    client = get_redis()
    await client.delete(key)


async def cache_invalidate_pattern(pattern: str) -> None:
    """Invalidate all keys matching a glob pattern."""
    client = get_redis()
    cursor = 0
    while True:
        cursor, keys = await client.scan(cursor, match=pattern, count=100)
        if keys:
            await client.delete(*keys)
        if cursor == 0:
            break
