"""
BLOODHOUND — Analytics Service (replaces ClickHouse)

All analytical queries now run against Supabase PostgreSQL + Helius API.
Wallet trades stored in Supabase `wallet_trades` table.
Signals stored in Supabase `wallet_signals` table.
Transfer history fetched on-demand from Helius.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.supabase import get_client as get_supabase
from app.services.redis_cache import cache_get, cache_set


# ── Wallet Stats ──────────────────────────────────────────────────────────────

async def get_wallet_stats(address: str, days: int = 90) -> dict[str, Any]:
    """
    Aggregate stats for a wallet from Supabase wallet_trades.
    Falls back to Helius transaction count if no trades recorded.
    """
    supabase = get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        result = supabase.table("wallet_trades").select(
            "id, block_time, amount_sol, pnl_sol"
        ).eq("wallet_address", address).gte("block_time", since).execute()

        rows = result.data or []
        if rows:
            total_txs = len(rows)
            total_volume = sum(abs(float(r.get("amount_sol", 0) or 0)) for r in rows)
            dates = set()
            first_active = None
            last_active = None
            for r in rows:
                bt = r.get("block_time")
                if bt:
                    dates.add(str(bt)[:10])
                    if not first_active or bt < first_active:
                        first_active = bt
                    if not last_active or bt > last_active:
                        last_active = bt

            return {
                "total_txs": total_txs,
                "total_volume_usd": round(total_volume * 150, 2),  # rough SOL→USD
                "active_days": len(dates),
                "first_active": first_active,
                "last_active": last_active,
            }
    except Exception:
        pass

    # Fallback: use Helius to get basic tx count
    try:
        from app.services.helius import get_wallet_transactions
        txs = await get_wallet_transactions(address, limit=10)
        return {
            "total_txs": len(txs),
            "total_volume_usd": 0,
            "active_days": 0,
            "first_active": txs[-1].get("timestamp") if txs else None,
            "last_active": txs[0].get("timestamp") if txs else None,
        }
    except Exception:
        return {"total_txs": 0, "total_volume_usd": 0, "active_days": 0,
                "first_active": None, "last_active": None}


# ── Wallet Transfers ──────────────────────────────────────────────────────────

async def get_wallet_transfers(
    address: str,
    limit: int = 50,
    offset: int = 0,
    token_mint: str | None = None,
    direction: str = "both",
    date_from: str | None = None,
    date_to: str | None = None,
    tx_type: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch transfer history from Helius (enriched transactions).
    Parses native + token transfers into a flat list.
    """
    from app.services.helius import get_wallet_transactions

    try:
        txs = await get_wallet_transactions(address, limit=min(limit + offset, 100))
    except Exception:
        return []

    transfers = []
    for tx in txs:
        sig = tx.get("signature", "")
        timestamp = tx.get("timestamp")

        # Native SOL transfers
        for nt in tx.get("nativeTransfers", []):
            from_addr = nt.get("fromUserAccount", "")
            to_addr = nt.get("toUserAccount", "")
            amount = (nt.get("amount", 0) or 0) / 1_000_000_000

            if direction == "out" and from_addr != address:
                continue
            if direction == "in" and to_addr != address:
                continue
            if token_mint and token_mint != "SOL":
                continue

            transfers.append({
                "tx_signature": sig,
                "block_time": timestamp,
                "from_address": from_addr,
                "to_address": to_addr,
                "token_mint": "So11111111111111111111111111111111111111112",
                "token_symbol": "SOL",
                "amount": amount,
                "amount_usd": None,
                "tx_type": tx.get("type", "UNKNOWN"),
            })

        # SPL token transfers
        for tt in tx.get("tokenTransfers", []):
            from_addr = tt.get("fromUserAccount", "")
            to_addr = tt.get("toUserAccount", "")
            amount = tt.get("tokenAmount", 0) or 0
            mint = tt.get("mint", "")

            if direction == "out" and from_addr != address:
                continue
            if direction == "in" and to_addr != address:
                continue
            if token_mint and token_mint != mint:
                continue

            transfers.append({
                "tx_signature": sig,
                "block_time": timestamp,
                "from_address": from_addr,
                "to_address": to_addr,
                "token_mint": mint,
                "token_symbol": tt.get("tokenStandard"),
                "amount": amount,
                "amount_usd": None,
                "tx_type": tx.get("type", "UNKNOWN"),
            })

    return transfers[offset:offset + limit]


