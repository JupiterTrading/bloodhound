"""
Token API endpoints.
GET /v1/token/{mint}/summary
GET /v1/token/{mint}/holders
GET /v1/token/{mint}/top-traders
GET /v1/token/{mint}/large-trades
GET /v1/token/{mint}/security
GET /v1/token/{mint}/launch-intel
"""

from fastapi import APIRouter, Query
from app.services import birdeye
from app.services import supabase as supabase_svc
from app.services.redis_cache import (
    cache_get, cache_set, token_key,
    TTL_PRICE, TTL_HISTORICAL,
)

router = APIRouter()


@router.get("/{mint}/summary")
async def token_summary(mint: str):
    """Token metadata, supply, deployer, launch date, pump.fun status."""
    cache_key = token_key(mint, "summary")
    if cached := await cache_get(cache_key):
        return cached

    overview = await _safe(birdeye.get_token_overview(mint), default={})
    security = await _safe(birdeye.get_token_security(mint), default={})

    result = {
        "mint": mint,
        "name": overview.get("name"),
        "symbol": overview.get("symbol"),
        "decimals": overview.get("decimals"),
        "supply": overview.get("supply"),
        "price_usd": overview.get("price"),
        "market_cap_usd": overview.get("mc"),
        "volume_24h_usd": overview.get("v24hUSD"),
        "price_change_24h_pct": overview.get("priceChange24hPercent"),
        "liquidity_usd": overview.get("liquidity"),
        "holder_count": overview.get("holder"),
        "logo_uri": overview.get("logoURI"),
        "security_score": security.get("score"),
        "is_pump_fun": _is_pump_fun(mint, overview),
    }

    await cache_set(cache_key, result, TTL_PRICE)
    return result


@router.get("/{mint}/holders")
async def token_holders(
    mint: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Ranked holder list with known wallet labels where available."""
    cache_key = token_key(mint, f"holders:{offset}:{limit}")
    if cached := await cache_get(cache_key):
        return cached

    holder_data = await _safe(birdeye.get_token_holders(mint, limit=limit, offset=offset), default={})
    holders = holder_data.get("items", []) or []

    import asyncio
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(h.get("owner", "")), default=None) for h in holders]
    )
    for h, known in zip(holders, known_results):
        h["known_wallet"] = known

    result = {
        "mint": mint,
        "total": holder_data.get("total", len(holders)),
        "holders": holders,
    }
    await cache_set(cache_key, result, TTL_HISTORICAL)
    return result


@router.get("/{mint}/top-traders")
async def token_top_traders(
    mint: str,
    limit: int = Query(20, ge=1, le=50),
):
    """Wallets with highest volume + PnL for this token."""
    cache_key = token_key(mint, f"top-traders:{limit}")
    if cached := await cache_get(cache_key):
        return cached

    traders = await _safe(birdeye.get_token_top_traders(mint, limit=limit), default=[])

    import asyncio
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(t.get("address", "")), default=None) for t in traders]
    )
    for t, known in zip(traders, known_results):
        t["known_wallet"] = known

    result = {"mint": mint, "traders": traders}
    await cache_set(cache_key, result, TTL_HISTORICAL)
    return result


@router.get("/{mint}/security")
async def token_security(mint: str):
    """Birdeye security score, rug risk, LP lock status."""
    cache_key = token_key(mint, "security")
    if cached := await cache_get(cache_key):
        return cached

    security = await _safe(birdeye.get_token_security(mint), default={})
    result = {"mint": mint, **security}
    await cache_set(cache_key, result, TTL_HISTORICAL)
    return result


@router.get("/{mint}/large-trades")
async def token_large_trades(
    mint: str,
    limit: int = Query(20, ge=1, le=50),
):
    """Recent significant swaps for a token from ClickHouse."""
    from app.services import clickhouse

    client = clickhouse.get_client()
    result = client.query(
        """
        SELECT
            tx_signature, block_time, trader, dex,
            token_in_mint, token_out_mint,
            amount_in, amount_out, amount_usd
        FROM token_trades
        WHERE (token_in_mint = {mint:String} OR token_out_mint = {mint:String})
          AND amount_usd > 1000
        ORDER BY block_time DESC
        LIMIT {limit:UInt32}
        """,
        parameters={"mint": mint, "limit": limit},
    )
    trades = [dict(zip(result.column_names, row)) for row in result.result_rows]

    import asyncio
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(t.get("trader", "")), default=None) for t in trades]
    )
    for t, known in zip(trades, known_results):
        t["known_wallet"] = known

    return {"mint": mint, "trades": trades}


@router.get("/{mint}/launch-intel")
async def token_launch_intel(mint: str):
    """
    Pump.fun launch intelligence: bundler wallets, insider wallets, dev wallet activity.
    """
    from app.services import clickhouse

    client = clickhouse.get_client()

    # First 50 buyers
    early_buyers = client.query(
        """
        SELECT DISTINCT
            trader,
            min(block_time) AS first_buy,
            sum(amount_usd) AS total_bought_usd
        FROM token_trades
        WHERE token_out_mint = {mint:String}
        GROUP BY trader
        ORDER BY first_buy ASC
        LIMIT 50
        """,
        parameters={"mint": mint},
    )
    buyers = [dict(zip(early_buyers.column_names, row)) for row in early_buyers.result_rows]

    import asyncio
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(b.get("trader", "")), default=None) for b in buyers]
    )
    for b, known in zip(buyers, known_results):
        b["known_wallet"] = known

    return {
        "mint": mint,
        "early_buyers": buyers,
        "is_pump_fun": None,   # TODO: derive from token metadata / program
        "graduation_status": None,  # TODO: Pump.fun API
        "bundler_detected": False,  # TODO: Jito bundle detection
    }


@router.get("/{mint}/ohlcv")
async def token_ohlcv(
    mint: str,
    resolution: str = Query("1D", pattern="^(1m|5m|15m|1H|4H|1D|1W)$"),
    time_from: int | None = None,
    time_to: int | None = None,
):
    """OHLCV price history for a token. resolution: 1m, 5m, 15m, 1H, 4H, 1D, 1W."""
    cache_key = token_key(mint, f"ohlcv:{resolution}:{time_from}:{time_to}")
    if cached := await cache_get(cache_key):
        return cached

    items = await _safe(birdeye.get_token_ohlcv(mint, resolution, time_from, time_to), default=[])
    result = {"mint": mint, "resolution": resolution, "items": items}
    await cache_set(cache_key, result, TTL_PRICE)
    return result


def _is_pump_fun(mint: str, overview: dict) -> bool | None:
    """Heuristic: if the token was created via pump.fun program."""
    # Pump.fun tokens often have a recognizable metadata pattern
    # Full detection needs tx history check
    return None


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default
