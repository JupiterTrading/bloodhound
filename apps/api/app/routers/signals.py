"""
Signals feed — detected on-chain anomalies.
GET /v1/signals
"""

from fastapi import APIRouter, Query
from app.services import analytics
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

    rows = await analytics.get_recent_signals(
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
    source: str | None = Query(None),
    enrich: bool = Query(False),
):
    """
    Live feed of newly detected Solana token launches.
    Sources: Pump.fun WebSocket + DexScreener new pair monitor.
    Falls back to Redis when ClickHouse is empty/unavailable.
    Set enrich=true to fetch live market data (slower but more complete).
    """
    import json
    import asyncio
    from app.services.redis_cache import get_redis
    
    # Try Redis first (real-time data from monitors)
    pairs = []
    try:
        redis = await get_redis()
        raw_pairs = await redis.lrange("bh:live:new_pairs", 0, limit * 2 - 1)
        for raw in raw_pairs:
            try:
                pair = json.loads(raw)
                # Apply source filter
                if source and pair.get("source") != source:
                    continue
                pairs.append(pair)
                if len(pairs) >= limit:
                    break
            except Exception:
                continue
    except Exception as e:
        print(f"[signals] redis fetch error: {e}")
    
    # If Redis has data, optionally enrich with live market data
    if pairs:
        if enrich:
            pairs = await _enrich_pairs(pairs[:limit])
        return {"pairs": pairs[:limit], "count": len(pairs)}
    
    # Fallback to ClickHouse
    types = ["new_dex_pair", "pump_fun_new_token"]
    if source == "pump_fun":
        types = ["pump_fun_new_token"]
    elif source == "dex":
        types = ["new_dex_pair"]

    try:
        rows = await analytics.get_recent_signals(
            signal_types=types,
            limit=limit,
            offset=0,
        )
    except Exception:
        rows = []

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

    if enrich and pairs:
        pairs = await _enrich_pairs(pairs)

    return {"pairs": pairs, "count": len(pairs)}


async def _enrich_pairs(pairs: list[dict]) -> list[dict]:
    """Enrich pairs with live market data from DexScreener."""
    import asyncio
    from app.services import birdeye
    
    # Collect unique mints
    mints = list(set(p.get("token_mint") for p in pairs if p.get("token_mint")))
    if not mints:
        return pairs
    
    # Batch fetch prices
    prices = await birdeye._dexscreener_prices(mints)
    
    # Batch fetch token data from DexScreener (up to 30 at a time)
    token_data = {}
    for i in range(0, len(mints), 30):
        chunk = mints[i:i+30]
        try:
            data = await birdeye._get(f"{birdeye.DEXSCREENER_BASE}/latest/dex/tokens/{','.join(chunk)}")
            if data and data.get("pairs"):
                for pair in data["pairs"]:
                    base = pair.get("baseToken", {})
                    addr = base.get("address")
                    if addr and addr not in token_data:
                        token_data[addr] = {
                            "price_usd": float(pair.get("priceUsd") or 0),
                            "price_change_5m": float((pair.get("priceChange") or {}).get("m5") or 0),
                            "price_change_1h": float((pair.get("priceChange") or {}).get("h1") or 0),
                            "price_change_24h": float((pair.get("priceChange") or {}).get("h24") or 0),
                            "volume_5m": float((pair.get("volume") or {}).get("m5") or 0),
                            "volume_1h": float((pair.get("volume") or {}).get("h1") or 0),
                            "volume_24h": float((pair.get("volume") or {}).get("h24") or 0),
                            "liquidity_usd": float((pair.get("liquidity") or {}).get("usd") or 0),
                            "market_cap": float(pair.get("marketCap") or pair.get("fdv") or 0),
                            "txns_5m_buys": int((pair.get("txns", {}).get("m5") or {}).get("buys") or 0),
                            "txns_5m_sells": int((pair.get("txns", {}).get("m5") or {}).get("sells") or 0),
                            "txns_1h_buys": int((pair.get("txns", {}).get("h1") or {}).get("buys") or 0),
                            "txns_1h_sells": int((pair.get("txns", {}).get("h1") or {}).get("sells") or 0),
                            "pair_address": pair.get("pairAddress"),
                            "dex_id": pair.get("dexId"),
                            "pair_created_at": pair.get("pairCreatedAt"),
                        }
        except Exception as e:
            print(f"[signals] enrich error: {e}")
            continue
    
    # Merge enriched data into pairs
    for p in pairs:
        mint = p.get("token_mint")
        if mint and mint in token_data:
            p["market"] = token_data[mint]
        elif mint and mint in prices:
            p["market"] = {"price_usd": prices[mint]}
    
    return pairs
