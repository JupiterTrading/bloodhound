"""
Clerk JWT verification for authenticated API endpoints.
Uses Clerk's JWKS endpoint to verify RS256 tokens.
JWKS response is cached in-process; refreshed on verification failure.
"""

import httpx
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from app.core.config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

# Module-level JWKS cache (refreshed on error)
_jwks_cache: dict | None = None


async def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache
    if _jwks_cache and not force_refresh:
        return _jwks_cache
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(settings.clerk_jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """
    FastAPI dependency: extracts and verifies Clerk user ID from Bearer JWT.
    Raises 401 if token is missing or invalid.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        jwks = await _get_jwks()
        payload = jwt.decode(token, jwks, algorithms=["RS256"])
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        return user_id
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        # Try refreshing JWKS once (key rotation)
        try:
            jwks = await _get_jwks(force_refresh=True)
            payload = jwt.decode(token, jwks, algorithms=["RS256"])
            user_id = payload.get("sub", "")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            return user_id
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    """
    Like get_current_user_id but returns None instead of raising.
    Use for endpoints that have public + authed behaviour.
    """
    if not credentials:
        return None
    try:
        return await get_current_user_id(credentials)
    except HTTPException:
        return None
