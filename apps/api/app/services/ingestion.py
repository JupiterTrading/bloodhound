"""
Transaction ingestion pipeline.
Helius webhook payload → parsed records → ClickHouse write.
"""

from datetime import datetime
from typing import Any
from app.services.helius import detect_source_platform


def parse_helius_transaction(tx: dict[str, Any]) -> dict[str, Any]:
    """
    Parse a Helius Enhanced Transaction into our internal format.
    Extracts: transfers, token trades, source platform, tx metadata.
    """
    signature = tx.get("signature", "")
    block_time = tx.get("timestamp", 0)
    slot = tx.get("slot", 0)
    fee = tx.get("fee", 0)
    tx_type = tx.get("type", "UNKNOWN")
    status = "success" if not tx.get("transactionError") else "failed"
    source_platform = detect_source_platform(tx)

    signers = []
    if account_data := tx.get("accountData", []):
        # First account is typically the fee payer / initiator
        for acc in account_data[:5]:
            if acc.get("account"):
                signers.append(acc["account"])

    transfers = _extract_transfers(tx, signature, block_time)
    trades = _extract_trades(tx, signature, block_time)

    return {
        "transaction": {
            "signature": signature,
            "block_time": datetime.utcfromtimestamp(block_time).isoformat(),
            "slot": slot,
            "chain": "solana",
            "signers": signers,
            "fee": fee,
            "tx_type": tx_type,
            "source_platform": source_platform,
            "source_program": tx.get("source", ""),
            "status": status,
            "raw_events": str(tx),
        },
        "transfers": transfers,
        "trades": trades,
    }


def _extract_transfers(
    tx: dict[str, Any],
    signature: str,
    block_time: int,
) -> list[dict[str, Any]]:
    """Extract SOL and token transfers from a Helius parsed transaction."""
    transfers = []
    dt = datetime.utcfromtimestamp(block_time).isoformat()

    # Native SOL transfers
    for transfer in tx.get("nativeTransfers", []):
        amount_lamports = transfer.get("amount", 0)
        if amount_lamports == 0:
            continue
        transfers.append({
            "tx_signature": signature,
            "block_time": dt,
            "from_address": transfer.get("fromUserAccount", ""),
            "to_address": transfer.get("toUserAccount", ""),
            "token_mint": "SOL",
            "amount": amount_lamports / 1_000_000_000,  # lamports → SOL
            "amount_usd": 0.0,  # enriched later via Birdeye
            "chain": "solana",
        })

    # SPL token transfers
    for transfer in tx.get("tokenTransfers", []):
        amount = transfer.get("tokenAmount", 0)
        if amount == 0:
            continue
        transfers.append({
            "tx_signature": signature,
            "block_time": dt,
            "from_address": transfer.get("fromUserAccount", ""),
            "to_address": transfer.get("toUserAccount", ""),
            "token_mint": transfer.get("mint", ""),
            "amount": float(amount),
            "amount_usd": 0.0,
            "chain": "solana",
        })

    return transfers


def _extract_trades(
    tx: dict[str, Any],
    signature: str,
    block_time: int,
) -> list[dict[str, Any]]:
    """Extract DEX swap events from a Helius parsed transaction."""
    trades = []
    dt = datetime.utcfromtimestamp(block_time).isoformat()

    tx_type = tx.get("type", "")
    if tx_type != "SWAP":
        return trades

    # Helius swap event structure
    for event in tx.get("events", {}).get("swap", []):
        trader = tx.get("feePayer", "")
        dex = tx.get("source", "unknown").lower()

        token_in = event.get("tokenInputs", [{}])[0] if event.get("tokenInputs") else {}
        token_out = event.get("tokenOutputs", [{}])[0] if event.get("tokenOutputs") else {}

        trades.append({
            "tx_signature": signature,
            "block_time": dt,
            "trader": trader,
            "dex": dex,
            "token_in_mint": token_in.get("mint", "SOL"),
            "token_out_mint": token_out.get("mint", "SOL"),
            "amount_in": float(token_in.get("tokenAmount", 0)),
            "amount_out": float(token_out.get("tokenAmount", 0)),
            "amount_usd": 0.0,
            "realized_pnl_usd": 0.0,
            "chain": "solana",
        })

    return trades
