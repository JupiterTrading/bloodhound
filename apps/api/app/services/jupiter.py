"""
Jupiter Price API v2 — real-time token price lookup.
Used to enrich transfers and trades with USD values at ingest time.
Free, no API key required. Batch up to 100 mints per request.
"""

import httpx
from app.services.redis_cache import cache_get, cache_set

JUPITER_PRICE_URL = "https://api.jup.ag/price/v2"

# Canonical wrapped SOL mint address.
# We normalise the "SOL" shorthand to this before API calls.
SOL_MINT = "So11111111111111111111111111111111111111112"

CHUNK_SIZE = 100
PRICE_TTL = 60  # seconds — fresh enough for ingest, low Jupiter load


async def get_prices_batch(mints: list[str]) -> dict[str, float]:
    """
    Fetch USD prices for a list of mint addresses from Jupiter Price API v2.

    Returns {mint: price_usd}. Mints with no price data are omitted.
    "SOL" (shorthand) is normalised to SOL_MINT and an alias is returned
    so callers can look up either form.

    Results are individually cached for PRICE_TTL seconds.
    """
    if not mints:
        return {}

    # Normalise "SOL" shorthand → wrapped SOL mint
    normalised = [SOL_MINT if m == "SOL" else m for m in mints]
    unique = list(dict.fromkeys(normalised))  # deduplicate, preserve order

    prices: dict[str, float] = {}

    # --- Cache lookup ---
    uncached: list[str] = []
    for mint in unique:
        cached = await cache_get(f"bh:price:{mint}")
        if cached is not None:
            prices[mint] = float(cached)
        else:
            uncached.append(mint)

    # --- Jupiter batch fetch for cache misses ---
    if uncached:
        async with httpx.AsyncClient(timeout=10) as client:
            for i in range(0, len(uncached), CHUNK_SIZE):
                chunk = uncached[i : i + CHUNK_SIZE]
                try:
                    resp = await client.get(
                        JUPITER_PRICE_URL,
                        params={"ids": ",".join(chunk)},
                    )
                    if resp.status_code != 200:
                        print(f"[jupiter] price API {resp.status_code} for chunk {i}")
                        continue

                    data = resp.json().get("data", {})
                    for mint, info in data.items():
                        price_str = info.get("price")
                        if price_str is not None:
                            price = float(price_str)
                            prices[mint] = price
                            await cache_set(f"bh:price:{mint}", price, ttl=PRICE_TTL)

                except Exception as e:
                    print(f"[jupiter] price fetch error (chunk {i}): {e}")

    # Restore "SOL" alias so callers that use "SOL" as token_mint also match
    if SOL_MINT in prices:
        prices["SOL"] = prices[SOL_MINT]

    return prices
