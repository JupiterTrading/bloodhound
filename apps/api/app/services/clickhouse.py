"""
ClickHouse client — analytical queries and bulk inserts.
All transaction history lives here.
"""

import clickhouse_connect
from functools import lru_cache
from typing import Any
from app.core.config import get_settings

settings = get_settings()


@lru_cache()
def get_client():
    """
    Return a cached ClickHouse client.
    Replace host/user/password with your ClickHouse Cloud credentials.
    """
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        user=settings.clickhouse_user,
        password=settings.clickhouse_password,
        database=settings.clickhouse_db,
        secure=True,
    )


async def insert_transactions(rows: list[dict[str, Any]]) -> None:
    """Bulk insert transaction rows into ClickHouse."""
    if not rows:
        return
    client = get_client()
    client.insert(
        "transactions",
        [list(r.values()) for r in rows],
        column_names=list(rows[0].keys()),
    )


async def insert_transfers(rows: list[dict[str, Any]]) -> None:
    """Bulk insert transfer rows into ClickHouse."""
    if not rows:
        return
    client = get_client()
    client.insert(
        "transfers",
        [list(r.values()) for r in rows],
        column_names=list(rows[0].keys()),
    )


async def insert_trades(rows: list[dict[str, Any]]) -> None:
    """Bulk insert token_trades rows into ClickHouse."""
    if not rows:
        return
    client = get_client()
    client.insert(
        "token_trades",
        [list(r.values()) for r in rows],
        column_names=list(rows[0].keys()),
    )


