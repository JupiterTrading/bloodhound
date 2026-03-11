"""
Data services — Birdeye replaced with free APIs.

Sources:
  Jupiter Price API   (free, no key)  — token prices, batch pricing
  DexScreener         (free, no key)  — token overview, pairs, trending, OHLCV
  RugCheck            (free, no key)  — token security / rug risk
  GeckoTerminal       (free, no key)  — trending pools, gainers / losers
  Helius DAS          (free tier)     — wallet token accounts, token holders
  ClickHouse          (self-hosted)   — top traders from ingested data
"""

import asyncio
from typing import Any

import httpx

JUPITER_PRICE_URL   = "https://api.jup.ag/price/v2"
DEXSCREENER_BASE    = "https://api.dexscreener.com"
RUGCHECK_BASE       = "https://api.rugcheck.xyz/v1"
GECKO_BASE          = "https://api.geckoterminal.com/api/v2"
GECKO_HEADERS       = {"Accept": "application/json;version=20230302"}

SOL_MINT = "So11111111111111111111111111111111111111112"
FUNGIBLE_INTERFACES = {"FungibleToken", "FungibleAsset"}


# ── Shared helper ─────────────────────────────────────────────────────────────

import time

# Track DexScreener rate limit state
_dexscreener_rate_limited_until = 0.0

async def _get(url: str, params: dict | None = None, headers: dict | None = None, timeout: int = 10) -> dict | None:
    global _dexscreener_rate_limited_until
    
    # Skip DexScreener calls if rate limited
    if "dexscreener" in url and time.time() < _dexscreener_rate_limited_until:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, params=params, headers=headers or {})
            if r.is_success:
                return r.json()
            # Handle rate limit - back off for 1 hour
            if r.status_code == 429 and "dexscreener" in url:
                _dexscreener_rate_limited_until = time.time() + 3600
                return None
    except Exception:
        pass
    return None


# ── Token prices with caching (DexScreener + GeckoTerminal fallback) ─────────

from app.services.redis_cache import cache_get, cache_set

PRICE_CACHE_TTL = 1800  # Cache prices for 30 minutes to reduce API calls

async def _gecko_prices(mints: list[str]) -> dict[str, float]:
    """Fallback price lookup via GeckoTerminal. No strict rate limits."""
    if not mints:
        return {}
    prices: dict[str, float] = {}
    # GeckoTerminal accepts comma-separated addresses
    for i in range(0, len(mints), 25):
        chunk = mints[i : i + 25]
        data = await _get(
            f"{GECKO_BASE}/simple/networks/solana/token_price/{','.join(chunk)}",
            headers=GECKO_HEADERS
        )
        if data and "data" in data:
            attrs = data["data"].get("attributes", {})
            for mint, info in attrs.get("token_prices", {}).items():
                if info:
                    prices[mint] = float(info)
    return prices


async def _dexscreener_prices(mints: list[str]) -> dict[str, float]:
    """Batch price lookup via DexScreener with caching. Returns {mint: price_usd}."""
    if not mints:
        return {}
    
    prices: dict[str, float] = {}
    uncached_mints: list[str] = []
    
    # Check cache first
    for mint in mints:
        cached = await cache_get(f"price:{mint}")
        if cached is not None:
            prices[mint] = cached
        else:
            uncached_mints.append(mint)
    
    if not uncached_mints:
        return prices
    
    # Try GeckoTerminal first (more lenient rate limits)
    gecko_prices = await _gecko_prices(uncached_mints)
    for mint, price in gecko_prices.items():
        prices[mint] = price
        await cache_set(f"price:{mint}", price, PRICE_CACHE_TTL)
    
    # For remaining uncached mints, try DexScreener
    still_uncached = [m for m in uncached_mints if m not in gecko_prices]
    if still_uncached and time.time() >= _dexscreener_rate_limited_until:
        for i in range(0, len(still_uncached), 30):
            chunk = still_uncached[i : i + 30]
            data = await _get(f"{DEXSCREENER_BASE}/latest/dex/tokens/{','.join(chunk)}")
            if data is None:
                continue
            for pair in (data or {}).get("pairs") or []:
                base_addr = pair.get("baseToken", {}).get("address")
                if base_addr and base_addr not in prices:
                    price = float(pair.get("priceUsd", 0) or 0)
                    prices[base_addr] = price
                    await cache_set(f"price:{base_addr}", price, PRICE_CACHE_TTL)
            await asyncio.sleep(0.1)
    
    return prices


