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

DEXSCREENER_NEW_PAIRS_URL = "https://api.dexscreener.com/token-profiles/latest/v1"
POLL_INTERVAL = 60          # seconds between polls
SEEN_WINDOW_SECS = 3600     # 1h — pairs older than this are not re-announced
MAX_SEEN_ENTRIES = 5000     # cap memory usage


async def _fetch_new_pairs() -> list[dict[str, Any]]:
    """Fetch newest Solana token profiles from DexScreener."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(DEXSCREENER_NEW_PAIRS_URL)
            if r.is_success:
                return r.json() if isinstance(r.json(), list) else []
    except Exception:
        pass
    return []


async def run_new_pair_monitor() -> None:
    """
    Long-running new pair polling loop.
    Started from main.py lifespan alongside the wallet poller and pumpfun monitor.
    """
    from app.services import clickhouse
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

                print(f"[pairs] new token profile: {mint[:8]}...")

                signals.append({
                    "signal_type": "new_dex_pair",
                    "confidence": "CONFIRMED",
                    "scope": "global",
                    "wallet_address": "",
                    "token_mint": mint,
                    "tx_signature": "",
                    "description": f"New Solana token profile detected: {mint} — {description[:100]}",
                    "metadata": json.dumps({
                        "mint": mint,
                        "chain": chain,
                        "description": description,
                        "icon": icon,
                        "header": header,
                        "dexscreener_url": profile.get("url", ""),
                    }),
                })

            if signals:
                try:
                    await clickhouse.insert_signals(signals)
                    print(f"[pairs] {len(signals)} new token signals written")
                except Exception as e:
                    print(f"[pairs] signal insert error: {e}")

        except asyncio.CancelledError:
            print("[pairs] shutting down")
            return
        except Exception as e:
            print(f"[pairs] poll error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