async def get_wallet_transfers(
    address: str,
    limit: int = 50,
    offset: int = 0,
    token_mint: str | None = None,
    direction: str = "both",          # 'in' | 'out' | 'both'
    date_from: str | None = None,
    date_to: str | None = None,
    tx_type: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch paginated transfer history for a wallet from ClickHouse.
    Supports all filters from the tx history UI.
    """
    conditions = []
    params: dict[str, Any] = {"address": address, "limit": limit, "offset": offset}

    if direction == "out":
        conditions.append("from_address = {address:String}")
    elif direction == "in":
        conditions.append("to_address = {address:String}")
    else:
        conditions.append(
            "(from_address = {address:String} OR to_address = {address:String})"
        )

    if token_mint:
        conditions.append("token_mint = {token_mint:String}")
        params["token_mint"] = token_mint

    if date_from:
        conditions.append("block_time >= {date_from:DateTime}")
        params["date_from"] = date_from

    if date_to:
        conditions.append("block_time <= {date_to:DateTime}")
        params["date_to"] = date_to

    where = " AND ".join(conditions)
    query = f"""
        SELECT
            tx_signature,
            block_time,
            from_address,
            to_address,
            token_mint,
            amount,
            amount_usd,
            chain
        FROM transfers
        WHERE {where}
        ORDER BY block_time DESC
        LIMIT {{limit:UInt32}}
        OFFSET {{offset:UInt32}}
    """

    client = get_client()
    result = client.query(query, parameters=params)
    return [dict(zip(result.column_names, row)) for row in result.result_rows]


async def get_wallet_stats(address: str, days: int = 90) -> dict[str, Any]:
    """
    Aggregate stats for a wallet: tx count, volume, active days.
    Uses the materialized view for speed.
    """
    query = """
        SELECT
            sum(tx_count)    AS total_txs,
            sum(volume_usd)  AS total_volume_usd,
            count()          AS active_days,
            min(date)        AS first_active,
            max(date)        AS last_active
        FROM wallet_stats_daily
        WHERE address = {address:String}
          AND date >= today() - {days:UInt32}
    """
    client = get_client()
    result = client.query(query, parameters={"address": address, "days": days})
    row = result.result_rows[0] if result.result_rows else None
    if not row:
        return {"total_txs": 0, "total_volume_usd": 0.0, "active_days": 0}
    return dict(zip(result.column_names, row))


async def get_top_counterparties(
    address: str, limit: int = 10
) -> list[dict[str, Any]]:
    """
    Find the wallets this address interacts with most (by transfer count + volume).
    """
    query = """
        SELECT
            if(from_address = {address:String}, to_address, from_address) AS counterparty,
            count()        AS interaction_count,
            sum(amount_usd) AS total_volume_usd,
            max(block_time) AS last_interaction
        FROM transfers
        WHERE from_address = {address:String} OR to_address = {address:String}
        GROUP BY counterparty
        ORDER BY interaction_count DESC
        LIMIT {limit:UInt32}
    """
    client = get_client()
    result = client.query(query, parameters={"address": address, "limit": limit})
    return [dict(zip(result.column_names, row)) for row in result.result_rows]


async def get_sol_volume_30d(address: str) -> float:
    """SOL outflow volume for a wallet over the last 30 days."""
    query = """
        SELECT sum(amount) AS sol_volume
        FROM transfers
        WHERE from_address = {address:String}
          AND token_mint = 'SOL'
          AND block_time >= now() - INTERVAL 30 DAY
    """
    client = get_client()
    result = client.query(query, parameters={"address": address})
    if not result.result_rows:
        return 0.0
    return float(result.result_rows[0][0] or 0)


async def get_wallet_holdings(address: str) -> list[dict[str, Any]]:
    """
    Distinct tokens received by a wallet (inflow-based approximation).
    For accurate holdings use Helius DAS / Birdeye portfolio endpoint.
    """
    query = """
        SELECT
            token_mint,
            sum(if(to_address = {address:String}, amount, -amount)) AS net_amount,
            count() AS transfer_count
        FROM transfers
        WHERE (from_address = {address:String} OR to_address = {address:String})
          AND token_mint != 'SOL'
        GROUP BY token_mint
        HAVING net_amount > 0
        ORDER BY net_amount DESC
        LIMIT 100
    """
    client = get_client()
    result = client.query(query, parameters={"address": address})
    return [dict(zip(result.column_names, row)) for row in result.result_rows]


async def search_wallets_by_prefix(prefix: str, limit: int = 10) -> list[str]:
    """Find wallet addresses that start with a given prefix (for autocomplete)."""
    query = """
        SELECT DISTINCT from_address AS address
        FROM transfers
        WHERE from_address LIKE {prefix:String}
        LIMIT {limit:UInt32}
    """
    client = get_client()
    result = client.query(
        query, parameters={"prefix": f"{prefix}%", "limit": limit}
    )
    return [row[0] for row in result.result_rows]


async def get_recent_signals(
    signal_types: list[str] | None = None,
    confidence: str | None = None,
    wallet_address: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Paginated signals feed from ClickHouse."""
    conditions: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if signal_types:
        # ClickHouse IN clause with parameterized array
        placeholders = ", ".join(
            [f"{{sig_{i}:String}}" for i in range(len(signal_types))]
        )
        conditions.append(f"signal_type IN ({placeholders})")
        for i, st in enumerate(signal_types):
            params[f"sig_{i}"] = st

    if confidence:
        conditions.append("confidence = {confidence:String}")
        params["confidence"] = confidence

    if wallet_address:
        conditions.append("wallet_address = {wallet_address:String}")
        params["wallet_address"] = wallet_address

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
        SELECT
            id, detected_at, signal_type, confidence, scope,
            wallet_address, token_mint, tx_signature, description, metadata
        FROM signals
        {where}
        ORDER BY detected_at DESC
        LIMIT {{limit:UInt32}}
        OFFSET {{offset:UInt32}}
    """
    client = get_client()
    result = client.query(query, parameters=params)
    return [dict(zip(result.column_names, row)) for row in result.result_rows]


async def check_transfers_between(
    from_addr: str,
    to_addr: str,
    min_amount_sol: float = 0.1,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """
    Core query for Bloodhound AI relationship check.
    "Does wallet A send to wallet B?"
    Returns total, count, last tx, and evidence list.
    """
    conditions = [
        "from_address = {from_addr:String}",
        "to_address = {to_addr:String}",
        "token_mint = 'SOL'",
        "amount >= {min_amount:Float64}",
    ]
    params: dict[str, Any] = {
        "from_addr": from_addr,
        "to_addr": to_addr,
        "min_amount": min_amount_sol,
    }

    if date_from:
        conditions.append("block_time >= {date_from:DateTime}")
        params["date_from"] = date_from
    if date_to:
        conditions.append("block_time <= {date_to:DateTime}")
        params["date_to"] = date_to

    where = " AND ".join(conditions)

    summary_q = f"""
        SELECT
            count()       AS tx_count,
            sum(amount)   AS total_sol,
            max(block_time) AS last_tx
        FROM transfers WHERE {where}
    """
    evidence_q = f"""
        SELECT tx_signature, block_time, amount, amount_usd
        FROM transfers WHERE {where}
        ORDER BY block_time DESC LIMIT 10
    """

    client = get_client()
    summary = client.query(summary_q, parameters=params)
    evidence = client.query(evidence_q, parameters=params)

    s = summary.result_rows[0] if summary.result_rows else (0, 0.0, None)
    return {
        "found": s[0] > 0,
        "tx_count": s[0],
        "total_sol": round(s[1], 4),
        "last_tx": str(s[2]) if s[2] else None,
        "evidence": [
            dict(zip(evidence.column_names, row))
            for row in evidence.result_rows
        ],
    }