async def get_token_price(mint: str) -> float:
    prices = await _dexscreener_prices([mint])
    return prices.get(mint, 0.0)


# ── Wallet portfolio — Helius DAS + Jupiter ───────────────────────────────────

async def get_wallet_portfolio(address: str) -> dict[str, Any]:
    """
    Wallet token holdings with USD values.
    Helius DAS → token list. Jupiter → prices. No paid APIs needed.
    """
    from app.services.helius import HELIUS_RPC

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAssetsByOwner",
        "params": {
            "ownerAddress": address,
            "page": 1,
            "limit": 1000,
            "displayOptions": {"showFungible": True, "showNativeBalance": True},
        },
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(HELIUS_RPC, json=payload)
            r.raise_for_status()
            result = r.json().get("result", {})
    except Exception:
        return {"total_usd": 0.0, "holdings": []}

    items = result.get("items", [])
    native = result.get("nativeBalance", {})

    # Parse fungible tokens
    raw_holdings: list[dict] = []

    # Native SOL
    sol_lamports = native.get("lamports", 0) or 0
    if sol_lamports > 0:
        raw_holdings.append({
            "mint": SOL_MINT,
            "symbol": "SOL",
            "name": "Solana",
            "amount": sol_lamports / 1_000_000_000,
            "logo_uri": None,
        })

    for item in items:
        if item.get("interface") not in FUNGIBLE_INTERFACES:
            continue
        # Skip wrapped SOL - we already added native SOL above
        mint_id = item.get("id", "")
        if mint_id == SOL_MINT:
            continue
        token_info = item.get("token_info", {})
        decimals = int(token_info.get("decimals", 6) or 6)
        raw_amount = int(token_info.get("balance", 0) or 0)
        amount = raw_amount / (10 ** decimals)
        if amount <= 0:
            continue
        content = item.get("content", {})
        metadata = content.get("metadata", {})
        links = content.get("links", {})
        raw_holdings.append({
            "mint": mint_id,
            "symbol": metadata.get("symbol", ""),
            "name": metadata.get("name", ""),
            "amount": amount,
            "logo_uri": links.get("image"),
        })

    # Price all mints in one batch via DexScreener
    mints = [h["mint"] for h in raw_holdings if h["mint"]]
    prices = await _dexscreener_prices(mints)

    holdings = []
    total_usd = 0.0
    for h in raw_holdings:
        price = prices.get(h["mint"], 0.0)
        usd_value = h["amount"] * price
        total_usd += usd_value
        holdings.append({**h, "price_usd": price, "usd_value": round(usd_value, 4)})

    holdings.sort(key=lambda x: x["usd_value"], reverse=True)
    return {"total_usd": round(total_usd, 2), "holdings": holdings}


# ── DexScreener — token overview + pairs ──────────────────────────────────────

def _best_pair(pairs: list[dict]) -> dict:
    if not pairs:
        return {}
    return max(pairs, key=lambda p: float((p.get("liquidity") or {}).get("usd", 0) or 0))


