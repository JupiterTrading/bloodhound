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
    "new_dex_pair",
    "pump_fun_new_token",
    "pump_fun_early_buyer",
}

VALID_CONFIDENCE = {"CONFIRMED", "PROBABLE", "SUSPECTED"}


@router.get("")
async def signals_feed(
    types: str | None = Query(None, description="Comma-separated signal types to filter"),
    confidence: str | None = Query(None, pattern="^(CONFIRMED|PROBABLE|SUSPECTED)$"),
    wallet: str | None = None,
    wallets: str | None = Query(None, description="Comma-separated wallet addresses (overrides wallet)"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Paginated signal feed. All users can read the global feed.
    Personalized filtering requires authentication (checked in frontend via Clerk).
    Pass `wallets` as comma-separated addresses to filter to a set of tracked wallets.
    """
    offset = (page - 1) * limit
    signal_types: list[str] | None = None
    if types:
        signal_types = [t.strip() for t in types.split(",") if t.strip() in VALID_SIGNAL_TYPES]

    wallet_addresses: list[str] | None = None
    if wallets:
        wallet_addresses = [a.strip() for a in wallets.split(",") if a.strip()]

    cache_key = f"bh:signals:{types}:{confidence}:{wallet}:{wallets}:{page}:{limit}"
    if cached := await cache_get(cache_key):
        return cached

    rows = await clickhouse.get_recent_signals(
        signal_types=signal_types,
        confidence=confidence,
        wallet_address=wallet if not wallet_addresses else None,
        wallet_addresses=wallet_addresses,
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


@router.get("/new-pairs")
async def new_pairs_feed(
    limit: int = Query(50, ge=1, le=100),
    source: str | None = Query(None, pattern="^(pump_fun|dex)$"),
):
    """
    Live feed of newly detected Solana token launches.
    Sources: Pump.fun WebSocket + DexScreener new pair monitor.
    """
    cache_key = f"bh:new-pairs:{limit}:{source}"
    if cached := await cache_get(cache_key):
        return cached

    types = ["new_dex_pair", "pump_fun_new_token"]
    if source == "pump_fun":
        types = ["pump_fun_new_token"]
    elif source == "dex":
        types = ["new_dex_pair"]

    rows = await clickhouse.get_recent_signals(
        signal_types=types,
        limit=limit,
        offset=0,
    )

    import json
    pairs = []
    for row in rows:
        meta = row.get("metadata", {})
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}

        signal_type = row.get("signal_type", "")
        pairs.append({
            "token_mint": row.get("token_mint", "") or meta.get("mint", ""),
            "signal_type": signal_type,
            "source": "pump_fun" if signal_type == "pump_fun_new_token" else "dex",
            "detected_at": str(row.get("detected_at", "")),
            "description": row.get("description", ""),
            "metadata": meta,
        })

    result = {"pairs": pairs, "count": len(pairs)}
    await cache_set(cache_key, result, 30)  # 30s cache
    return result
