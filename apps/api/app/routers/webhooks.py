"""
Helius webhook endpoint.
Receives real-time parsed transaction payloads and writes to ClickHouse.
"""

import hmac
import hashlib
import json
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from app.core.config import get_settings
from app.services.ingestion import parse_helius_transaction

router = APIRouter()
settings = get_settings()


def verify_helius_signature(payload: bytes, signature: str) -> bool:
    """Verify the webhook came from Helius using HMAC-SHA256."""
    if not settings.helius_webhook_secret:
        return True  # Skip verification in dev if secret not set
    expected = hmac.new(
        settings.helius_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def process_webhook_payload(transactions: list[dict]) -> None:
    """
    Background task: parse transactions, write to ClickHouse, evaluate alert rules.
    """
    from app.services import clickhouse
    from app.services.supabase import get_active_alerts_for_wallet

    tx_rows: list[dict] = []
    transfer_rows: list[dict] = []
    trade_rows: list[dict] = []
    all_signers: set[str] = set()

    for tx in transactions:
        try:
            parsed = parse_helius_transaction(tx)
            tx_rows.append(parsed["transaction"])
            transfer_rows.extend(parsed["transfers"])
            trade_rows.extend(parsed["trades"])
            all_signers.update(parsed["transaction"].get("signers", []))
        except Exception as e:
            print(f"[webhook] parse error: {e}")

    # Bulk write to ClickHouse
    try:
        await clickhouse.insert_transactions(tx_rows)
        await clickhouse.insert_transfers(transfer_rows)
        await clickhouse.insert_trades(trade_rows)
    except Exception as e:
        print(f"[webhook] ClickHouse write error: {e}")

    # Evaluate alert rules for all signers involved
    for signer in all_signers:
        try:
            alerts = await get_active_alerts_for_wallet(signer)
            if alerts:
                await _trigger_alerts(signer, alerts, tx_rows, transfer_rows)
        except Exception as e:
            print(f"[webhook] alert eval error for {signer[:8]}...: {e}")


async def _trigger_alerts(
    wallet: str,
    alerts: list[dict],
    transactions: list[dict],
    transfers: list[dict],
) -> None:
    """
    Evaluate alert conditions and publish notifications via Ably.
    TODO: Connect to Ably and implement per-condition matching.
    """
    for alert in alerts:
        alert_type = alert.get("alert_type", "")
        if alert_type == "any_tx":
            # Always fires for any transaction involving this wallet
            print(f"[alert] any_tx triggered for {wallet[:8]}... user={alert['user_id'][:8]}...")


@router.post("/helius")
async def helius_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receive Helius webhook payload.
    Verify signature, then process transactions in background.
    """
    body = await request.body()
    signature = request.headers.get("helius-signature", "")

    if not verify_helius_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Helius sends an array of transactions
    transactions = payload if isinstance(payload, list) else [payload]

    background_tasks.add_task(process_webhook_payload, transactions)

    return {"status": "accepted", "count": len(transactions)}
