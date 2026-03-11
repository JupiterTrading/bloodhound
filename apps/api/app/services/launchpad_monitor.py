"""
Multi-launchpad WebSocket monitor for real-time token detection.

Subscribes to Solana program logs via logsSubscribe to detect new token
launches from multiple launchpads in real-time:
  - Bags.fm (BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv)
  - LetsBonk.fun (LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj)
  - Believe (via Meteora DBC with authority 5qWya6UjwWnGVhdSBL3hyZ7B45jbk6Byt1hwd7ohEGXE)
  - Boop.fun (tracked via common patterns)
  - Raydium LaunchLab (via Raydium program)

Uses Helius WebSocket endpoint for reliable real-time log streaming.
"""

import asyncio
import json
import time
import re
from typing import Any

from app.core.config import get_settings
from app.services.redis_cache import get_redis

settings = get_settings()

# Helius WebSocket URL (derived from RPC URL)
HELIUS_WS_URL = f"wss://mainnet.helius-rpc.com/?api-key={settings.helius_api_key}"

# Redis key for new pairs
REDIS_NEW_PAIRS_KEY = "bh:live:new_pairs"
REDIS_MAX_PAIRS = 200

# Launchpad program addresses and authorities
LAUNCHPADS = {
    "bags": {
        "name": "Bags.fm",
        "signer": "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv",
        "method": "mintTo",
    },
    "letsbonk": {
        "name": "LetsBonk",
        "program": "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
        "method": "initialize_v2",
    },
    "believe": {
        "name": "Believe",
        "program": "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",  # Meteora DBC
        "authority": "5qWya6UjwWnGVhdSBL3hyZ7B45jbk6Byt1hwd7ohEGXE",
        "method": "initialize_virtual_pool_with_spl_token",
    },
    "boop": {
        "name": "Boop.fun",
        "program": "boop8hVGQGqehUK2iVEeEnNWAg9E33yKEo4JhGBRLPG",  # Boop program
    },
    "launchlab": {
        "name": "LaunchLab",
        "program": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",  # Raydium LaunchLab
    },
}

# Program addresses to monitor (subscribe to logs)
MONITORED_PROGRAMS = [
    "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",  # LetsBonk
    "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",  # Meteora DBC (Believe, Jupiter Studio)
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",  # Raydium LaunchLab
    "boop8hVGQGqehUK2iVEeEnNWAg9E33yKEo4JhGBRLPG",  # Boop.fun
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",  # SPL Token (for Bags mintTo)
]

# Reconnect settings
RECONNECT_BASE = 2.0
RECONNECT_MAX = 60.0

# Deduplication
seen_tokens: dict[str, float] = {}
SEEN_WINDOW_SECS = 3600
MAX_SEEN = 5000


def _extract_mint_from_logs(logs: list[str], program_id: str) -> str | None:
    """
    Extract token mint address from transaction logs.
    Different launchpads encode the mint differently in their logs.
    """
    # Common patterns for mint addresses in logs
    mint_patterns = [
        r"Mint: ([1-9A-HJ-NP-Za-km-z]{32,44})",
        r"mint[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})",
        r"token[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})",
        r"Program log: ([1-9A-HJ-NP-Za-km-z]{43,44})",  # Raw pubkey in log
    ]
    
    for log in logs:
        for pattern in mint_patterns:
            match = re.search(pattern, log, re.IGNORECASE)
            if match:
                candidate = match.group(1)
                # Validate it looks like a Solana address
                if len(candidate) >= 32 and len(candidate) <= 44:
                    return candidate
    
    return None


def _detect_launchpad(logs: list[str], program_id: str) -> tuple[str, str] | None:
    """
    Detect which launchpad created the token based on program and logs.
    Returns (launchpad_key, display_name) or None.
    """
    log_text = " ".join(logs).lower()
    
    # Check for Bags.fm (mintTo from specific signer)
    if LAUNCHPADS["bags"]["signer"].lower() in log_text:
        return ("bags", "Bags.fm")
    
    # Check for LetsBonk
    if program_id == LAUNCHPADS["letsbonk"]["program"]:
        if "initialize" in log_text:
            return ("letsbonk", "LetsBonk")
    
    # Check for Believe (Meteora DBC with Believe authority)
    if program_id == LAUNCHPADS["believe"]["program"]:
        if LAUNCHPADS["believe"]["authority"].lower() in log_text:
            return ("believe", "Believe")
        # Could be Jupiter Studio or other Meteora DBC user
        return ("meteora_dbc", "Meteora DBC")
    
    # Check for Boop.fun
    if program_id == LAUNCHPADS["boop"]["program"]:
        return ("boop", "Boop.fun")
    
    # Check for Raydium LaunchLab
    if program_id == LAUNCHPADS["launchlab"]["program"]:
        return ("launchlab", "LaunchLab")
    
    return None


async def _fetch_token_metadata(mint: str) -> dict[str, Any]:
    """Fetch token metadata from on-chain or DexScreener."""
    import httpx
    
    metadata = {"mint": mint, "symbol": None, "name": None, "icon": None}
    
    # Try Jupiter token list first (fast)
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"https://tokens.jup.ag/token/{mint}")
            if r.is_success:
                data = r.json()
                metadata["symbol"] = data.get("symbol")
                metadata["name"] = data.get("name")
                metadata["icon"] = data.get("logoURI")
    except Exception:
        pass
    
    return metadata


