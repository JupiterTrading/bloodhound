"""
Sliding-window rate limiting middleware using Upstash Redis.
Limits are per-IP for anonymous requests, per-user for authenticated ones.
Falls back gracefully if Redis is unavailable.
"""

import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.redis_cache import cache_incr, rate_key

# Limits: (requests, window_seconds)
ANON_LIMIT = (200, 86400)    # 200/day for anonymous (IP-based)
FREE_LIMIT = (1000, 86400)   # 1000/day for free tier


def _get_window_bucket(window_seconds: int) -> str:
    """Return a time-bucketed string for the sliding window."""
    return str(int(time.time()) // window_seconds)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    Checks X-User-Id header (set by auth layer) for authenticated limits,
    falls back to IP for anonymous.
    """

    EXCLUDED_PATHS = {"/health", "/docs", "/openapi.json", "/webhooks/helius"}

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip rate limiting for excluded paths
        if any(path.startswith(ex) for ex in self.EXCLUDED_PATHS):
            return await call_next(request)

        # Determine identifier and limits
        user_id = request.headers.get("X-User-Id")
        if user_id:
            identifier = f"user:{user_id}"
            max_requests, window = FREE_LIMIT  # TODO: pull from user tier
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
