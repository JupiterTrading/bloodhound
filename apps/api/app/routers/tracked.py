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
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user_id
from app.services import supabase as supabase_svc
from app.services.redis_cache import cache_get, cache_set

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
    # Ensure user row exists before any FK-dependent insert
    await supabase_svc.get_or_create_user(user_id)
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
    # Kick off a one-time historical backfill in the background (US-B405).
    # Pulls up to 1000 txs from Helius and writes to ClickHouse so the
    # activity feed is populated immediately rather than waiting for the next poll sweep.
    from app.services.wallet_poller import backfill_wallet
    asyncio.create_task(backfill_wallet(body.address))

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
    # wallet_poller will stop seeing this address on its next Supabase fetch


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

    # Fetch recent transactions from Helius for tracked wallets
    from app.services import analytics
    feed = []
    for addr in addresses[:10]:  # Cap to avoid too many API calls
        try:
            transfers = await analytics.get_wallet_transfers(addr, limit=5)
            feed.extend(transfers)
        except Exception:
            pass

    # Sort by block_time descending
    feed.sort(key=lambda x: x.get("block_time") or 0, reverse=True)
    feed = feed[offset:offset + limit]

    # Tag each item with the wallet label
    label_map = {w["address"]: w["label"] for w in wallets}
    for item in feed:
        item["from_label"] = label_map.get(item.get("from_address"))
        item["to_label"] = label_map.get(item.get("to_address"))

    return {"feed": feed, "count": len(feed), "total_wallets": len(addresses)}


# ---------------------------------------------------------------------------
# Portfolio (own wallets aggregation)
# ---------------------------------------------------------------------------

@router.get("/portfolio")
async def get_portfolio(user_id: str = Depends(get_current_user_id)):
    """
    Aggregate portfolio for wallets marked is_own=True.
    - Combined holdings from Birdeye (merged by mint, summed USD)
    - KOL overlap per token (how many KOLs traded it in the last 30 days)
    - Total portfolio USD value
    Cached 5 min per user.
    """
    cache_key = f"portfolio:{user_id}"
    if cached := await cache_get(cache_key):
        return cached

    own_wallets = await supabase_svc.get_own_wallets(user_id)
    if not own_wallets:
        return {"wallets": [], "holdings": [], "total_usd": 0.0, "kol_overlap": {}}

    from app.services import birdeye, analytics

    # Fetch Birdeye portfolio for each own wallet in parallel
    portfolio_results = await asyncio.gather(
        *[_safe(birdeye.get_wallet_portfolio(w["address"]), default={}) for w in own_wallets]
    )

    # Merge holdings by mint
    merged: dict[str, dict[str, Any]] = {}
    for portfolio in portfolio_results:
        for token in (portfolio or {}).get("holdings", []):
            mint = token.get("mint", "")
            if not mint:
                continue
            if mint in merged:
                merged[mint]["usd_value"] = (merged[mint].get("usd_value") or 0) + (token.get("usd_value") or 0)
                merged[mint]["amount"] = (merged[mint].get("amount") or 0) + (token.get("amount") or 0)
            else:
                merged[mint] = dict(token)

    combined = sorted(merged.values(), key=lambda t: t.get("usd_value") or 0, reverse=True)
    total_usd = round(sum(h.get("usd_value") or 0 for h in combined), 2)
    mints = [h["mint"] for h in combined if h.get("mint")]

    # KOL overlap: how many known KOLs have traded each mint in the last 30 days
    kol_addresses = await supabase_svc.get_kol_addresses()
    kol_overlap = await analytics.get_kol_overlap_batch(mints[:50], kol_addresses)

    # Enrich each holding with KOL overlap data
    for h in combined:
        overlap = kol_overlap.get(h.get("mint", ""), {})
        h["kol_count"] = overlap.get("kol_count", 0)
        h["kol_traders"] = overlap.get("kol_traders", [])

    result: dict[str, Any] = {
        "wallets": [{"address": w["address"], "label": w["label"]} for w in own_wallets],
        "holdings": combined[:50],
        "total_usd": total_usd,
        "kol_overlap": kol_overlap,
    }
    await cache_set(cache_key, result, 300)
    return result


