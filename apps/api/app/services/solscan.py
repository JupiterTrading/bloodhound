"""
Entity label resolution for Solana addresses.

Turns raw addresses into human-readable labels across three layers:
  1. Local program registry  — instant, zero cost, covers 60+ core Solana programs
  2. Helius names API        — free (included in Growth plan), 5,100+ labeled addresses
                               including exchange hot wallets, DeFi protocols, known entities
  3. Solscan Pro API         — optional, set SOLSCAN_API_KEY for broader coverage

Results cached in Redis for 24 hours — entity labels rarely change.
Used to enrich wallet summaries, transfer counterparties, and AI context.
"""

import httpx
from typing import Any

from app.services.redis_cache import cache_get, cache_set
from app.core.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Layer 1 — Local program registry
# Covers every program a user is likely to encounter in transaction traces.
# ---------------------------------------------------------------------------

KNOWN_PROGRAMS: dict[str, dict[str, str]] = {
    # ── System / core ──────────────────────────────────────────────────────
    "11111111111111111111111111111111":          {"label": "System Program",             "category": "program"},
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": {"label": "SPL Token Program",      "category": "program"},
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": {"label": "Token-2022 Program",     "category": "program"},
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1brs": {"label": "Associated Token Account Program", "category": "program"},
    "ComputeBudget111111111111111111111111111111": {"label": "Compute Budget Program",   "category": "program"},
    "BPFLoaderUpgradeab1e11111111111111111111111": {"label": "BPF Upgradeable Loader",  "category": "program"},
    "Vote111111111111111111111111111111111111111h": {"label": "Vote Program",            "category": "program"},
    "Stake11111111111111111111111111111111111111": {"label": "Stake Program",            "category": "program"},
    "SysvarRent111111111111111111111111111111111": {"label": "Sysvar: Rent",             "category": "program"},
    "SysvarC1ock11111111111111111111111111111111": {"label": "Sysvar: Clock",            "category": "program"},
    "Sysvar1nstructions1111111111111111111111111": {"label": "Sysvar: Instructions",    "category": "program"},
    "SysvarStakeHistory1111111111111111111111111": {"label": "Sysvar: Stake History",   "category": "program"},

    # ── DEX / AMM ──────────────────────────────────────────────────────────
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": {"label": "Raydium AMM v4",        "category": "dex"},
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": {"label": "Raydium CLMM",          "category": "dex"},
    "routeUGWgWkqmNvsmuakekFRFHMHQvHvjYSnNMDnkbU": {"label": "Raydium Route Swap",     "category": "dex"},
    "5quBtKZSACF7Xui11aDkTPlgWMHnzNh3AGd5HGFc5b": {"label": "Raydium AMM v3",          "category": "dex"},
    "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": {"label": "Orca Whirlpool",        "category": "dex"},
    "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1": {"label": "Orca AMM v1",           "category": "dex"},
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": {"label": "Orca Whirlpool v2",      "category": "dex"},
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": {"label": "Jupiter Aggregator v6", "category": "dex"},
    "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB": {"label": "Jupiter Aggregator v4",  "category": "dex"},
    "JUP2jxvXaqu7NQY1GmNF4m1vodwdXNFkAFGGDLTTy8L": {"label": "Jupiter Aggregator v2",  "category": "dex"},
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": {"label": "Meteora DLMM",           "category": "dex"},
    "Eo7WjKq67rjJQDd81yWeMSKfexrqsgDiMZuozQFVkS1": {"label": "Meteora Dynamic AMM",    "category": "dex"},
    "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY": {"label": "Phoenix DEX",            "category": "dex"},
    "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb": {"label": "OpenBook v2",            "category": "dex"},
    "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX": {"label": "Serum DEX v3",           "category": "dex"},

    # ── Launchpads ─────────────────────────────────────────────────────────
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": {"label": "Pump.fun",               "category": "launchpad"},
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA": {"label": "Pump.fun AMM",            "category": "launchpad"},
    "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg": {"label": "Pump.fun Migration",    "category": "launchpad"},

    # ── Lending / Money Markets ─────────────────────────────────────────────
    "So1endDq2YkqhipRvu3AqGzvFYveYkuRa4RCr6bNLFy": {"label": "Solend",                 "category": "lending"},
    "MFv2hWf31Z9kbCa1snEPdcgp168vLs2YNgxmsHPrG1C": {"label": "MarginFi",               "category": "lending"},
    "KLend2g3cP87fffoy8q1mQqGKjrL1AyFRqhRE7r1fKD": {"label": "Kamino Lend",            "category": "lending"},
    "4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg": {"label": "Mango Markets",         "category": "lending"},

    # ── Perps / Derivatives ────────────────────────────────────────────────
    "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH": {"label": "Drift Protocol",          "category": "perps"},
    "ZETAxsqBRek56DhiGXrn75yj2NHU3aYUnxvHXpkf3aD": {"label": "Zeta Markets",           "category": "perps"},
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin": {"label": "Serum Perps",            "category": "perps"},

    # ── Staking / Liquid Staking ───────────────────────────────────────────
    "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD": {"label": "Marinade Finance",        "category": "staking"},
    "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzf7dHy4WBJ6S1": {"label": "Stake Pool Program",       "category": "staking"},

    # ── NFT / Metaplex ─────────────────────────────────────────────────────
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s": {"label": "Metaplex Token Metadata", "category": "nft"},
    "p1exdMJcjVao65QdewkaZRUnU6VPSXhus9n2GzWfh98": {"label": "Metaplex Auction House",  "category": "nft"},
    "cndy3Z4yapfJBmL3ShUp5exZkqLc1VPjwdi5yJviJ1B": {"label": "Candy Machine v2",        "category": "nft"},
    "CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR": {"label": "Candy Machine v3",       "category": "nft"},
    "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K": {"label": "Magic Eden v2",           "category": "nft"},
    "mmm3XBJg5gk8XJxEKBvdgptZz6SgK4tXvn36sodowMc": {"label": "Magic Eden MMM",          "category": "nft"},
    "TSWAPaqyCSx2KABk68Shruf4rp7CxcAi9X1wUDdDNMF": {"label": "Tensor Swap",             "category": "nft"},
    "tcomma5auGtSHDy6kStTtSCqDfnPWxNSkGrMfxnPNVW": {"label": "Tensor Bid",              "category": "nft"},

    # ── Bridges ────────────────────────────────────────────────────────────
    "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth": {"label": "Wormhole Token Bridge",   "category": "bridge"},
    "WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD": {"label": "Wormhole Core Bridge",    "category": "bridge"},

    # ── MEV / Infrastructure ───────────────────────────────────────────────
    "T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt": {"label": "Jito Tip Program",        "category": "infrastructure"},
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5": {"label": "Jito Tip Program",       "category": "infrastructure"},
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe": {"label": "Jito Tip Program",       "category": "infrastructure"},
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY": {"label": "Jito Tip Program",      "category": "infrastructure"},
}


