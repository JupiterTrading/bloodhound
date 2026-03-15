"""
Leaderboard — ranked known wallets with live performance data.

GET /v1/leaderboard
  ?category=kol|profitable_trader|all   (default: kol)
  ?timeframe=1d|7d|30d                   (default: 1d)
  ?limit=5..50                           (default: 20)

Performance metric (Phase 1):
  - portfolio_usd: current holdings value from Birdeye — proxy for size/performance.
  - Realized PnL unlocks when ClickHouse trade ingestion is running.

Phase 2 (post-indexing):
  - realized_pnl_usd: sum of profitable closes minus cost basis
  - win_rate: % of trades closed in profit
  - best_token: highest-return position in timeframe
"""

import asyncio
from fastapi import APIRouter, Query, HTTPException
from app.services import supabase as supabase_svc, birdeye
from app.services.redis_cache import cache_get, cache_set

router = APIRouter()

VALID_CATEGORIES = {"kol", "profitable_trader", "all"}
VALID_TIMEFRAMES = {"1d", "7d", "30d"}

# Concurrency cap — Birdeye rate limits at ~30 req/s on Premium
_PORTFOLIO_CONCURRENCY = 8
# Cache TTL (seconds) — portfolio values change infrequently at this granularity
_CACHE_TTL = 900  # 15 minutes


@router.get("")
async def leaderboard(
    category: str = Query("kol", description="kol | smart_money | all"),
    timeframe: str = Query("7d", description="1d | 7d | 30d"),
    limit: int = Query(50, ge=5, le=100),
    sort_by: str = Query("pnl", description="pnl | win_rate | volume | roi | hold_time"),
):
    """
    Ranked wallets from wallet_rankings table with real performance data.
    Returns wallets ordered by the requested metric.
    """
    if category not in {"kol", "smart_money", "sniper", "whale", "all"}:
        raise HTTPException(400, f"Invalid category: {category}")
    if timeframe not in VALID_TIMEFRAMES:
        raise HTTPException(400, f"timeframe must be one of: {sorted(VALID_TIMEFRAMES)}")

    cache_key = f"bh:leaderboard:{category}:{timeframe}:{sort_by}:{limit}"
    if cached := await cache_get(cache_key):
        return cached

    # Fetch from wallet_rankings table
    from app.services.supabase import get_client
    sb = get_client()
    
    # Build query
    query = sb.table("wallet_rankings").select(
        "address, label, twitter_handle, avatar_url, wallet_type, tier, "
        "total_pnl_sol, total_pnl_usd, win_rate, total_trades, "
        "pnl_1d_sol, pnl_7d_sol, pnl_30d_sol, "
        "pnl_1d_usd, pnl_7d_usd, pnl_30d_usd, "
        "volume_7d_usd, avg_hold_time_mins, overall_score, "
        "is_verified, confidence"
    ).eq("is_public", True)
    
    # Filter by category
    if category != "all":
        query = query.eq("wallet_type", category)
    
    # Determine sort column based on timeframe and sort_by
    pnl_col = f"pnl_{timeframe}_usd"
    if timeframe == "1d":
        pnl_col = "pnl_1d_usd"
    elif timeframe == "7d":
        pnl_col = "pnl_7d_usd"
    elif timeframe == "30d":
        pnl_col = "pnl_30d_usd"
    
    # Sort
    if sort_by == "pnl":
        query = query.order(pnl_col, desc=True)
    elif sort_by == "win_rate":
        query = query.order("win_rate", desc=True)
    elif sort_by == "volume":
        query = query.order("volume_7d_usd", desc=True)
    elif sort_by == "hold_time":
        query = query.order("avg_hold_time_mins", desc=True)
    else:  # roi or overall_score
        query = query.order("overall_score", desc=True)
    
    query = query.limit(limit)
    
    try:
        result = query.execute()
        rankings = result.data or []
    except Exception as e:
        print(f"[leaderboard] query error: {e}")
        rankings = []

    # Build response
    entries = []
    for i, row in enumerate(rankings, 1):
        # Calculate ROI if needed
        pnl_usd = row.get(pnl_col, 0) or 0
        volume_usd = row.get("volume_7d_usd", 0) or 0
        roi = (pnl_usd / volume_usd * 100) if volume_usd > 0 else 0
        
        entries.append({
            "rank": i,
            "profile": {
                "id": row["address"],
                "display_name": row.get("label") or row["address"][:8] + "...",
                "twitter_handle": row.get("twitter_handle"),
                "twitter_pfp_url": row.get("avatar_url"),
                "verified": row.get("is_verified", False),
            },
            "pnl_usd": pnl_usd,
            "volume_usd": volume_usd,
            "trade_count": row.get("total_trades", 0),
            "win_rate": row.get("win_rate", 0),
            "roi": roi,
            "avg_hold_time_mins": row.get("avg_hold_time_mins", 0),
            "tier": row.get("tier", "standard"),
            "wallet_type": row.get("wallet_type", "smart_money"),
        })

    response = {
        "rankings": entries,
        "count": len(entries),
        "category": category,
        "timeframe": timeframe,
        "sort_by": sort_by,
    }
    
    await cache_set(cache_key, response, _CACHE_TTL)
    return response


