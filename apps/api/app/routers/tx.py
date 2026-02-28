"""
Transaction detail endpoint.
GET /v1/tx/{sig}
"""

from fastapi import APIRouter, HTTPException
from app.services import helius
from app.services.redis_cache import cache_get, cache_set

router = APIRouter()

TTL_TX = 3600  # transactions are immutable — cache 1 hour


@router.get("/{sig}")
async def transaction_detail(sig: str):
    """Enriched transaction detail from Helius."""
    if len(sig) < 43 or len(sig) > 90:
        raise HTTPException(status_code=400, detail="Invalid signature format")

    cache_key = f"tx:{sig}"
    if cached := await cache_get(cache_key):
        return cached

    try:
        tx = await helius.get_transaction(sig)
    except Exception:
        tx = None

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await cache_set(cache_key, tx, TTL_TX)
    return tx
