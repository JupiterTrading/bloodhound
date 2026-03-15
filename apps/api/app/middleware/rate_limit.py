"""
Sliding-window rate limiting middleware using Upstash Redis.
Limits are per-IP for anonymous requests, per-user for authenticated ones,
and per-API-key for Pro subscribers using bh_* bearer tokens.
Falls back gracefully if Redis is unavailable.
"""

import hashlib
import asyncio
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.redis_cache import cache_get, cache_set, cache_incr, rate_key

# Limits: (requests, window_seconds)
ANON_LIMIT    = (10_000, 86400)   # 10K/day  — anonymous (IP-based) - high for dev
FREE_LIMIT    = (10_000, 86400)   # 10K/day  — free signed-in user
PRO_API_LIMIT = (100_000, 86400)  # 100K/day — Pro API key holder


def _get_window_bucket(window_seconds: int) -> str:
    return str(int(time.time()) // window_seconds)


async def _resolve_api_key(raw_key: str) -> dict | None:
    """
    Validate a bh_* API key. Returns {"id": ..., "user_id": ...} or None.
    Result is cached in Redis for 5 minutes to avoid per-request Supabase hits.
    """
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    cache_key = f"bh:apikey:{key_hash}"

    cached = await cache_get(cache_key)
    if cached is not None:
        # Sentinel: "_invalid_" means key was checked and found invalid
        return None if cached == "_invalid_" else cached

    from app.services import supabase as supabase_svc
    key_data = await supabase_svc.validate_api_key(key_hash)

    if key_data:
        await cache_set(cache_key, key_data, 300)   # 5-min cache
        # Touch last_used_at in background — non-blocking
        asyncio.create_task(supabase_svc.touch_api_key(key_data["id"]))
        return key_data
    else:
        await cache_set(cache_key, "_invalid_", 300)
        return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    Priority order:
      1. bh_* Bearer token → validate as API key → PRO_API_LIMIT
      2. X-User-Id header  → FREE_LIMIT
      3. IP address        → ANON_LIMIT
    """

    EXCLUDED_PATHS = {"/health", "/docs", "/openapi.json", "/webhooks/helius"}

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if any(path.startswith(ex) for ex in self.EXCLUDED_PATHS):
            return await call_next(request)

        # Skip rate limiting for local development
        host = request.headers.get("host", "")
        if host.startswith("localhost") or host.startswith("127.0.0.1"):
            return await call_next(request)

        # ── 1. Check for API key (bh_* Bearer token) ─────────────────────────
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer bh_"):
            raw_key = auth_header[len("Bearer "):]
            key_data = await _resolve_api_key(raw_key)

            if not key_data:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or revoked API key."},
                )

            identifier = f"apikey:{key_data['id']}"
            max_requests, window = PRO_API_LIMIT

        # ── 2. Authenticated user (Clerk user ID header) ──────────────────────
        elif user_id := request.headers.get("X-User-Id"):
            identifier = f"user:{user_id}"
            max_requests, window = FREE_LIMIT

        # ── 3. Anonymous — IP-based ───────────────────────────────────────────
        else:
            ip = request.client.host if request.client else "unknown"
            identifier = f"ip:{ip}"
            max_requests, window = ANON_LIMIT

        bucket = _get_window_bucket(window)
        key = rate_key(identifier, bucket)
        count = await cache_incr(key, ttl=window)

        if count > max_requests:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Upgrade to Pro for higher limits.",
                    "limit": max_requests,
                    "window_seconds": window,
                },
                headers={"Retry-After": str(window)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - count))
        return response