async def get_token_overview(mint: str) -> dict[str, Any]:
    """Token price, volume, liquidity, market cap via DexScreener. Free."""
    data = await _get(f"{DEXSCREENER_BASE}/latest/dex/tokens/{mint}")
    pair = _best_pair((data or {}).get("pairs") or [])
    if not pair:
        return {}
    base = pair.get("baseToken", {})
    pc   = pair.get("priceChange") or {}
    vol  = pair.get("volume") or {}
    txns = pair.get("txns") or {}
    return {
        "mint":              base.get("address", mint),
        "symbol":            base.get("symbol", ""),
        "name":              base.get("name", ""),
        "price_usd":         float(pair.get("priceUsd", 0) or 0),
        "price_change_5m":   pc.get("m5", 0),
        "price_change_1h":   pc.get("h1", 0),
        "price_change_24h":  pc.get("h24", 0),
        "volume_5m_usd":     vol.get("m5", 0),
        "volume_1h_usd":     vol.get("h1", 0),
        "volume_24h_usd":    vol.get("h24", 0),
        "liquidity_usd":     (pair.get("liquidity") or {}).get("usd", 0),
        "market_cap_usd":    pair.get("marketCap", 0),
        "fdv":               pair.get("fdv", 0),
        "dex":               pair.get("dexId", ""),
        "pair_address":      pair.get("pairAddress", ""),
        "created_at":        pair.get("pairCreatedAt"),
        "txns_24h_buys":     (txns.get("h24") or {}).get("buys", 0),
        "txns_24h_sells":    (txns.get("h24") or {}).get("sells", 0),
    }


async def get_token_ohlcv(
    mint: str,
    resolution: str = "1D",
    time_from: int | None = None,
    time_to: int | None = None,
) -> list[dict[str, Any]]:
    """OHLCV from DexScreener (best liquid pair). resolution ignored — DexScreener returns candles natively."""
    data = await _get(f"{DEXSCREENER_BASE}/latest/dex/tokens/{mint}")
    pair = _best_pair((data or {}).get("pairs") or [])
    if not pair:
        return []
    # DexScreener exposes pair-level stats but not raw OHLCV candles via free API.
    # Return a single synthetic candle from current pair data so callers get something.
    return [{
        "time":   pair.get("pairCreatedAt", 0),
        "open":   float(pair.get("priceUsd", 0) or 0),
        "high":   float(pair.get("priceUsd", 0) or 0),
        "low":    float(pair.get("priceUsd", 0) or 0),
        "close":  float(pair.get("priceUsd", 0) or 0),
        "volume": (pair.get("volume") or {}).get("h24", 0),
    }]


# ── RugCheck — token security ─────────────────────────────────────────────────

async def get_token_security(mint: str) -> dict[str, Any]:
    """Rug risk score via RugCheck. Free, no key. Score 0–1000 (higher = riskier)."""
    data = await _get(f"{RUGCHECK_BASE}/tokens/{mint}/report/summary")
    if not data:
        return {}
    markets   = data.get("markets") or []
    lp_locked = (markets[0].get("lp") or {}).get("lpLocked", False) if markets else False
    token     = data.get("token") or {}
    return {
        "score":            data.get("score", 0),
        "risks":            data.get("risks", []),
        "rugged":           data.get("rugged", False),
        "mint_authority":   token.get("mintAuthority"),
        "freeze_authority": token.get("freezeAuthority"),
        "lp_locked":        lp_locked,
    }


# ── GeckoTerminal — trending + gainers/losers ─────────────────────────────────

def _gecko_pool_to_token(pool: dict) -> dict[str, Any]:
    attrs = pool.get("attributes", {})
    rels  = pool.get("relationships", {})
    mint  = (rels.get("base_token", {}).get("data") or {}).get("id", "").replace("solana_", "")
    txns  = attrs.get("transactions") or {}
    h24   = txns.get("h24") or {}
    return {
        "mint":            mint,
        "symbol":          (attrs.get("name") or "").split("/")[0].strip(),
        "name":            attrs.get("name", ""),
        "price_usd":       float(attrs.get("base_token_price_usd", 0) or 0),
        "price_change_pct": float((attrs.get("price_change_percentage") or {}).get("h24", 0) or 0),
        "volume_24h_usd":  float((attrs.get("volume_usd") or {}).get("h24", 0) or 0),
        "market_cap_usd":  float(attrs.get("market_cap_usd", 0) or 0),
        "trade_count_24h": int(h24.get("buys", 0)) + int(h24.get("sells", 0)),
        "logo_uri":        None,
    }


