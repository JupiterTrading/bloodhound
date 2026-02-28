"""
Redis caching wrapper using Upstash Redis REST API.
All cache calls are no-ops if Redis is not configured (graceful degradation).
"""

import json
from typing import Any
from functools import lru_cache

from upstash_redis import Redis
from app.core.config import get_settings

settings = get_settings()

# Standard TTL constants (seconds)
TTL_PRICE = 300           # 5 min — live price data
TTL_WALLET_STATS = 1800   # 30 min — wallet stats
TTL_CLASSIFICATION = 86400  # 24 hr — classification labels
TTL_KNOWN_WALLET = 3600   # 1 hr — known wallet labels
TTL_TWITTER = 3600        # 1 hr — Twitter API results
TTL_HISTORICAL = 3600     # 1 hr — historical queries
TTL_SEARCH = 60           # 1 min — search autocomplete


@lru_cache()
def _get_redis() -> Redis | None:
    if not settings.upstash_redis_rest_url:
        return None
    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    )


async def cache_get(key: str) -> Any | None:
    """Get a cached value. Returns deserialized value or None."""
    redis = _get_redis()
    if not redis:
        return None
    try:
        value = redis.get(key)
        if value is None:
            return None
        return json.loads(value) if isinstance(value, str) else value
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = TTL_WALLET_STATS) -> None:
    """Cache a value with TTL (seconds). Silently no-ops on error."""
    redis = _get_redis()
    if not redis:
        return
    try:
        redis.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Invalidate a cache key."""
    redis = _get_redis()
    if not redis:
        return
    try:
        redis.delete(key)
    except Exception:
        pass


async def cache_incr(key: str, ttl: int = 86400) -> int:
    """Increment a counter key. Used for rate limiting fallback."""
    redis = _get_redis()
    if not redis:
        return 0
    try:
        val = redis.incr(key)
        if val == 1:
            redis.expire(key, ttl)
        return val
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Key builders — consistent naming across the app
# ---------------------------------------------------------------------------

def wallet_key(address: str, suffix: str) -> str:
    return f"bh:wallet:{address}:{suffix}"


def token_key(mint: str, suffix: str) -> str:
    return f"bh:token:{mint}:{suffix}"


def search_key(query: str) -> str:
    return f"bh:search:{query.lower().strip()[:100]}"


def rate_key(identifier: str, window: str) -> str:
    return f"bh:rate:{identifier}:{window}"