# Legacy endpoint support
@router.get("/legacy")
async def leaderboard_legacy(
    category: str = Query("kol", description="kol | profitable_trader | all"),
    timeframe: str = Query("1d", description="1d | 7d | 30d"),
    limit: int = Query(20, ge=5, le=50),
):
    """
    Legacy leaderboard endpoint (old implementation with Birdeye).
    Kept for backward compatibility.
    """
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of: {sorted(VALID_CATEGORIES)}")
    if timeframe not in VALID_TIMEFRAMES:
        raise HTTPException(400, f"timeframe must be one of: {sorted(VALID_TIMEFRAMES)}")

    cache_key = f"bh:leaderboard:legacy:{category}:{timeframe}:{limit}"
    if cached := await cache_get(cache_key):
        return cached

    # 1. Pull known wallets from Supabase
    db_category = None if category == "all" else category
    wallets = await supabase_svc.list_known_wallets(category=db_category, limit=limit * 2)

    if not wallets:
        result = _empty_response(category, timeframe)
        await cache_set(cache_key, result, _CACHE_TTL)
        return result

    # 2. Fetch portfolio USD for each wallet (Birdeye), with concurrency cap
    addresses = [w["address"] for w in wallets[:limit]]
    portfolio_map = await _batch_portfolio(addresses)

    # 3. Try Supabase for PnL data (returns {} when table is empty — non-fatal)
    pnl_map = await _batch_pnl_from_supabase(addresses, timeframe)

    # 4. Build ranked entries
    entries = []
    for w in wallets[:limit]:
        addr = w["address"]
        port = portfolio_map.get(addr, {})
        pnl = pnl_map.get(addr, {})

        entries.append({
            "rank": 0,  # assigned after sort
            "address": addr,
            "label": w.get("label"),
            "category": w.get("category"),
            "twitter_handle": w.get("twitter_handle"),
            "confidence": w.get("confidence"),
            # Performance (Birdeye)
            "portfolio_usd": port.get("total_usd"),
            "holdings_count": len(port.get("holdings", [])),
            # Performance (ClickHouse — None until indexing runs)
            "realized_pnl_usd": pnl.get("realized_pnl_usd"),
            "trade_count": pnl.get("trade_count"),
            "win_rate": pnl.get("win_rate"),
            "best_token": pnl.get("best_token"),
            # UI helpers
            "pnl_available": bool(pnl),
        })

    # Sort: prioritize realized PnL when available, fall back to portfolio_usd
    def sort_key(e):
        if e["realized_pnl_usd"] is not None:
            return e["realized_pnl_usd"]
        return e["portfolio_usd"] or 0

    entries.sort(key=sort_key, reverse=True)
    for i, e in enumerate(entries, 1):
        e["rank"] = i

    result = {
        "category": category,
        "timeframe": timeframe,
        "entries": entries,
        "count": len(entries),
        "metric": "realized_pnl_usd" if any(e["pnl_available"] for e in entries) else "portfolio_usd",
        "metric_note": (
            "Ranked by realized PnL for the selected timeframe."
            if any(e["pnl_available"] for e in entries)
            else "Ranked by current portfolio value (USD). Realized PnL unlocks after indexing begins."
        ),
    }
    await cache_set(cache_key, result, _CACHE_TTL)
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _batch_portfolio(addresses: list[str]) -> dict[str, dict]:
    """Fetch Birdeye portfolio for a list of addresses with bounded concurrency."""
    sem = asyncio.Semaphore(_PORTFOLIO_CONCURRENCY)
    results: dict[str, dict] = {}

    async def _fetch(addr: str) -> None:
        async with sem:
            try:
                data = await birdeye.get_wallet_portfolio(addr)
                results[addr] = data
            except Exception:
                results[addr] = {}

    await asyncio.gather(*[_fetch(a) for a in addresses])
    return results


async def _batch_pnl_from_supabase(
    addresses: list[str],
    timeframe: str,
) -> dict[str, dict]:
    """
    Pull realized PnL from Supabase wallet_rankings table.
    Returns {} for each address when data is unavailable.
    """
    try:
        from app.services.analytics import get_leaderboard_pnl
        return await get_leaderboard_pnl(addresses, timeframe)
    except Exception:
        return {}


@router.get("/trending")
async def trending_tokens(limit: int = Query(10, ge=5, le=20)):
    """Trending tokens by trade activity in the last 24h."""
    cache_key = f"bh:trending:{limit}"
    if cached := await cache_get(cache_key):
        return cached
    try:
        tokens = await birdeye.get_trending_tokens(limit=limit)
    except Exception:
        tokens = []
    result = {"tokens": tokens, "sort_type": "trending"}
    await cache_set(cache_key, result, 300)  # 5 min
    return result