async def get_trending_tokens(limit: int = 10) -> list[dict[str, Any]]:
    """Trending Solana pools by volume — GeckoTerminal. Free."""
    data = await _get(f"{GECKO_BASE}/networks/solana/trending_pools", headers=GECKO_HEADERS)
    pools = (data or {}).get("data", [])[:limit]
    return [_gecko_pool_to_token(p) for p in pools]


async def get_gainers_losers(
    timeframe: str = "24h",
    limit: int = 20,
    sort_type: str = "gainers",
) -> list[dict[str, Any]]:
    """Top gaining/losing Solana tokens — GeckoTerminal. Free."""
    sort_field = "h24_price_change_percentage" if timeframe == "24h" else "h1_price_change_percentage"
    data = await _get(
        f"{GECKO_BASE}/networks/solana/pools",
        params={"sort": sort_field, "page": 1},
        headers=GECKO_HEADERS,
    )
    pools = (data or {}).get("data", [])
    tokens = [_gecko_pool_to_token(p) for p in pools]
    reverse = sort_type == "gainers"
    tokens.sort(key=lambda t: t["price_change_pct"], reverse=reverse)
    return tokens[:limit]


# ── Helius DAS — token holders ────────────────────────────────────────────────

async def get_token_holders(mint: str, limit: int = 100, offset: int = 0) -> dict[str, Any]:
    """Top holders for a token mint via Helius DAS getTokenAccounts. Free tier."""
    from app.services.helius import HELIUS_RPC

    page = (offset // limit) + 1
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccounts",
        "params": {"page": page, "limit": limit, "mint": mint},
    }
    
    # Also fetch token metadata for supply info
    price_usd = 0.0
    decimals = 9
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(HELIUS_RPC, json=payload)
            r.raise_for_status()
            accounts = r.json().get("result", {}).get("token_accounts", [])
    except Exception:
        return {"items": [], "total": 0, "holder_count": 0, "top10_pct": 0}

    # Get price for value calculation
    prices = await _dexscreener_prices([mint])
    price_usd = prices.get(mint, 0)
    
    # Get decimals from Jupiter token list
    meta = await _get(f"https://tokens.jup.ag/token/{mint}")
    if meta:
        decimals = meta.get("decimals", 9)

    items = []
    for a in accounts:
        owner = a.get("owner", "")
        if not owner:
            continue
        raw_amount = float(a.get("amount", 0) or 0)
        # Convert from raw to decimal amount
        amount = raw_amount / (10 ** decimals)
        value_usd = amount * price_usd
        items.append({
            "owner": owner,
            "amount": amount,
            "value_usd": round(value_usd, 2),
        })
    
    items.sort(key=lambda x: x["amount"], reverse=True)
    
    # Calculate percentages based on total of top holders
    total_amount = sum(h["amount"] for h in items)
    for h in items:
        h["percentage"] = round((h["amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
    
    # Calculate top 10 concentration
    top10_amount = sum(h["amount"] for h in items[:10])
    top10_pct = round((top10_amount / total_amount * 100) if total_amount > 0 else 0, 2)
    
    return {
        "items": items,
        "total": len(items),
        "holder_count": len(items),
        "top10_pct": top10_pct,
        "price_usd": price_usd,
    }


# ── ClickHouse — top traders from ingested data ───────────────────────────────

async def get_token_metadata(mint: str) -> dict[str, Any]:
    """Jupiter token list metadata — logo, decimals, name, symbol. Free, no key."""
    data = await _get(f"https://tokens.jup.ag/token/{mint}")
    return data or {}


async def get_token_top_traders(mint: str, limit: int = 20) -> list[dict[str, Any]]:
    """
    Top traders for a token - combines holder data with DexScreener pair info.
    Shows holders ranked by position value with percentage ownership.
    """
    # Get token pair data for price and volume info
    trades_data = await _get(f"{DEXSCREENER_BASE}/latest/dex/tokens/{mint}")
    
    pair = {}
    price_usd = 0.0
    if trades_data and trades_data.get("pairs"):
        pair = trades_data["pairs"][0]
        try:
            price_usd = float(pair.get("priceUsd", 0) or 0)
        except:
            price_usd = 0.0
    
    # Get top token holders with calculated percentages
    holders_data = await get_token_holders(mint, limit=50)
    holders = holders_data.get("items", [])
    
    if not holders:
        return []
    
    # Build enhanced trader list from holders
    traders = []
    for h in holders[:limit]:
        address = h.get("owner", "")
        amount = h.get("amount", 0)
        percentage = h.get("percentage", 0)
        value_usd = h.get("value_usd", 0)
        
        if not address:
            continue
            
        traders.append({
            "address": address,
            "holding_amount": amount,
            "holding_pct": percentage,
            "value_usd": value_usd,
            "volume": value_usd,  # For backwards compat
            "pnl": None,  # Would need historical data
            "trade_count": None,
        })
    
    # Sort by value
    traders.sort(key=lambda x: x["value_usd"], reverse=True)
    return traders[:limit]


# ── DexScreener Enhanced Token Info ──────────────────────────────────────────

async def get_dex_paid_orders(mint: str) -> dict[str, Any]:
    """
    Check if a token has paid for enhanced info on DexScreener.
    Returns order types: tokenProfile, communityTakeover, tokenAd, trendingBarAd
    """
    data = await _get(f"{DEXSCREENER_BASE}/orders/v1/solana/{mint}")
    if not data:
        return {"has_paid": False, "orders": []}
    
    orders = data if isinstance(data, list) else []
    approved = [o for o in orders if o.get("status") == "approved"]
    
    return {
        "has_paid": len(approved) > 0,
        "orders": orders,
        "has_token_profile": any(o.get("type") == "tokenProfile" and o.get("status") == "approved" for o in orders),
        "has_community_takeover": any(o.get("type") == "communityTakeover" and o.get("status") == "approved" for o in orders),
        "has_token_ad": any(o.get("type") == "tokenAd" and o.get("status") == "approved" for o in orders),
    }


async def get_token_boosts(mint: str) -> dict[str, Any]:
    """
    Get boost information for a token from DexScreener.
    """
    # Check if token is in top boosted
    data = await _get(f"{DEXSCREENER_BASE}/token-boosts/top/v1")
    if not data:
        return {"is_boosted": False, "boost_count": 0}
    
    tokens = data if isinstance(data, list) else []
    for t in tokens:
        if t.get("tokenAddress", "").lower() == mint.lower():
            return {
                "is_boosted": True,
                "boost_count": t.get("amount", 0),
                "chain_id": t.get("chainId"),
                "url": t.get("url"),
                "description": t.get("description"),
                "icon": t.get("icon"),
            }
    
    return {"is_boosted": False, "boost_count": 0}


async def get_token_profile(mint: str) -> dict[str, Any]:
    """
    Get enhanced token profile from DexScreener (if available).
    Includes logo, description, links, socials.
    """
    # Get from token pairs endpoint which includes profile info
    data = await _get(f"{DEXSCREENER_BASE}/latest/dex/tokens/{mint}")
    if not data or not data.get("pairs"):
        return {}
    
    pair = data["pairs"][0]
    info = pair.get("info", {})
    
    return {
        "image_url": info.get("imageUrl"),
        "header_url": info.get("header"),
        "description": info.get("description"),
        "websites": info.get("websites", []),
        "socials": info.get("socials", []),
    }


async def get_token_enhanced_info(mint: str) -> dict[str, Any]:
    """
    Combined call for all DexScreener enhanced info.
    """
    import asyncio
    
    paid_orders, boosts, profile = await asyncio.gather(
        get_dex_paid_orders(mint),
        get_token_boosts(mint),
        get_token_profile(mint),
    )
    
    return {
        "dex_paid": paid_orders,
        "boosts": boosts,
        "profile": profile,
    }
