"""
Known Events — historical Solana on-chain events.
GET  /v1/events              — list all events
GET  /v1/events/{slug}       — event detail + involved wallets
POST /v1/events/submit       — community submission (goes to review queue)
POST /v1/admin/events        — admin: directly publish an event (owner-only)
PUT  /v1/admin/events/{slug}/publish  — admin: publish a draft event
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Header
from pydantic import BaseModel
from typing import Optional
from app.services import supabase as supabase_svc
from app.services.redis_cache import cache_get, cache_set, cache_delete
from app.auth import get_current_user_id
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()

_EVENTS_TTL = 300
_EVENT_TTL  = 300


@router.get("")
async def list_events(
    category: str | None = Query(None),
    significance: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
):
    """List published known events, ordered by occurred_at DESC."""
    key = f"events:list:{category}:{significance}:{limit}"
    if cached := await cache_get(key):
        return cached

    events = await supabase_svc.list_events(
        category=category,
        significance=significance,
        limit=limit,
    )
    result = {"events": events, "count": len(events)}
    await cache_set(key, result, _EVENTS_TTL)
    return result


@router.get("/{slug}")
async def get_event(slug: str):
    """Event detail: description, timeline, involved wallets."""
    key = f"events:slug:{slug}"
    if cached := await cache_get(key):
        return cached

    event = await supabase_svc.get_event_by_slug(slug)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Enrich wallet entries with known_wallet labels from our DB
    import asyncio
    wallets = event.get("wallets", [])
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(w["address"]), default=None) for w in wallets]
    )
    for w, known in zip(wallets, known_results):
        w["known_wallet"] = known

    await cache_set(key, event, _EVENT_TTL)
    return event


class SubmitEventRequest(BaseModel):
    title: str
    category: str
    occurred_at: str        # ISO datetime
    token_mint: Optional[str] = None
    token_symbol: Optional[str] = None
    description: Optional[str] = None
    evidence_urls: list[str] = []


class AdminPublishEventRequest(BaseModel):
    slug: str
    title: str
    category: str
    occurred_at: str
    token_mint: Optional[str] = None
    token_symbol: Optional[str] = None
    description: Optional[str] = None
    significance: str = "notable"


@router.post("/submit", status_code=201)
async def submit_event(
    body: SubmitEventRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Community event submission. Goes into event_submissions table for review.
    Auto-triggers AI research in the background to pre-populate the draft.
    """
    valid_categories = {
        "token_launch", "rug_pull", "hack", "scandal",
        "airdrop", "manipulation", "collapse", "other",
    }
    if body.category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category: {valid_categories}")

    db = supabase_svc.get_client()
    result = db.table("event_submissions").insert({
        "submitter_id": user_id,
        "title": body.title,
        "category": body.category,
        "occurred_at": body.occurred_at,
        "token_mint": body.token_mint,
        "token_symbol": body.token_symbol,
        "description": body.description,
        "evidence_urls": body.evidence_urls,
        "status": "pending",
    }).execute()

    submission_id = result.data[0]["id"] if result.data else None

    # Fire AI research in background if we have a token mint
    if body.token_mint:
        import asyncio
        from app.services.event_detector import _research_and_draft
        asyncio.create_task(
            _research_and_draft(
                token_mint=body.token_mint,
                token_symbol=body.token_symbol,
                signals=[],
                trigger_score=2,
            )
        )

    return {
        "status": "submitted",
        "submission_id": submission_id,
        "message": "Your submission is queued for review. AI research has been triggered.",
    }


@router.post("/admin/publish", status_code=201)
async def admin_publish_event(
    body: AdminPublishEventRequest,
    x_admin_key: str = Header(alias="X-Admin-Key"),
):
    """
    Owner-only: directly publish an event. Requires X-Admin-Key header.
    Also triggers backfill of early buyers from ClickHouse.
    """
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    from app.services.event_detector import _safe_slug, _backfill_early_buyers
    import asyncio

    slug = _safe_slug(body.slug if body.slug else body.title)

    db = supabase_svc.get_client()
    result = db.table("known_events").upsert({
        "slug": slug,
        "title": body.title,
        "category": body.category,
        "occurred_at": body.occurred_at,
        "token_mint": body.token_mint,
        "token_symbol": body.token_symbol,
        "description": body.description,
        "significance": body.significance,
        "chain": "solana",
        "is_published": True,
        "review_status": "published",
        "auto_detected": False,
    }, on_conflict="slug").execute()

    event_id = result.data[0]["id"] if result.data else None

    # Backfill early buyers in background
    if event_id and body.token_mint:
        asyncio.create_task(
            _backfill_early_buyers(event_id, body.token_mint, body.occurred_at)
        )

    # Bust cache
    await cache_delete(f"events:list:None:None:20")

    return {"status": "published", "slug": slug, "event_id": event_id}


@router.put("/admin/{slug}/publish")
async def admin_publish_draft(
    slug: str,
    x_admin_key: str = Header(alias="X-Admin-Key"),
):
    """
    Owner-only: promote a draft (auto_detected) event to published.
    """
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    db = supabase_svc.get_client()
    result = db.table("known_events").update({
        "is_published": True,
        "review_status": "published",
    }).eq("slug", slug).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    await cache_delete(f"events:slug:{slug}")
    return {"status": "published", "slug": slug}


@router.get("/drafts")
async def list_drafts(
    x_admin_key: str = Header(alias="X-Admin-Key"),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Owner-only: list AI-detected events pending review.
    """
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    db = supabase_svc.get_client()
    result = (
        db.table("known_events")
        .select("slug,title,category,significance,occurred_at,token_symbol,ai_confidence,review_status,created_at")
        .eq("review_status", "draft")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"drafts": result.data or [], "count": len(result.data or [])}


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default
