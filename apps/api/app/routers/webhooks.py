"""
Helius webhook endpoint.
Receives real-time parsed transaction payloads and writes to ClickHouse.
"""

import asyncio
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
    Background task: parse transactions, enrich with USD prices, write to ClickHouse,
    then evaluate alert rules.
    """
    from app.services import analytics
    from app.services.supabase import get_active_alerts_for_wallet
    from app.services.jupiter import get_prices_batch
    from app.services.ingestion import enrich_with_prices

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

    # Collect unique mints across all transfers and trades, then batch-fetch prices
    unique_mints = list({
        *(t["token_mint"] for t in transfer_rows if t.get("token_mint")),
        *(t["token_out_mint"] for t in trade_rows if t.get("token_out_mint")),
        *(t["token_in_mint"] for t in trade_rows if t.get("token_in_mint")),
    })
    try:
        prices = await get_prices_batch(unique_mints)
        enrich_with_prices(transfer_rows, trade_rows, prices)
        print(f"[webhook] enriched {len(unique_mints)} mints, {len(prices)} prices resolved")
    except Exception as e:
        print(f"[webhook] price enrichment error (continuing with 0.0): {e}")

    # Write to Supabase
    try:
        await analytics.insert_transactions(tx_rows)
        await analytics.insert_transfers(transfer_rows)
        await analytics.insert_trades(trade_rows)
    except Exception as e:
        print(f"[webhook] data write error: {e}")

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
    Evaluate alert conditions and publish notifications via Ably REST API.
    Publishes to channel alerts:{user_id} when conditions are met.
    """
    import httpx

    ably_key = settings.ably_api_key if hasattr(settings, "ably_api_key") else None

    for alert in alerts:
        alert_type = alert.get("alert_type", "")
        user_id = alert.get("user_id", "")
        triggered = False
        trigger_data: dict = {
            "alert_id": alert.get("id"),
            "alert_type": alert_type,
            "wallet": wallet,
        }

        if alert_type == "any_tx" and transactions:
            triggered = True
            trigger_data["tx_count"] = len(transactions)

        elif alert_type == "sends_to":
            target = alert.get("conditions", {}).get("to_address", "")
            matching = [t for t in transfers if t.get("to_address") == target]
            if matching:
                triggered = True
                trigger_data["tx_count"] = len(matching)

        elif alert_type == "receives_from":
            source = alert.get("conditions", {}).get("from_address", "")
            matching = [t for t in transfers if t.get("from_address") == source]
            if matching:
                triggered = True
                trigger_data["tx_count"] = len(matching)

        elif alert_type == "balance_threshold":
            threshold = float(alert.get("conditions", {}).get("min_usd", 0))
            large = [t for t in transfers if float(t.get("amount_usd") or 0) >= threshold]
            if large:
                triggered = True
                trigger_data["tx_count"] = len(large)

        if not triggered or not user_id:
            continue

        print(f"[alert] {alert_type} triggered for {wallet[:8]}... user={user_id[:8]}...")

        if ably_key:
            try:
                # Ably REST publish — basic auth with API key
                key_name, key_secret = ably_key.split(":", 1)
                channel_name = f"alerts:{user_id}"
                url = f"https://rest.ably.io/channels/{channel_name}/messages"
                async with httpx.AsyncClient(timeout=5) as http:
                    await http.post(
                        url,
                        auth=(key_name, key_secret),
                        json={"name": "alert", "data": trigger_data},
                    )
            except Exception as e:
                print(f"[alert] Ably publish error: {e}")


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