@router.get("/gainers")
async def token_gainers(
    timeframe: str = Query("24h", pattern="^(1h|24h|7d)$"),
    limit: int = Query(10, ge=5, le=20),
    sort_type: str = Query("gainers", pattern="^(gainers|losers)$"),
):
    """Top gaining or losing tokens by % price change."""
    cache_key = f"bh:gainers:{timeframe}:{sort_type}:{limit}"
    if cached := await cache_get(cache_key):
        return cached
    try:
        tokens = await birdeye.get_gainers_losers(timeframe=timeframe, limit=limit, sort_type=sort_type)
    except Exception:
        tokens = []
    result = {"tokens": tokens, "sort_type": sort_type}
    await cache_set(cache_key, result, 300)  # 5 min
    return result


@router.get("/kol-feed")
async def kol_activity_feed(
    limit: int = Query(50, ge=10, le=200),
    min_usd: float = Query(0.0, ge=0),
    kol_address: str | None = Query(None),
):
    """
    US-B701: Real-time feed of recent KOL trades from ClickHouse.
    Ordered by block_time DESC. Enriched with known wallet labels.
    """
    cache_key = f"bh:kol-feed:{limit}:{min_usd}:{kol_address}"
    if cached := await cache_get(cache_key):
        return cached

    # KOL feed from Supabase wallet_trades
    from app.services.supabase import get_client
    sb = get_client()

    try:
        query = sb.table("wallet_trades").select(
            "tx_signature, block_time, wallet_address, token_address, "
            "token_symbol, trade_type, amount_sol, amount_usd, pnl_sol"
        ).order("block_time", desc=True).limit(limit)

        if kol_address:
            query = query.eq("wallet_address", kol_address)

        result = query.execute()
        trades = result.data or []
    except Exception:
        trades = []

    # Enrich with known wallet labels
    known_wallets = await supabase_svc.list_known_wallets(category="kol", limit=500)
    label_map = {w["address"]: w for w in known_wallets}

    for trade in trades:
        kw = label_map.get(trade.get("wallet_address", ""), {})
        trade["kol_label"] = kw.get("label")
        trade["kol_twitter"] = kw.get("twitter_handle")
        trade["direction"] = trade.get("trade_type", "buy")

    result_data = {"trades": trades, "count": len(trades)}
    await cache_set(cache_key, result_data, 60)
    return result_data


@router.get("/smart-money")
async def smart_money_consensus(
    mint: str = Query(..., description="Token mint address"),
    hours: int = Query(48, ge=1, le=168),
):
    """
    US-B702: Smart money consensus for a token — how many KOLs net-bought vs net-sold.
    """
    cache_key = f"bh:smart-money:{mint}:{hours}"
    if cached := await cache_get(cache_key):
        return cached

    # Smart money consensus from Supabase wallet_trades
    from app.services.supabase import get_client
    sb = get_client()

    try:
        result = sb.table("wallet_trades").select(
            "wallet_address, trade_type, amount_usd"
        ).eq("token_address", mint).execute()
        rows = result.data or []
    except Exception:
        rows = []

    known_wallets = await supabase_svc.list_known_wallets(category="kol", limit=500)
    label_map = {w["address"]: w for w in known_wallets}
    kol_addresses_set = set(w["address"] for w in known_wallets)

    from collections import defaultdict
    trader_totals: dict[str, dict] = defaultdict(lambda: {"bought": 0.0, "sold": 0.0})
    for r in rows:
        addr = r.get("wallet_address", "")
        if addr not in kol_addresses_set:
            continue
        usd = float(r.get("amount_usd", 0) or 0)
        if r.get("trade_type") == "buy":
            trader_totals[addr]["bought"] += usd
        else:
            trader_totals[addr]["sold"] += usd

    kols = []
    buyers = 0
    sellers = 0
    for addr, totals in trader_totals.items():
        net = totals["bought"] - totals["sold"]
        direction = "buying" if net > 0 else "selling" if net < 0 else "neutral"
        if direction == "buying": buyers += 1
        elif direction == "selling": sellers += 1
        kw = label_map.get(addr, {})
        kols.append({
            "address": addr, "label": kw.get("label"),
            "twitter_handle": kw.get("twitter_handle"),
            "bought_usd": round(totals["bought"], 2),
            "sold_usd": round(totals["sold"], 2),
            "net_usd": round(net, 2), "direction": direction,
        })

    kols.sort(key=lambda x: abs(x["net_usd"]), reverse=True)
    total = buyers + sellers
    net_score = round((buyers - sellers) / total, 2) if total > 0 else 0.0

    result_data = {
        "mint": mint, "hours": hours, "buyers": buyers, "sellers": sellers,
        "net_score": net_score, "kol_count": len(kols), "kols": kols[:20],
    }
    await cache_set(cache_key, result_data, 300)
    return result_data


def _empty_response(category: str, timeframe: str) -> dict:
    return {
        "category": category,
        "timeframe": timeframe,
        "entries": [],
        "count": 0,
        "metric": "portfolio_usd",
        "metric_note": "No known wallets found for this category.",
    }
