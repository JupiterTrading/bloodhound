"""
Token API endpoints.
GET /v1/token/{mint}/summary
GET /v1/token/{mint}/holders
GET /v1/token/{mint}/top-traders
GET /v1/token/{mint}/large-trades
GET /v1/token/{mint}/security
GET /v1/token/{mint}/launch-intel
"""

import asyncio

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

    overview, security, meta = await asyncio.gather(
        _safe(birdeye.get_token_overview(mint), default={}),
        _safe(birdeye.get_token_security(mint), default={}),
        _safe(birdeye.get_token_metadata(mint), default={}),
    )

    is_pump = await _safe(_is_pump_fun(mint, overview), default=None)

    result = {
        "mint": mint,
        "name": overview.get("name") or meta.get("name"),
        "symbol": overview.get("symbol") or meta.get("symbol"),
        "decimals": meta.get("decimals"),
        "supply": None,
        "price_usd": overview.get("price_usd"),
        "market_cap_usd": overview.get("market_cap_usd"),
        "volume_24h_usd": overview.get("volume_24h_usd"),
        "price_change_24h_pct": overview.get("price_change_24h"),
        "liquidity_usd": overview.get("liquidity_usd"),
        "holder_count": None,
        "logo_uri": meta.get("logoURI"),
        "security_score": security.get("score"),
        "is_pump_fun": is_pump,
        "pair_address": overview.get("pair_address"),
        "dex": overview.get("dex"),
        "fdv": overview.get("fdv"),
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
        "holder_count": holder_data.get("holder_count", len(holders)),
        "top10_pct": holder_data.get("top10_pct", 0),
        "price_usd": holder_data.get("price_usd", 0),
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


@router.get("/{mint}/dex-info")
async def token_dex_info(mint: str):
    """DexScreener enhanced info: paid orders, boosts, profile."""
    cache_key = token_key(mint, "dex-info")
    if cached := await cache_get(cache_key):
        return cached

    enhanced = await _safe(birdeye.get_token_enhanced_info(mint), default={})
    result = {"mint": mint, **enhanced}
    await cache_set(cache_key, result, TTL_PRICE)  # Cache 5 min
    return result


@router.get("/{mint}/large-trades")
async def token_large_trades(
    mint: str,
    limit: int = Query(20, ge=1, le=50),
):
    """Recent significant swaps for a token from ClickHouse."""
    from app.services import clickhouse

    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
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
    early_buyers_result = await asyncio.to_thread(
        client.query,
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
    buyers = [dict(zip(early_buyers_result.column_names, row)) for row in early_buyers_result.result_rows]

    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(b.get("trader", "")), default=None) for b in buyers]
    )
    for b, known in zip(buyers, known_results):
        b["known_wallet"] = known

    # Bundler detection: wallets that appear in Jito bundles for this token
    bundler_result = await asyncio.to_thread(
        client.query,
        """
        SELECT count() AS bundle_count
        FROM transactions
        WHERE source_platform = 'jito'
          AND has(signers, {mint:String}) = 0
          AND block_time >= (
              SELECT min(block_time) FROM token_trades WHERE token_out_mint = {mint:String}
          )
        LIMIT 1
        """,
        parameters={"mint": mint},
    )
    bundler_count = int(bundler_result.result_rows[0][0] or 0) if bundler_result.result_rows else 0

    is_pump = await _is_pump_fun(mint)

    return {
        "mint": mint,
        "early_buyers": buyers,
        "is_pump_fun": is_pump,
        "graduation_status": "graduated" if is_pump and len(buyers) >= 50 else ("bonding" if is_pump else None),
        "bundler_detected": bundler_count > 0,
        "bundler_tx_count": bundler_count,
    }


@router.get("/{mint}/twitter")
async def token_twitter(mint: str):
    """
    Tweet narrative for a token: recent mention count + sample tweets.
    Uses the token symbol from Birdeye to search Twitter.
    Requires Twitter Elevated API access for search — returns requires_elevated flag if not available.
    """
    cache_key = token_key(mint, "twitter")
    if cached := await cache_get(cache_key):
        return cached

    # Get symbol from summary
    overview = await _safe(birdeye.get_token_overview(mint), default={})
    symbol = (overview or {}).get("symbol")

    if not symbol:
        return {"mint": mint, "symbol": None, "twitter": None}

    from app.services.twitter import get_token_tweet_volume
    twitter_data = await _safe(get_token_tweet_volume(symbol), default={"tweet_count": 0, "sample_tweets": [], "requires_elevated": False})

    result = {"mint": mint, "symbol": symbol, "twitter": twitter_data}
    await cache_set(cache_key, result, 900)  # 15 min
    return result


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


PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"


async def _is_pump_fun(mint: str, overview: dict | None = None) -> bool | None:
    """
    Heuristic: check if token was created via pump.fun program.
    Uses Helius DAS getAsset to inspect the token's creators/authorities.
    """
    import httpx
    from app.services.helius import HELIUS_RPC

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                HELIUS_RPC,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getAsset",
                    "params": {"id": mint},
                },
            )
            if resp.status_code != 200:
                return None
            asset = resp.json().get("result", {})

            # Check creators list
            for creator in asset.get("creators", []):
                if creator.get("address") == PUMP_FUN_PROGRAM:
                    return True

            # Check authorities
            for auth in asset.get("authorities", []):
                if auth.get("address") == PUMP_FUN_PROGRAM:
                    return True

            # Check grouping (collection address is pump.fun for bonding curve tokens)
            grouping = asset.get("grouping", [])
            for g in grouping:
                if g.get("group_value") == PUMP_FUN_PROGRAM:
                    return True

            return False
    except Exception:
        return None


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default