async def _store_new_pair(
    mint: str,
    launchpad: str,
    launchpad_name: str,
    signature: str,
    deployer: str | None = None,
) -> None:
    """Store detected new pair in Redis and ClickHouse."""
    from app.services import clickhouse
    
    global seen_tokens
    now = time.time()
    
    # Dedupe
    if mint in seen_tokens:
        return
    seen_tokens[mint] = now
    
    # Evict old entries
    if len(seen_tokens) > MAX_SEEN:
        cutoff = now - SEEN_WINDOW_SECS
        seen_tokens = {k: v for k, v in seen_tokens.items() if v > cutoff}
    
    # Fetch metadata
    metadata = await _fetch_token_metadata(mint)
    
    print(f"[launchpad] NEW {launchpad_name}: {metadata.get('symbol') or mint[:8]}... ({mint[:12]}...)")
    
    # Build pair data
    pair_data = {
        "token_mint": mint,
        "signal_type": f"{launchpad}_new_token",
        "source": launchpad,
        "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "description": f"New {launchpad_name} token: {metadata.get('symbol') or mint[:8]}",
        "metadata": {
            "mint": mint,
            "symbol": metadata.get("symbol"),
            "name": metadata.get("name"),
            "icon": metadata.get("icon"),
            "deployer": deployer,
            "launchpad": launchpad,
            "launchpad_name": launchpad_name,
        },
    }
    
    # Store in Redis
    try:
        redis = await get_redis()
        await redis.lpush(REDIS_NEW_PAIRS_KEY, json.dumps(pair_data))
        await redis.ltrim(REDIS_NEW_PAIRS_KEY, 0, REDIS_MAX_PAIRS - 1)
    except Exception as e:
        print(f"[launchpad] redis error: {e}")
    
    # Store in ClickHouse
    signal = {
        "signal_type": f"{launchpad}_new_token",
        "confidence": "CONFIRMED",
        "scope": "global",
        "wallet_address": deployer or "",
        "token_mint": mint,
        "tx_signature": signature,
        "description": pair_data["description"],
        "metadata": json.dumps(pair_data["metadata"]),
    }
    try:
        await clickhouse.insert_signals([signal])
    except Exception as e:
        print(f"[launchpad] clickhouse error: {e}")


async def _process_log_notification(notification: dict) -> None:
    """Process a logsNotification from the WebSocket."""
    result = notification.get("params", {}).get("result", {})
    value = result.get("value", {})
    
    signature = value.get("signature", "")
    logs = value.get("logs", [])
    err = value.get("err")
    
    # Skip failed transactions
    if err:
        return
    
    if not logs or not signature:
        return
    
    # Check which program this is from
    log_text = " ".join(logs)
    
    for program_id in MONITORED_PROGRAMS:
        if program_id in log_text:
            # Detect launchpad
            launchpad_info = _detect_launchpad(logs, program_id)
            if not launchpad_info:
                continue
            
            launchpad_key, launchpad_name = launchpad_info
            
            # Extract mint address
            mint = _extract_mint_from_logs(logs, program_id)
            if not mint:
                continue
            
            # Store the new pair
            await _store_new_pair(
                mint=mint,
                launchpad=launchpad_key,
                launchpad_name=launchpad_name,
                signature=signature,
            )
            break


async def _subscribe_to_programs(ws) -> None:
    """Subscribe to logs for all monitored programs."""
    for i, program_id in enumerate(MONITORED_PROGRAMS):
        subscribe_msg = {
            "jsonrpc": "2.0",
            "id": i + 1,
            "method": "logsSubscribe",
            "params": [
                {"mentions": [program_id]},
                {"commitment": "confirmed"}
            ]
        }
        await ws.send(json.dumps(subscribe_msg))
        print(f"[launchpad] subscribed to {program_id[:8]}...")


async def _connect_and_listen() -> None:
    """
    Connect to Helius WebSocket and listen for program logs.
    """
    try:
        import websockets
    except ImportError:
        print("[launchpad] websockets package not installed — skipping monitor")
        return
    
    async with websockets.connect(
        HELIUS_WS_URL,
        ping_interval=30,
        ping_timeout=60,
        max_size=10 * 1024 * 1024,  # 10MB max message size
    ) as ws:
        print(f"[launchpad] connected to Helius WebSocket")
        
        # Subscribe to all monitored programs
        await _subscribe_to_programs(ws)
        
        # Listen for notifications
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            
            # Handle subscription confirmations
            if "result" in msg and isinstance(msg.get("result"), int):
                print(f"[launchpad] subscription confirmed: {msg['result']}")
                continue
            
            # Handle log notifications
            if msg.get("method") == "logsNotification":
                try:
                    await _process_log_notification(msg)
                except Exception as e:
                    print(f"[launchpad] process error: {e}")


async def run_launchpad_monitor() -> None:
    """
    Long-running launchpad monitor with automatic reconnect.
    Monitors multiple launchpads for new token creation events.
    """
    print("[launchpad] multi-launchpad monitor starting...")
    delay = RECONNECT_BASE
    
    while True:
        try:
            await _connect_and_listen()
            return  # Clean exit (e.g., websockets not installed)
        except asyncio.CancelledError:
            print("[launchpad] shutting down")
            return
        except Exception as e:
            print(f"[launchpad] disconnected: {e} — reconnecting in {delay:.0f}s")
            await asyncio.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX)
        else:
            delay = RECONNECT_BASE