# ── Counterparties ────────────────────────────────────────────────────────────

async def get_top_counterparties(
    address: str, limit: int = 10
) -> list[dict[str, Any]]:
    """
    Find wallets this address interacts with most, via Helius recent transactions.
    """
    from collections import defaultdict
    from app.services.helius import get_wallet_transactions

    try:
        txs = await get_wallet_transactions(address, limit=100)
    except Exception:
        return []

    counts: dict[str, int] = defaultdict(int)

    for tx in txs:
        for nt in tx.get("nativeTransfers", []):
            from_addr = nt.get("fromUserAccount", "")
            to_addr = nt.get("toUserAccount", "")
            if from_addr == address and to_addr and to_addr != address:
                counts[to_addr] += 1
            elif to_addr == address and from_addr and from_addr != address:
                counts[from_addr] += 1

        for tt in tx.get("tokenTransfers", []):
            from_addr = tt.get("fromUserAccount", "")
            to_addr = tt.get("toUserAccount", "")
            if from_addr == address and to_addr and to_addr != address:
                counts[to_addr] += 1
            elif to_addr == address and from_addr and from_addr != address:
                counts[from_addr] += 1

    sorted_cp = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [
        {
            "counterparty": addr,
            "interaction_count": count,
            "total_volume_usd": 0,
            "last_interaction": None,
        }
        for addr, count in sorted_cp
    ]


# ── SOL Volume ────────────────────────────────────────────────────────────────

async def get_sol_volume_30d(address: str) -> float:
    """SOL outflow volume over last 30 days via Helius transactions."""
    from app.services.helius import get_wallet_transactions

    try:
        txs = await get_wallet_transactions(address, limit=100)
    except Exception:
        return 0.0

    total = 0.0
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    for tx in txs:
        ts = tx.get("timestamp", 0)
        if ts and datetime.fromtimestamp(ts, tz=timezone.utc) < cutoff:
            continue
        for nt in tx.get("nativeTransfers", []):
            if nt.get("fromUserAccount") == address:
                total += (nt.get("amount", 0) or 0) / 1_000_000_000

    return total


# ── Signals ───────────────────────────────────────────────────────────────────

async def insert_signals(rows: list[dict[str, Any]]) -> None:
    """Insert signal rows into Supabase wallet_signals table."""
    if not rows:
        return
    supabase = get_supabase()
    for row in rows:
        try:
            supabase.table("wallet_signals").insert({
                "wallet_address": row.get("wallet_address", ""),
                "signal_type": row.get("signal_type", ""),
                "signal_strength": float(row.get("confidence", "0.5") if isinstance(row.get("confidence"), str) else row.get("confidence", 0.5)),
                "details": {
                    "description": row.get("description", ""),
                    "tx_signature": row.get("tx_signature", ""),
                    "token_mint": row.get("token_mint", ""),
                    "metadata": row.get("metadata", "{}"),
                },
            }).execute()
        except Exception:
            pass


