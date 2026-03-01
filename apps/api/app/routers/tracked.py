"""
Tracked wallets and activity feed — all endpoints require authentication.
GET    /v1/me/tracked
POST   /v1/me/tracked
PUT    /v1/me/tracked/{address}
DELETE /v1/me/tracked/{address}
GET    /v1/me/groups
POST   /v1/me/groups
GET    /v1/me/feed
GET    /v1/me/alerts
POST   /v1/me/alerts
PUT    /v1/me/alerts/{id}
DELETE /v1/me/alerts/{id}
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user_id
from app.services import supabase as supabase_svc

router = APIRouter()

# ---------------------------------------------------------------------------
# Free tier limits (enforced server-side)
# ---------------------------------------------------------------------------
FREE_WALLET_LIMIT = 50
FREE_GROUP_LIMIT = 1
FREE_ALERT_LIMIT = 5


# ---------------------------------------------------------------------------
# Tracked Wallets
# ---------------------------------------------------------------------------

class AddTrackedWalletRequest(BaseModel):
    address: str
    label: str
    group_id: str | None = None
    is_own: bool = False
    tags: list[str] = []


class UpdateTrackedWalletRequest(BaseModel):
    label: str | None = None
    group_id: str | None = None
    tags: list[str] | None = None


@router.get("/tracked")
async def list_tracked_wallets(user_id: str = Depends(get_current_user_id)):
    """Return all tracked wallets with their groups."""
    wallets = await supabase_svc.get_user_tracked_wallets(user_id)
    return {"tracked": wallets, "count": len(wallets)}


@router.post("/tracked", status_code=201)
async def add_tracked_wallet(
    body: AddTrackedWalletRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Add a wallet to the tracked list. Enforces free-tier limits."""
    tier = await supabase_svc.get_user_tier(user_id)

    if tier == "free":
        count = await supabase_svc.count_user_tracked_wallets(user_id)
        if count >= FREE_WALLET_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limit: {FREE_WALLET_LIMIT} tracked wallets. Upgrade to Pro for unlimited.",
            )

    wallet = await supabase_svc.add_tracked_wallet(
        user_id=user_id,
        address=body.address,
        label=body.label,
        group_id=body.group_id,
        is_own=body.is_own,
        tags=body.tags,
    )
    return {"wallet": wallet}


@router.put("/tracked/{address}")
async def update_tracked_wallet(
    address: str,
    body: UpdateTrackedWalletRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Update label or group for a tracked wallet."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    wallet = await supabase_svc.update_tracked_wallet(user_id, address, updates)
    if not wallet:
        raise HTTPException(status_code=404, detail="Tracked wallet not found")
    return {"wallet": wallet}


@router.delete("/tracked/{address}", status_code=204)
async def delete_tracked_wallet(
    address: str,
    user_id: str = Depends(get_current_user_id),
):
    """Remove a wallet from the tracked list."""
    deleted = await supabase_svc.delete_tracked_wallet(user_id, address)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tracked wallet not found")


# ---------------------------------------------------------------------------
# Wallet Groups
# ---------------------------------------------------------------------------

class CreateGroupRequest(BaseModel):
    name: str


@router.get("/groups")
async def list_groups(user_id: str = Depends(get_current_user_id)):
    groups = await supabase_svc.get_user_groups(user_id)
    return {"groups": groups}


@router.post("/groups", status_code=201)
async def create_group(
    body: CreateGroupRequest,
    user_id: str = Depends(get_current_user_id),
):
    tier = await supabase_svc.get_user_tier(user_id)
    if tier == "free":
        count = await supabase_svc.count_user_groups(user_id)
        if count >= FREE_GROUP_LIMIT:
            raise HTTPException(
                status_code=403,
                detail="Free tier limit: 1 wallet group. Upgrade to Pro for unlimited groups.",
            )
    group = await supabase_svc.create_group(user_id, body.name)
    return {"group": group}


# ---------------------------------------------------------------------------
# Activity Feed
# ---------------------------------------------------------------------------

@router.get("/feed")
async def activity_feed(
    user_id: str = Depends(get_current_user_id),
    limit: int = 50,
    offset: int = 0,
):
    """
    Activity feed: recent transactions from all tracked wallets.
    Ordered by block_time DESC.
    """
    wallets = await supabase_svc.get_user_tracked_wallets(user_id)
    addresses = [w["address"] for w in wallets]

    if not addresses:
        return {"feed": [], "count": 0}

    from app.services import clickhouse
    client = clickhouse.get_client()

    # Build parameterized IN clause
    placeholders = ", ".join([f"{{addr_{i}:String}}" for i in range(len(addresses))])
    params = {f"addr_{i}": a for i, a in enumerate(addresses)}
    params["limit"] = limit
    params["offset"] = offset

    result = await asyncio.to_thread(
        client.query,
        f"""
        SELECT
            t.tx_signature, t.block_time, t.from_address, t.to_address,
            t.token_mint, t.amount, t.amount_usd, t.chain
        FROM transfers t
        WHERE t.from_address IN ({placeholders}) OR t.to_address IN ({placeholders})
        ORDER BY t.block_time DESC
        LIMIT {{limit:UInt32}}
        OFFSET {{offset:UInt32}}
        """,
        parameters=params,
    )
    feed = [dict(zip(result.column_names, row)) for row in result.result_rows]

    # Tag each item with the wallet label
    label_map = {w["address"]: w["label"] for w in wallets}
    for item in feed:
        item["from_label"] = label_map.get(item["from_address"])
        item["to_label"] = label_map.get(item["to_address"])

    return {"feed": feed, "count": len(feed), "total_wallets": len(addresses)}


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class CreateAlertRequest(BaseModel):
    wallet_address: str
    alert_type: str
    conditions: dict
    delivery: list[str] = ["in_app"]
    is_active: bool = True


class UpdateAlertRequest(BaseModel):
    conditions: dict | None = None
    delivery: list[str] | None = None
    is_active: bool | None = None


@router.get("/alerts")
async def list_alerts(user_id: str = Depends(get_current_user_id)):
    alerts = await supabase_svc.get_user_alerts(user_id)
    return {"alerts": alerts}


@router.post("/alerts", status_code=201)
async def create_alert(
    body: CreateAlertRequest,
    user_id: str = Depends(get_current_user_id),
):
    tier = await supabase_svc.get_user_tier(user_id)

    if tier == "free":
        count = await supabase_svc.count_user_alerts(user_id)
        if count >= FREE_ALERT_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limit: {FREE_ALERT_LIMIT} active alerts. Upgrade to Pro for unlimited.",
            )
        # Telegram + Webhook delivery are Pro-only
        pro_only = {"telegram", "webhook"}
        if pro_only & set(body.delivery):
            raise HTTPException(
                status_code=403,
                detail="Telegram and webhook delivery require a Pro subscription.",
            )

    valid_types = {"any_tx", "sends_to", "receives_from", "token_trade", "balance_threshold", "inter_tracked"}
    if body.alert_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid alert_type. Must be one of: {valid_types}")

    alert = await supabase_svc.create_alert(user_id, body.model_dump())
    return {"alert": alert}


@router.put("/alerts/{alert_id}")
async def update_alert(
    alert_id: str,
    body: UpdateAlertRequest,
    user_id: str = Depends(get_current_user_id),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    alert = await supabase_svc.update_alert(user_id, alert_id, updates)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"alert": alert}


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
):
    deleted = await supabase_svc.delete_alert(user_id, alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
