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
    category: str = Query("kol", description="kol | profitable_trader | all"),
    timeframe: str = Query("1d", description="1d | 7d | 30d"),
    limit: int = Query(20, ge=5, le=50),
):
    """
    Ranked known wallets with live portfolio value from Birdeye.

    Returns wallets ordered by current portfolio_usd descending.
    When ClickHouse data is available, also returns realized_pnl_usd
    and trade_count for the requested timeframe.
    """
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of: {sorted(VALID_CATEGORIES)}")
    if timeframe not in VALID_TIMEFRAMES:
        raise HTTPException(400, f"timeframe must be one of: {sorted(VALID_TIMEFRAMES)}")

    cache_key = f"bh:leaderboard:{category}:{timeframe}:{limit}"
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

    # 3. Try ClickHouse for PnL data (returns {} when table is empty — non-fatal)
    pnl_map = await _batch_pnl_from_clickhouse(addresses, timeframe)

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


async def _batch_pnl_from_clickhouse(
    addresses: list[str],
    timeframe: str,
) -> dict[str, dict]:
    """
    Pull realized PnL from ClickHouse trades table.
    Returns {} for each address when ClickHouse is empty or unavailable.
    Non-fatal — leaderboard degrades gracefully to portfolio_usd fallback.
    """
    try:
        from app.services.clickhouse import get_leaderboard_pnl
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

    kol_addresses = await supabase_svc.get_kol_addresses()
    if not kol_addresses:
        return {"trades": [], "count": 0}

    from app.services import clickhouse
    client = clickhouse.get_client()

    # Build query
    kol_phs = ", ".join([f"{{k_{i}:String}}" for i in range(len(kol_addresses))])
    params: dict = {f"k_{i}": addr for i, addr in enumerate(kol_addresses)}
    params["limit"] = limit
    params["min_usd"] = min_usd

    extra_cond = ""
    if kol_address:
        extra_cond = "AND trader = {kol_address:String}"
        params["kol_address"] = kol_address

    query = f"""
        SELECT
            tx_signature, block_time, trader, dex,
            token_in_mint, token_out_mint,
            amount_in, amount_out, amount_usd, realized_pnl_usd
        FROM token_trades
        WHERE trader IN ({kol_phs})
          AND amount_usd >= {{min_usd:Float64}}
          {extra_cond}
        ORDER BY block_time DESC
        LIMIT {{limit:UInt32}}
    """

    try:
        result = await asyncio.to_thread(client.query, query, parameters=params)
        trades = [dict(zip(result.column_names, row)) for row in result.result_rows]
    except Exception:
        trades = []

    # Enrich with known wallet labels
    known_wallets = await supabase_svc.list_known_wallets(category="kol", limit=500)
    label_map = {w["address"]: w for w in known_wallets}

    for trade in trades:
        kw = label_map.get(trade["trader"], {})
        trade["kol_label"] = kw.get("label")
        trade["kol_twitter"] = kw.get("twitter_handle")
        # Classify as buy or sell: buying token_out with SOL/stable → buy, else sell
        trade["direction"] = "buy" if trade.get("token_in_mint") in (
            "So11111111111111111111111111111111111111112",   # SOL
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  # USDT
        ) else "sell"

    result_data = {"trades": trades, "count": len(trades)}
    await cache_set(cache_key, result_data, 60)  # 1 min cache — near real-time
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

    kol_addresses = await supabase_svc.get_kol_addresses()
    if not kol_addresses:
        return {"mint": mint, "buyers": 0, "sellers": 0, "net_score": 0, "kols": []}

    from app.services import clickhouse
    client = clickhouse.get_client()

    kol_phs = ", ".join([f"{{k_{i}:String}}" for i in range(len(kol_addresses))])
    params: dict = {f"k_{i}": a for i, a in enumerate(kol_addresses)}
    params["mint"] = mint
    params["hours"] = hours

    query = f"""
        SELECT
            trader,
            sumIf(amount_usd, token_out_mint = {{mint:String}}) AS bought_usd,
            sumIf(amount_usd, token_in_mint  = {{mint:String}}) AS sold_usd
        FROM token_trades
        WHERE trader IN ({kol_phs})
          AND (token_out_mint = {{mint:String}} OR token_in_mint = {{mint:String}})
          AND block_time >= now() - INTERVAL {{hours:UInt32}} HOUR
        GROUP BY trader
    """

    try:
        result = await asyncio.to_thread(client.query, query, parameters=params)
        rows = result.result_rows
    except Exception:
        rows = []

    known_wallets = await supabase_svc.list_known_wallets(category="kol", limit=500)
    label_map = {w["address"]: w for w in known_wallets}

    kols = []
    buyers = 0
    sellers = 0
    for trader, bought_usd, sold_usd in rows:
        net = float(bought_usd or 0) - float(sold_usd or 0)
        direction = "buying" if net > 0 else "selling" if net < 0 else "neutral"
        if direction == "buying":
            buyers += 1
        elif direction == "selling":
            sellers += 1
        kw = label_map.get(trader, {})
        kols.append({
            "address": trader,
            "label": kw.get("label"),
            "twitter_handle": kw.get("twitter_handle"),
            "bought_usd": round(float(bought_usd or 0), 2),
            "sold_usd": round(float(sold_usd or 0), 2),
            "net_usd": round(net, 2),
            "direction": direction,
        })

    kols.sort(key=lambda x: abs(x["net_usd"]), reverse=True)
    total = buyers + sellers
    net_score = round((buyers - sellers) / total, 2) if total > 0 else 0.0

    result_data = {
        "mint": mint,
        "hours": hours,
        "buyers": buyers,
        "sellers": sellers,
        "net_score": net_score,  # +1.0 = all buying, -1.0 = all selling
        "kol_count": len(kols),
        "kols": kols[:20],
    }
    await cache_set(cache_key, result_data, 300)  # 5 min
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
