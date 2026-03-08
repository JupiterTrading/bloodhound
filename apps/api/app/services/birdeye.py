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

async def _get(url: str, params: dict | None = None, headers: dict | None = None, timeout: int = 10) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, params=params, headers=headers or {})
            if r.is_success:
                return r.json()
    except Exception:
        pass
    return None


# ── Jupiter — batch token prices ──────────────────────────────────────────────

async def _jupiter_prices(mints: list[str]) -> dict[str, float]:
    """Batch price lookup. Returns {mint: price_usd}. Free, no key needed."""
    if not mints:
        return {}
    prices: dict[str, float] = {}
    for i in range(0, len(mints), 100):
        chunk = mints[i : i + 100]
        data = await _get(JUPITER_PRICE_URL, params={"ids": ",".join(chunk)})
        for mint, info in (data or {}).get("data", {}).items():
            prices[mint] = float(info.get("price", 0) or 0)
    return prices


async def get_token_price(mint: str) -> float:
    prices = await _jupiter_prices([mint])
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
            "mint": item.get("id", ""),
            "symbol": metadata.get("symbol", ""),
            "name": metadata.get("name", ""),
            "amount": amount,
            "logo_uri": links.get("image"),
        })

    # Price all mints in one batch
    mints = [h["mint"] for h in raw_holdings if h["mint"]]
    prices = await _jupiter_prices(mints)

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
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(HELIUS_RPC, json=payload)
            r.raise_for_status()
            accounts = r.json().get("result", {}).get("token_accounts", [])
    except Exception:
        return {"items": [], "total": 0}

    items = [
        {"address": a.get("owner", ""), "amount": float(a.get("amount", 0) or 0)}
        for a in accounts
        if a.get("owner")
    ]
    items.sort(key=lambda x: x["amount"], reverse=True)
    return {"items": items, "total": len(items)}


# ── ClickHouse — top traders from ingested data ───────────────────────────────

async def get_token_metadata(mint: str) -> dict[str, Any]:
    """Jupiter token list metadata — logo, decimals, name, symbol. Free, no key."""
    data = await _get(f"https://tokens.jup.ag/token/{mint}")
    return data or {}


async def get_token_top_traders(mint: str, limit: int = 20) -> list[dict[str, Any]]:
    """
    Top traders by volume from ClickHouse (wallets we've ingested).
    Coverage grows as users search/track wallets and backfills accumulate.
    """
    from app.services import clickhouse

    client = clickhouse.get_client()
    try:
        result = await asyncio.to_thread(
            client.query,
            """
            SELECT
                trader,
                count()            AS trade_count,
                sum(amount_usd)    AS volume_usd,
                sum(realized_pnl_usd) AS pnl_usd
            FROM token_trades
            WHERE token_out_mint = {mint:String}
               OR token_in_mint  = {mint:String}
            GROUP BY trader
            ORDER BY volume_usd DESC
            LIMIT {limit:UInt32}
            """,
            parameters={"mint": mint, "limit": limit},
        )
        return [
            {
                "address":     row[0],
                "trade_count": int(row[1]),
                "volume_usd":  float(row[2]),
                "pnl_usd":     float(row[3]),
            }
            for row in result.result_rows
        ]
    except Exception:
        return []