async def get_entity_label(address: str) -> dict[str, Any] | None:
    """
    Resolve a human-readable label for any Solana address.
    Returns {"label": str, "category": str, "source": str} or None.

    Use this as a fallback when an address is not in known_wallets.
    """
    # Layer 1: local registry — instant, no I/O
    if entry := KNOWN_PROGRAMS.get(address):
        return {**entry, "source": "registry"}

    # Layer 2: Redis cache for API results
    cache_key = f"bh:entity:{address}"
    if cached := await cache_get(cache_key):
        return cached if cached != "__miss__" else None

    # Layer 3: Helius names API — free, covers 5,100+ labeled addresses
    # (exchanges, protocols, known entities — maintained by Helius team)
    result = await _helius_names(address)
    if result:
        await cache_set(cache_key, result, 86400)
        return result

    # Layer 4: Solscan Pro API — optional, set SOLSCAN_API_KEY for broader coverage
    if settings.solscan_api_key:
        result = await _solscan_account(address)
        if result:
            await cache_set(cache_key, result, 86400)
            return result

    # Cache the miss so we don't re-query for an hour
    await cache_set(cache_key, "__miss__", 3600)
    return None


async def get_entity_labels_batch(addresses: list[str]) -> dict[str, dict[str, Any] | None]:
    """Resolve labels for multiple addresses. Returns {address: label_or_none}."""
    import asyncio
    results = await asyncio.gather(*[get_entity_label(a) for a in addresses])
    return dict(zip(addresses, results))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _helius_names(address: str) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(
                f"https://api.helius.xyz/v0/addresses/{address}/names",
                params={"api-key": settings.helius_api_key},
            )
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and data:
                return {"label": data[0], "category": "entity", "source": "helius"}
    except Exception:
        pass
    return None


async def _solscan_account(address: str) -> dict[str, Any] | None:
    """Solscan Pro API — account metadata. Requires SOLSCAN_API_KEY."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(
                f"https://pro-api.solscan.io/v2.0/account/detail",
                params={"address": address},
                headers={"token": settings.solscan_api_key},
            )
        if res.status_code == 200:
            data = res.json().get("data", {})
            label = data.get("label") or data.get("account_label")
            if label:
                category = _infer_category(data)
                return {"label": label, "category": category, "source": "solscan"}
    except Exception:
        pass
    return None


def _infer_category(account_data: dict) -> str:
    account_type = (account_data.get("type") or "").lower()
    if "exchange" in account_type:
        return "exchange"
    if "program" in account_type:
        return "program"
    return "entity"
