"""
US-B1502 — Pump.fun WebSocket monitor.

Connects to wss://pumpportal.fun/api/data and subscribes to:
  - New token creation events (subscribeNewToken)
  - First-buyer trades for each new token (subscribeTokenTrade)

On each new token launch:
  1. Write a signal to ClickHouse (pump_fun_new_token)
  2. Subscribe to its trade stream to capture first N buyers
  3. Cross-reference early buyers against known_wallets

Runs as a long-lived background task started from main.py lifespan.
Reconnects automatically on disconnect (exponential backoff, max 60s).
"""

import asyncio
import json
import time
from typing import Any

from app.services.redis_cache import get_redis

PUMPFUN_WS_URL = "wss://pumpportal.fun/api/data"
REDIS_NEW_PAIRS_KEY = "bh:live:new_pairs"
REDIS_MAX_PAIRS = 200
EARLY_BUYER_WINDOW_SECS = 120   # track trades within 2 min of launch
MAX_EARLY_BUYERS = 50           # cap per token
RECONNECT_BASE = 2.0            # initial reconnect delay in seconds
RECONNECT_MAX = 60.0


async def _connect_and_listen() -> None:
    """
    Core WebSocket loop. Subscribes to new tokens, reacts to events.
    Raises on connection failure so the caller can retry.
    """
    try:
        import websockets  # type: ignore
    except ImportError:
        print("[pumpfun] websockets package not installed — skipping monitor")
        return

    from app.services import analytics
    from app.services.supabase import get_known_wallet

    async with websockets.connect(PUMPFUN_WS_URL, ping_interval=20, ping_timeout=30) as ws:
        print("[pumpfun] connected to pumpportal.fun")

        # Subscribe to all new token creation events
        await ws.send(json.dumps({"method": "subscribeNewToken"}))

        # State: mint → {launch_ts, buyer_count}
        active_tokens: dict[str, dict[str, Any]] = {}

        async for raw in ws:
            try:
                event = json.loads(raw)
            except Exception:
                continue

            tx_type = event.get("txType")

            # ── New token launch ───────────────────────────────────────────
            if tx_type == "create":
                mint = event.get("mint", "")
                deployer = event.get("traderPublicKey", "")
                symbol = event.get("symbol", "")
                name = event.get("name", "")
                market_cap_sol = float(event.get("marketCapSol") or 0)

                if not mint:
                    continue

                print(f"[pumpfun] new token ${symbol} ({mint[:8]}...) deployer={deployer[:8]}...")

                active_tokens[mint] = {
                    "launch_ts": time.time(),
                    "buyer_count": 0,
                    "early_buyers": [],
                    "symbol": symbol,
                    "deployer": deployer,
                }

                # Persist as signal
                signal = {
                    "signal_type": "pump_fun_new_token",
                    "confidence": "CONFIRMED",
                    "scope": "global",
                    "wallet_address": deployer,
                    "token_mint": mint,
                    "tx_signature": event.get("signature", ""),
                    "description": f"New Pump.fun token ${symbol} ({name}) launched — market cap {market_cap_sol:.1f} SOL",
                    "metadata": json.dumps({
                        "mint": mint,
                        "symbol": symbol,
                        "name": name,
                        "deployer": deployer,
                        "market_cap_sol": market_cap_sol,
                        "bonding_curve": event.get("bondingCurveKey", ""),
                    }),
                }
                # Store in Redis for instant access
                try:
                    redis = await get_redis()
                    pair_data = {
                        "token_mint": mint,
                        "signal_type": "pump_fun_new_token",
                        "source": "pump_fun",
                        "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "description": signal["description"],
                        "metadata": {
                            "mint": mint,
                            "symbol": symbol,
                            "name": name,
                            "deployer": deployer,
                            "market_cap_sol": market_cap_sol,
                        },
                    }
                    await redis.lpush(REDIS_NEW_PAIRS_KEY, json.dumps(pair_data))
                    await redis.ltrim(REDIS_NEW_PAIRS_KEY, 0, REDIS_MAX_PAIRS - 1)
                except Exception as e:
                    print(f"[pumpfun] redis store error: {e}")
                
                # Also store in Supabase
                try:
                    await analytics.insert_signals([signal])
                except Exception as e:
                    print(f"[pumpfun] signal insert error: {e}")

                # Subscribe to trade stream for this token to capture early buyers
                await ws.send(json.dumps({"method": "subscribeTokenTrade", "keys": [mint]}))

            # ── Token trade (early buyer capture) ─────────────────────────
            elif tx_type in ("buy", "sell"):
                mint = event.get("mint", "")
                trader = event.get("traderPublicKey", "")

                if not mint or not trader or mint not in active_tokens:
                    continue

                token_state = active_tokens[mint]
                age = time.time() - token_state["launch_ts"]

                if age > EARLY_BUYER_WINDOW_SECS:
                    # Unsubscribe and clean up
                    await ws.send(json.dumps({"method": "unsubscribeTokenTrade", "keys": [mint]}))
                    del active_tokens[mint]
                    continue

                if tx_type == "buy" and token_state["buyer_count"] < MAX_EARLY_BUYERS:
                    sol_amount = float(event.get("solAmount") or 0) / 1e9
                    token_state["buyer_count"] += 1
                    token_state["early_buyers"].append(trader)

                    # Cross-reference against known wallets
                    try:
                        known = await get_known_wallet(trader)
                    except Exception:
                        known = None

                    label = (known or {}).get("label")
                    if known:
                        print(
                            f"[pumpfun] KNOWN wallet early buy ${token_state['symbol']}: "
                            f"{label} ({trader[:8]}...) — {sol_amount:.2f} SOL"
                        )
                        # Emit insider signal
                        insider_signal = {
                            "signal_type": "insider_identified",
                            "confidence": "PROBABLE",
                            "scope": "token",
                            "wallet_address": trader,
                            "token_mint": mint,
                            "tx_signature": event.get("signature", ""),
                            "description": (
                                f"Known wallet ({label}) bought ${token_state['symbol']} "
                                f"within {int(age)}s of launch — {sol_amount:.2f} SOL"
                            ),
                            "metadata": json.dumps({
                                "mint": mint,
                                "symbol": token_state["symbol"],
                                "buyer": trader,
                                "known_label": label,
                                "sol_amount": sol_amount,
                                "seconds_after_launch": int(age),
                                "buyer_rank": token_state["buyer_count"],
                            }),
                        }
                        try:
                            await analytics.insert_signals([insider_signal])
                        except Exception as e:
                            print(f"[pumpfun] insider signal insert error: {e}")


async def run_pumpfun_monitor() -> None:
    """
    Long-running Pump.fun WebSocket monitor with automatic reconnect.
    Started from main.py lifespan alongside the wallet poller.
    """
    delay = RECONNECT_BASE
    while True:
        try:
            await _connect_and_listen()
            # _connect_and_listen returned cleanly (e.g. websockets not installed) — exit
            return
        except asyncio.CancelledError:
            print("[pumpfun] shutting down")
            return
        except Exception as e:
            print(f"[pumpfun] disconnected: {e} — reconnecting in {delay:.0f}s")
            await asyncio.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX)
        else:
            delay = RECONNECT_BASE  # reset on clean iteration