@router.post("/portfolio/report")
async def generate_portfolio_report(user_id: str = Depends(get_current_user_id)):
    """
    AI-generated narrative report for the user's portfolio.
    Considers holdings, KOL overlap, and recent signals from own wallets.
    Returns a markdown-formatted briefing. No cache — always fresh.
    """
    own_wallets = await supabase_svc.get_own_wallets(user_id)
    if not own_wallets:
        return {"report": "No own wallets found. Mark wallets as 'own' in your Tracked dashboard to generate a portfolio report.", "confidence": "UNKNOWN"}

    from app.services import birdeye, analytics
    from app.core.config import get_settings
    import anthropic

    settings = get_settings()
    addresses = [w["address"] for w in own_wallets]

    # Fetch portfolio + recent signals in parallel
    portfolio_raw, signals = await asyncio.gather(
        asyncio.gather(*[_safe(birdeye.get_wallet_portfolio(a), default={}) for a in addresses]),
        analytics.get_recent_signals_for_wallets(addresses, limit=20),
    )

    # Merge holdings
    merged: dict[str, dict[str, Any]] = {}
    for portfolio in portfolio_raw:
        for token in (portfolio or {}).get("holdings", []):
            mint = token.get("mint", "")
            if not mint:
                continue
            if mint in merged:
                merged[mint]["usd_value"] = (merged[mint].get("usd_value") or 0) + (token.get("usd_value") or 0)
            else:
                merged[mint] = dict(token)

    top_holdings = sorted(merged.values(), key=lambda t: t.get("usd_value") or 0, reverse=True)[:20]
    total_usd = sum(h.get("usd_value") or 0 for h in top_holdings)

    # KOL overlap
    mints = [h["mint"] for h in top_holdings if h.get("mint")]
    kol_addresses = await supabase_svc.get_kol_addresses()
    kol_overlap = await clickhouse.get_kol_overlap_batch(mints[:30], kol_addresses)

    # Build holdings summary for Claude
    holdings_lines = []
    for h in top_holdings:
        symbol = h.get("symbol") or h.get("mint", "")[:8]
        usd = h.get("usd_value") or 0
        kol_cnt = kol_overlap.get(h.get("mint", ""), {}).get("kol_count", 0)
        kol_str = f" [{kol_cnt} KOLs hold]" if kol_cnt > 0 else ""
        holdings_lines.append(f"  ${symbol}: ${usd:,.0f}{kol_str}")

    signals_lines = []
    for s in signals[:10]:
        signals_lines.append(f"  [{s.get('confidence', '?')}] {s.get('signal_type', '?')}: {s.get('description', '')}")

    wallet_labels = ", ".join(f"{w['label']} ({w['address'][:8]}…)" for w in own_wallets)

    prompt = f"""You are Bloodhound, an on-chain intelligence terminal for Solana.

Analyze this user's Solana portfolio and write a concise intelligence briefing.

WALLETS: {wallet_labels}
TOTAL PORTFOLIO VALUE: ${total_usd:,.0f}

HOLDINGS (by USD value):
{chr(10).join(holdings_lines) or "  No holdings found."}

RECENT SIGNALS:
{chr(10).join(signals_lines) or "  No recent signals."}

Write a 3-5 paragraph intelligence briefing covering:
1. Overall portfolio health and concentration risk
2. KOL overlap insights (tokens where KOLs are also positioned — bullish signal)
3. Risk flags from signals (if any)
4. One actionable observation

Rules:
- Be specific about token names and USD amounts
- Never speculate on future prices
- If KOL count is 0 on all holdings, say so plainly
- Tone: calm, analytical, professional
- Format: plain paragraphs, no bullet lists"""

    try:
        ai_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        resp = await ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        report_text = resp.content[0].text.strip()
    except Exception as e:
        report_text = f"Report generation failed — backend may be temporarily unavailable. ({type(e).__name__})"

    return {
        "report": report_text,
        "total_usd": round(total_usd, 2),
        "wallet_count": len(own_wallets),
        "holding_count": len(top_holdings),
    }


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default


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
    # Ensure user row exists before any FK-dependent insert
    await supabase_svc.get_or_create_user(user_id)
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