async def get_recent_signals(
    signal_types: list[str] | None = None,
    confidence: str | None = None,
    wallet_address: str | None = None,
    wallet_addresses: list[str] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Paginated signals from Supabase wallet_signals."""
    supabase = get_supabase()
    query = supabase.table("wallet_signals").select("*").order("detected_at", desc=True)

    if signal_types:
        query = query.in_("signal_type", signal_types)
    if wallet_addresses:
        query = query.in_("wallet_address", wallet_addresses)
    elif wallet_address:
        query = query.eq("wallet_address", wallet_address)

    result = query.range(offset, offset + limit - 1).execute()
    return result.data or []


async def get_recent_signals_for_wallets(
    addresses: list[str],
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Recent signals for a set of wallet addresses."""
    if not addresses:
        return []
    return await get_recent_signals(wallet_addresses=addresses, limit=limit)


# ── Trades ────────────────────────────────────────────────────────────────────

async def insert_trades(rows: list[dict[str, Any]]) -> None:
    """Insert wallet trade rows into Supabase wallet_trades."""
    if not rows:
        return
    supabase = get_supabase()
    for row in rows:
        try:
            supabase.table("wallet_trades").upsert({
                "wallet_address": row.get("trader", row.get("wallet_address", "")),
                "token_address": row.get("token_out_mint", row.get("token_address", "")),
                "token_symbol": row.get("token_symbol"),
                "trade_type": "buy" if row.get("token_in_mint", "").endswith("11112") else "sell",
                "amount_tokens": float(row.get("amount_out", 0)),
                "amount_sol": float(row.get("amount_in", 0)),
                "amount_usd": float(row.get("amount_usd", 0)),
                "tx_signature": row.get("tx_signature", ""),
                "block_time": row.get("block_time", datetime.now(timezone.utc).isoformat()),
            }, on_conflict="tx_signature").execute()
        except Exception:
            pass


async def insert_transfers(rows: list[dict[str, Any]]) -> None:
    """Store transfers in Supabase (lightweight — just for signal detection context)."""
    # Transfers are fetched on-demand from Helius, not stored permanently.
    # This is a no-op to maintain API compatibility during migration.
    pass


async def insert_transactions(rows: list[dict[str, Any]]) -> None:
    """Transaction metadata — no longer stored (fetched on-demand from Helius)."""
    pass


# ── Leaderboard PnL ──────────────────────────────────────────────────────────

async def get_leaderboard_pnl(
    addresses: list[str],
    timeframe: str = "1d",
) -> dict[str, dict]:
    """
    PnL data for leaderboard from wallet_rankings table.
    Falls back to empty if no data.
    """
    if not addresses:
        return {}

    supabase = get_supabase()
    pnl_field = {
        "1d": "pnl_1d_usd",
        "7d": "pnl_7d_usd",
        "30d": "pnl_30d_usd",
    }.get(timeframe, "pnl_7d_usd")

    try:
        result = supabase.table("wallet_rankings").select(
            f"address, {pnl_field}, win_rate, total_trades"
        ).in_("address", addresses[:100]).execute()

        out = {}
        for row in (result.data or []):
            out[row["address"]] = {
                "realized_pnl_usd": float(row.get(pnl_field, 0) or 0),
                "trade_count": int(row.get("total_trades", 0) or 0),
                "win_rate": float(row.get("win_rate", 0) or 0) / 100,
                "best_token": None,
            }
        return out
    except Exception:
        return {}


# ── KOL Overlap (for new pairs) ──────────────────────────────────────────────

async def get_kol_overlap_batch(
    mints: list[str],
    kol_addresses: list[str],
) -> dict[str, dict]:
    """Check how many KOLs have traded each token. Uses Supabase wallet_trades."""
    if not mints or not kol_addresses:
        return {}

    supabase = get_supabase()
    out: dict[str, dict] = {}

    try:
        result = supabase.table("wallet_trades").select(
            "token_address, wallet_address"
        ).in_("token_address", mints[:50]).in_(
            "wallet_address", kol_addresses[:100]
        ).execute()

        from collections import defaultdict
        by_mint: dict[str, set] = defaultdict(set)
        for row in (result.data or []):
            by_mint[row["token_address"]].add(row["wallet_address"])

        for mint, traders in by_mint.items():
            out[mint] = {"kol_count": len(traders), "kol_traders": list(traders)}
    except Exception:
        pass

    return out


# ── Transfer Check (for AI pipeline) ─────────────────────────────────────────

async def check_transfers_between(
    from_addr: str,
    to_addr: str,
    min_amount_sol: float = 0.1,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """
    Check if wallet A has sent to wallet B using Helius transaction history.
    """
    from app.services.helius import get_wallet_transactions

    try:
        txs = await get_wallet_transactions(from_addr, limit=100)
    except Exception:
        return {"found": False, "tx_count": 0, "total_sol": 0, "last_tx": None, "evidence": []}

    evidence = []
    total_sol = 0.0

    for tx in txs:
        sig = tx.get("signature", "")
        ts = tx.get("timestamp", 0)

        for nt in tx.get("nativeTransfers", []):
            if (nt.get("fromUserAccount") == from_addr and
                nt.get("toUserAccount") == to_addr):
                amount = (nt.get("amount", 0) or 0) / 1_000_000_000
                if amount >= min_amount_sol:
                    total_sol += amount
                    evidence.append({
                        "tx_signature": sig,
                        "block_time": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else "",
                        "amount": round(amount, 4),
                        "amount_usd": 0,
                    })

    return {
        "found": len(evidence) > 0,
        "tx_count": len(evidence),
        "total_sol": round(total_sol, 4),
        "last_tx": evidence[0]["block_time"] if evidence else None,
        "evidence": evidence[:10],
    }


# ── Classification helpers (replace ClickHouse queries) ───────────────────────

async def get_trade_stats_for_classification(address: str) -> dict[str, Any]:
    """Get trade stats from Supabase wallet_trades for classification engine."""
    supabase = get_supabase()
    try:
        result = supabase.table("wallet_trades").select(
            "id, pnl_sol, trade_type"
        ).eq("wallet_address", address).execute()

        rows = result.data or []
        if not rows:
            # Check wallet_rankings as fallback
            wr = supabase.table("wallet_rankings").select(
                "total_trades, winning_trades, total_pnl_usd, win_rate"
            ).eq("address", address).single().execute()
            if wr.data:
                return {
                    "total_trades": int(wr.data.get("total_trades", 0) or 0),
                    "winning_trades": int(wr.data.get("winning_trades", 0) or 0),
                    "total_pnl_usd": float(wr.data.get("total_pnl_usd", 0) or 0),
                }
            return {"total_trades": 0, "winning_trades": 0, "total_pnl_usd": 0}

        total = len(rows)
        winning = sum(1 for r in rows if float(r.get("pnl_sol", 0) or 0) > 0)
        total_pnl = sum(float(r.get("pnl_sol", 0) or 0) for r in rows)

        return {
            "total_trades": total,
            "winning_trades": winning,
            "total_pnl_usd": round(total_pnl * 150, 2),  # rough SOL→USD
        }
    except Exception:
        return {"total_trades": 0, "winning_trades": 0, "total_pnl_usd": 0}


async def get_tx_type_counts(address: str) -> dict[str, int]:
    """
    Get transaction type counts for classification (deployer, LP, bundler checks).
    Uses Helius enriched transactions.
    """
    from app.services.helius import get_wallet_transactions

    try:
        txs = await get_wallet_transactions(address, limit=100)
    except Exception:
        return {}

    counts: dict[str, int] = {}
    for tx in txs:
        tx_type = tx.get("type", "UNKNOWN")
        counts[tx_type] = counts.get(tx_type, 0) + 1

        # Check source for jito/bundler
        source = tx.get("source", "").lower()
        if "jito" in source:
            counts["jito_bundle"] = counts.get("jito_bundle", 0) + 1

    return counts


async def get_tx_frequency_24h(address: str) -> int:
    """Get approximate transaction count in last 24h from Helius."""
    from app.services.helius import get_wallet_transactions

    try:
        txs = await get_wallet_transactions(address, limit=100)
    except Exception:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    count = 0
    for tx in txs:
        ts = tx.get("timestamp", 0)
        if ts and datetime.fromtimestamp(ts, tz=timezone.utc) >= cutoff:
            count += 1

    return count
