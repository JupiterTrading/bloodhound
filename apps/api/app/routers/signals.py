"""
Signals feed — detected on-chain anomalies.
GET /v1/signals
"""

from fastapi import APIRouter, Query
from app.services import clickhouse
from app.services.redis_cache import cache_get, cache_set, TTL_WALLET_STATS

router = APIRouter()

VALID_SIGNAL_TYPES = {
    "abnormal_inflow",
    "cluster_forming",
    "deployer_funding",
    "wash_trading",
    "lp_removal",
    "dormant_wake",
    "insider_identified",
    "pump_fun_bundler",
    "known_sniper_active",
    "dev_sold_supply",
}

VALID_CONFIDENCE = {"CONFIRMED", "PROBABLE", "SUSPECTED"}


@router.get("")
async def signals_feed(
    types: str | None = Query(None, description="Comma-separated signal types to filter"),
    confidence: str | None = Query(None, pattern="^(CONFIRMED|PROBABLE|SUSPECTED)$"),
    wallet: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Paginated signal feed. All users can read the global feed.
    Personalized filtering requires authentication (checked in frontend via Clerk).
    """
    offset = (page - 1) * limit
    signal_types: list[str] | None = None
    if types:
        signal_types = [t.strip() for t in types.split(",") if t.strip() in VALID_SIGNAL_TYPES]

    cache_key = f"bh:signals:{types}:{confidence}:{wallet}:{page}:{limit}"
    if cached := await cache_get(cache_key):
        return cached

    rows = await clickhouse.get_recent_signals(
        signal_types=signal_types,
        confidence=confidence,
        wallet_address=wallet,
        limit=limit,
        offset=offset,
    )

    # Deserialize metadata JSON strings
    import json
    for row in rows:
        if row.get("metadata") and isinstance(row["metadata"], str):
            try:
                row["metadata"] = json.loads(row["metadata"])
            except json.JSONDecodeError:
                pass

    result = {"signals": rows, "page": page, "limit": limit, "count": len(rows)}
    await cache_set(cache_key, result, 30)  # 30s TTL — signals are near-real-time
    return result
