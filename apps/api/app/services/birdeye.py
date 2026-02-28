"""
Birdeye API integration — token prices, portfolio valuations, DEX data, security scores.
"""

import httpx
from typing import Any
from app.core.config import get_settings

settings = get_settings()
BIRDEYE_BASE = "https://public-api.birdeye.so"


def _headers() -> dict[str, str]:
    return {
        "X-API-KEY": settings.birdeye_api_key,
        "x-chain": "solana",
    }


async def get_wallet_portfolio(address: str) -> dict[str, Any]:
    """
    Get total portfolio USD value and all token holdings for a wallet.
    Returns: {total_usd: float, holdings: list}
    """
    url = f"{BIRDEYE_BASE}/v1/wallet/token_list"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(url, headers=_headers(), params={"wallet": address})
        response.raise_for_status()
        data = response.json()

    items = data.get("data", {}).get("items", [])
    total_usd = sum(item.get("valueUsd", 0) or 0 for item in items)

    holdings = [
        {
            "mint": item.get("address", ""),
            "symbol": item.get("symbol", ""),
            "name": item.get("name", ""),
            "amount": item.get("uiAmount", 0),      # matches TokenHolding.amount
            "price_usd": item.get("priceUsd", 0),
            "usd_value": item.get("valueUsd", 0),   # matches TokenHolding.usd_value
            "logo_uri": item.get("logoURI"),
        }
        for item in items
    ]

    return {"total_usd": total_usd, "holdings": holdings}


async def get_token_price(mint: str) -> float:
    """Get current USD price for a token mint."""
    url = f"{BIRDEYE_BASE}/defi/price"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, headers=_headers(), params={"address": mint})
        response.raise_for_status()
        data = response.json()
    return float(data.get("data", {}).get("value", 0) or 0)


async def get_token_security(mint: str) -> dict[str, Any]:
    """Birdeye security score: rug risk, LP lock, owner concentration."""
    url = f"{BIRDEYE_BASE}/defi/token_security"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, headers=_headers(), params={"address": mint})
        response.raise_for_status()
        data = response.json()
    return data.get("data", {}) or {}


async def get_token_overview(mint: str) -> dict[str, Any]:
    """Token metadata, supply, market cap, 24h volume, price change."""
    url = f"{BIRDEYE_BASE}/defi/token_overview"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, headers=_headers(), params={"address": mint})
        response.raise_for_status()
        data = response.json()
    return data.get("data", {}) or {}


async def get_token_holders(mint: str, limit: int = 100, offset: int = 0) -> dict[str, Any]:
    """Top token holders ranked by amount."""
    url = f"{BIRDEYE_BASE}/defi/v3/token/holder"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            url,
            headers=_headers(),
            params={"address": mint, "limit": limit, "offset": offset},
        )
        response.raise_for_status()
        data = response.json()
    return data.get("data", {}) or {}


async def get_token_top_traders(mint: str, limit: int = 20) -> list[dict[str, Any]]:
    """Top traders by volume for a token (with PnL where available)."""
    url = f"{BIRDEYE_BASE}/defi/v2/tokens/top_traders"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            url,
            headers=_headers(),
            params={"address": mint, "limit": limit},
        )
        response.raise_for_status()
        data = response.json()
    return data.get("data", {}).get("items", []) or []


async def get_token_ohlcv(
    mint: str,
    resolution: str = "1D",
    time_from: int | None = None,
    time_to: int | None = None,
) -> list[dict[str, Any]]:
    """OHLCV price history for a token. resolution: 1m, 5m, 15m, 1H, 4H, 1D."""
    url = f"{BIRDEYE_BASE}/defi/ohlcv"
    params: dict[str, Any] = {"address": mint, "type": resolution}
    if time_from:
        params["time_from"] = time_from
    if time_to:
        params["time_to"] = time_to

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(url, headers=_headers(), params=params)
        response.raise_for_status()
        data = response.json()
    return data.get("data", {}).get("items", []) or []
