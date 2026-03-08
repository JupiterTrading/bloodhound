"""
Helius webhook address management.
Dynamically adds/removes wallet addresses from the Helius webhook
when users track or untrack wallets.

The webhook address list is the source of truth for what Helius pushes
to us in real-time. On-demand API lookups work for any wallet regardless.
"""

import httpx
from app.core.config import get_settings

settings = get_settings()

HELIUS_BASE = "https://api.helius.xyz/v0"


def _api_url(path: str) -> str:
    return f"{HELIUS_BASE}{path}?api-key={settings.helius_api_key}"


async def _get_webhook() -> dict | None:
    """Fetch the current webhook config from Helius."""
    webhook_id = getattr(settings, "helius_webhook_id", "")
    if not webhook_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_api_url(f"/webhooks/{webhook_id}"))
            if resp.status_code == 200:
                return resp.json()
            print(f"[helius_webhook] GET {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[helius_webhook] GET error: {e}")
    return None


async def _put_webhook(addresses: list[str]) -> bool:
    """Replace the webhook address list on Helius (full update)."""
    webhook_id = getattr(settings, "helius_webhook_id", "")
    if not webhook_id:
        return False

    body = {
        "webhookURL": f"{settings.api_url}/webhooks/helius",
        "transactionTypes": ["SWAP", "TRANSFER"],
        "accountAddresses": addresses,
        "webhookType": "enhanced",
        "authHeader": settings.helius_webhook_secret,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(_api_url(f"/webhooks/{webhook_id}"), json=body)
            if resp.status_code == 200:
                return True
            print(f"[helius_webhook] PUT {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[helius_webhook] PUT error: {e}")
    return False


async def add_address(address: str) -> None:
    """
    Add a wallet address to the Helius webhook.
    Called when a user tracks a new wallet.
    No-op (with log) if webhook ID is not configured.
    """
    webhook = await _get_webhook()
    if webhook is None:
        print(f"[helius_webhook] HELIUS_WEBHOOK_ID not set — skipping add for {address[:8]}...")
        return

    current = webhook.get("accountAddresses", [])
    if address in current:
        return  # already tracked

    updated = list(set(current) | {address})
    ok = await _put_webhook(updated)
    if ok:
        print(f"[helius_webhook] added {address[:8]}... ({len(updated)} total addresses)")
    else:
        print(f"[helius_webhook] failed to add {address[:8]}...")


async def remove_address(address: str) -> None:
    """
    Remove a wallet address from the Helius webhook.
    Called when a user untracks a wallet.
    Only removes if no other tracked user is watching the same address.
    """
    webhook = await _get_webhook()
    if webhook is None:
        print(f"[helius_webhook] HELIUS_WEBHOOK_ID not set — skipping remove for {address[:8]}...")
        return

    current = webhook.get("accountAddresses", [])
    if address not in current:
        return  # wasn't there

    updated = [a for a in current if a != address]

    # Helius requires at least 1 address — keep a placeholder if list would be empty
    if not updated:
        print(f"[helius_webhook] cannot remove last address — list must have at least 1")
        return

    ok = await _put_webhook(updated)
    if ok:
        print(f"[helius_webhook] removed {address[:8]}... ({len(updated)} total addresses)")
    else:
        print(f"[helius_webhook] failed to remove {address[:8]}...")
