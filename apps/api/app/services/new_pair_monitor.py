"""
US-B1503 — DexScreener new pair monitor.

Polls DexScreener /latest/dex/pairs/solana?sort=pairCreatedAt every 60s
to detect newly created trading pairs on Solana DEXes (Raydium, Orca, Meteora,
Jupiter, etc.) — complementing the Pump.fun WebSocket for non-Pump tokens.

On each new pair detected:
  1. Emit a pump_fun_new_token signal (type: new_dex_pair) to ClickHouse
  2. Cross-reference against known wallets to surface insider early buys

Pairs seen in the last SEEN_WINDOW_SECS are deduplicated via an in-memory set
(restarts reset it — acceptable for this use case).
"""

import asyncio
import json
import time
from typing import Any

import httpx

from app.services.redis_cache import get_redis

DEXSCREENER_NEW_PAIRS_URL = "https://api.dexscreener.com/token-profiles/latest/v1"
DEXSCREENER_NEW_TOKENS_URL = "https://api.dexscreener.com/token-boosts/latest/v1"
POLL_INTERVAL = 45          # seconds between polls (faster refresh)
SEEN_WINDOW_SECS = 3600     # 1h — pairs older than this are not re-announced
MAX_SEEN_ENTRIES = 5000     # cap memory usage
REDIS_NEW_PAIRS_KEY = "bh:live:new_pairs"
REDIS_MAX_PAIRS = 200       # keep last 200 pairs in Redis

# Launchpad detection patterns
LAUNCHPAD_PATTERNS = {
    "pump_fun": ["pump.fun", "pumpfun"],
    "moonshot": ["moonshot", "dexscreener.com/moonshot"],
    "raydium": ["raydium"],
    "meteora": ["meteora"],
    "orca": ["orca"],
    "jupiter": ["jupiter", "jup.ag"],
}


async def _fetch_new_pairs() -> list[dict[str, Any]]:
    """Fetch newest Solana token profiles from DexScreener."""
    all_profiles = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Fetch token profiles
            r = await client.get(DEXSCREENER_NEW_PAIRS_URL)
            if r.is_success:
                data = r.json()
                if isinstance(data, list):
                    all_profiles.extend(data)
            
            # Also fetch boosted tokens (often new launches)
            r2 = await client.get(DEXSCREENER_NEW_TOKENS_URL)
            if r2.is_success:
                data2 = r2.json()
                if isinstance(data2, list):
                    # Dedupe by tokenAddress
                    seen = {p.get("tokenAddress") for p in all_profiles}
                    for t in data2:
                        if t.get("tokenAddress") not in seen:
                            all_profiles.append(t)
    except Exception:
        pass
    return all_profiles


def _detect_launchpad(profile: dict) -> str:
    """Detect which launchpad a token was launched on."""
    url = (profile.get("url") or "").lower()
    description = (profile.get("description") or "").lower()
    
    for launchpad, patterns in LAUNCHPAD_PATTERNS.items():
        for pattern in patterns:
            if pattern in url or pattern in description:
                return launchpad
    
    return "dex"  # Default to generic DEX


async def run_new_pair_monitor() -> None:
    """
    Long-running new pair polling loop.
    Started from main.py lifespan alongside the wallet poller and pumpfun monitor.
    """
    from app.services import analytics
    from app.services.supabase import get_known_wallet

    print(f"[pairs] new pair monitor started — polling every {POLL_INTERVAL}s")

    seen_pairs: dict[str, float] = {}   # pair_address → first_seen_ts

    while True:
        try:
            profiles = await _fetch_new_pairs()
            now = time.time()

            # Evict old entries to cap memory
            if len(seen_pairs) > MAX_SEEN_ENTRIES:
                cutoff = now - SEEN_WINDOW_SECS
                seen_pairs = {k: v for k, v in seen_pairs.items() if v > cutoff}

            signals: list[dict] = []

            for profile in profiles:
                # DexScreener /token-profiles/latest returns objects with:
                # tokenAddress, chainId, url, description, links, etc.
                chain = profile.get("chainId", "")
                if chain != "solana":
                    continue

                mint = profile.get("tokenAddress", "")
                if not mint or mint in seen_pairs:
                    continue

                seen_pairs[mint] = now

                description = profile.get("description") or ""
                icon = profile.get("icon") or ""
                header = profile.get("header") or ""

                launchpad = _detect_launchpad(profile)
                print(f"[pairs] new token profile: {mint[:8]}... ({launchpad})")

                signals.append({
                    "signal_type": "new_dex_pair",
                    "confidence": "CONFIRMED",
                    "scope": "global",
                    "wallet_address": "",
                    "token_mint": mint,
                    "tx_signature": "",
                    "description": f"New {launchpad.upper()} token: {mint} — {description[:100]}",
                    "metadata": json.dumps({
                        "mint": mint,
                        "chain": chain,
                        "description": description,
                        "icon": icon,
                        "header": header,
                        "dexscreener_url": profile.get("url", ""),
                        "launchpad": launchpad,
                    }),
                })

            if signals:
                # Store in Redis for instant access (fallback when ClickHouse empty)
                try:
                    redis = await get_redis()
                    for sig in signals:
                        meta = json.loads(sig["metadata"]) if isinstance(sig["metadata"], str) else sig["metadata"]
                        launchpad = meta.get("launchpad", "dex")
                        pair_data = {
                            "token_mint": sig["token_mint"],
                            "signal_type": sig["signal_type"],
                            "source": launchpad,
                            "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "description": sig["description"],
                            "metadata": meta,
                        }
                        await redis.lpush(REDIS_NEW_PAIRS_KEY, json.dumps(pair_data))
                    await redis.ltrim(REDIS_NEW_PAIRS_KEY, 0, REDIS_MAX_PAIRS - 1)
                except Exception as e:
                    print(f"[pairs] redis store error: {e}")
                
                # Also store in Supabase
                try:
                    await analytics.insert_signals(signals)
                    print(f"[pairs] {len(signals)} new token signals written")
                except Exception as e:
                    print(f"[pairs] signal insert error: {e}")

        except asyncio.CancelledError:
            print("[pairs] shutting down")
            return
        except Exception as e:
            print(f"[pairs] poll error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
