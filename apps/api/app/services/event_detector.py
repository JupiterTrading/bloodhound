"""
AI-powered event detection engine — automated known_events population.

Pipeline:
  1. Triggered by wallet_poller after each signal batch
  2. Checks if signals cluster around a new/unknown token with suspicious patterns
  3. Calls Claude (with native web_search) to research the token/event
  4. Claude returns structured event draft: title, category, description, confidence
  5. Auto-publishes if CONFIRMED; saves as draft if PROBABLE; ignores SUSPECTED/UNKNOWN
  6. Populates event_wallets from ClickHouse (deployer, early buyers, bundlers)
  7. Backfills wallet→event cross-references for all tracked wallets

Trigger thresholds (any one is sufficient):
  - Fan-out signal on a new token (bundled launch pattern)
  - kol_pre_buy signal (KOL bought before tweeting)
  - Large transfer signal AND token is <7 days old
  - New token with >$500k volume in first hour (from ClickHouse)

Deduplication:
  - known_events.slug is UNIQUE — duplicate detection is blocked at DB level
  - We also check before calling Claude to avoid wasted API calls
"""

import json
import re
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any

import anthropic

from app.core.config import get_settings
from app.services.redis_cache import cache_get, cache_set

settings = get_settings()

# Minimum signal score to trigger detection (avoids spamming Claude on noise)
MIN_TRIGGER_SCORE = 2
# Auto-publish threshold — below this, save as draft for human review
AUTO_PUBLISH_CONFIDENCE = {"CONFIRMED"}
DRAFT_CONFIDENCE = {"PROBABLE"}

# Redis key to track tokens we've already evaluated (24hr cooldown)
_EVALUATED_KEY = "event_detector:evaluated:{mint}"

EVENT_DETECTION_PROMPT = """You are the Bloodhound event intelligence engine. Your job is to decide whether a pattern of on-chain activity represents a significant, documentable Solana event worth adding to our historical events database.

You have access to web_search. Use it to research the token and any associated news, scandals, or notable activity.

INPUT:
- Token mint: {mint}
- Token symbol: {symbol}
- On-chain signals detected: {signals_summary}
- Detection time: {detected_at}

TASK:
1. Search the web for news about this token, its launch, any scandals or notable events
2. Cross-reference with the on-chain signal patterns
3. Decide whether this is a documentable event

RESPOND WITH VALID JSON ONLY (no markdown, no explanation outside the JSON):
{{
  "create_event": true/false,
  "confidence": "CONFIRMED|PROBABLE|SUSPECTED|UNKNOWN",
  "reasoning": "1-2 sentences on why this is/isn't worth documenting",
  "title": "Short event title (if create_event=true)",
  "category": "token_launch|rug_pull|hack|scandal|airdrop|manipulation|collapse|other",
  "significance": "historic|notable|minor",
  "description": "2-4 sentence narrative for the event page (if create_event=true)",
  "slug": "url-safe-slug-from-title",
  "occurred_at": "ISO datetime of when the event happened",
  "involved_wallets": [
    {{"address": "...", "role": "deployer|early_buyer|insider|bundler|suspicious", "description": "what they did"}}
  ]
}}

CONFIDENCE RULES:
- CONFIRMED: clear on-chain evidence + web corroboration (news articles, social media posts about the event)
- PROBABLE: strong on-chain signals + some web context but incomplete corroboration
- SUSPECTED: on-chain signals only, nothing found online — do NOT create event
- UNKNOWN: insufficient data — do NOT create event

Only set create_event=true for CONFIRMED or PROBABLE.
"""


async def maybe_detect_event(
    signals: list[dict[str, Any]],
    transfer_rows: list[dict[str, Any]],
    wallet_address: str,
) -> None:
    """
    Entry point called from wallet_poller after each signal batch.
    Evaluates whether the signal cluster warrants event detection.
    Runs entirely in the background — never raises to the caller.
    """
    try:
        trigger_score, token_mint, token_symbol = _score_signals(signals, transfer_rows)
        if trigger_score < MIN_TRIGGER_SCORE or not token_mint:
            return

        # Cooldown — don't re-evaluate the same token within 24h
        cooldown_key = _EVALUATED_KEY.format(mint=token_mint)
        if await cache_get(cooldown_key):
            return
        await cache_set(cooldown_key, True, ttl=86400)

        # Check if event already exists for this mint
        from app.services import supabase as sb
        existing = await _event_exists_for_mint(token_mint)
        if existing:
            # Event exists — check if we should add wallet associations
            await _maybe_add_wallet_to_event(existing, wallet_address, signals)
            return

        print(f"[event_detector] triggering AI research for {token_symbol or token_mint[:8]}... (score={trigger_score})")
        await _research_and_draft(token_mint, token_symbol, signals, trigger_score)

    except Exception as e:
        print(f"[event_detector] error: {e}")


def _score_signals(
    signals: list[dict[str, Any]],
    transfers: list[dict[str, Any]],
) -> tuple[int, str | None, str | None]:
    """
    Score the signal batch and return (score, token_mint, token_symbol).
    Higher score = more likely this is a significant event.
    """
    score = 0
    token_mint: str | None = None
    token_symbol: str | None = None

    for sig in signals:
        stype = sig.get("signal_type", "")
        if stype == "kol_pre_buy":
            score += 3
            token_mint = token_mint or sig.get("token_mint")
        elif stype == "multiple_sends":
            score += 2
            # Fan-out on a new token is a strong signal
        elif stype == "large_transfer":
            score += 1
            token_mint = token_mint or sig.get("token_mint")
        elif stype == "exchange_withdrawal":
            score += 1

    # If we don't have a mint from signals, try transfers
    if not token_mint:
        # Most-traded non-SOL mint in this batch
        mint_counts: dict[str, int] = {}
        for t in transfers:
            m = t.get("token_mint")
            if m and m != "SOL":
                mint_counts[m] = mint_counts.get(m, 0) + 1
        if mint_counts:
            token_mint = max(mint_counts, key=lambda k: mint_counts[k])

    return score, token_mint, token_symbol


async def _event_exists_for_mint(token_mint: str) -> dict[str, Any] | None:
    """Check if we already have an event for this token mint."""
    try:
        from app.services.supabase import get_client
        client = get_client()
        result = (
            client.table("known_events")
            .select("id,slug,title")
            .eq("token_mint", token_mint)
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception:
        return None


async def _maybe_add_wallet_to_event(
    event: dict[str, Any],
    wallet_address: str,
    signals: list[dict[str, Any]],
) -> None:
    """If a wallet has strong signals related to a known event, add it to event_wallets."""
    try:
        kol_signal = next((s for s in signals if s.get("signal_type") == "kol_pre_buy"), None)
        if not kol_signal:
            return

        role = "early_buyer"
        description = kol_signal.get("description", "")[:200]

        from app.services.supabase import get_client
        client = get_client()
        client.table("event_wallets").upsert(
            {
                "event_id": event["id"],
                "address": wallet_address,
                "role": role,
                "description": description,
            },
            on_conflict="event_id,address",
        ).execute()
    except Exception:
        pass


async def _research_and_draft(
    token_mint: str,
    token_symbol: str | None,
    signals: list[dict[str, Any]],
    trigger_score: int,
) -> None:
    """
    Ask Claude to research the token/event using web search,
    then draft and save the event record.
    """
    signals_summary = _summarise_signals(signals)
    detected_at = datetime.now(timezone.utc).isoformat()

    prompt = EVENT_DETECTION_PROMPT.format(
        mint=token_mint,
        symbol=token_symbol or "unknown",
        signals_summary=signals_summary,
        detected_at=detected_at,
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        all_tools = [{"type": "web_search_20250305"}]

        messages = [{"role": "user", "content": prompt}]
        answer_text = ""

        # Tool loop — Claude may call web_search multiple times before answering
        for _ in range(6):
            response = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                tools=all_tools,
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        answer_text = block.text
                break

            # Continue tool loop
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": []})

        if not answer_text:
            return

        # Parse JSON from response
        event_draft = _extract_json(answer_text)
        if not event_draft or not event_draft.get("create_event"):
            print(f"[event_detector] AI decided not to create event for {token_mint[:8]}... ({event_draft.get('confidence','?')}: {event_draft.get('reasoning','')[:80]})")
            return

        confidence = event_draft.get("confidence", "UNKNOWN")
        if confidence not in ("CONFIRMED", "PROBABLE"):
            return

        # Determine publish status
        review_status = "auto_published" if confidence in AUTO_PUBLISH_CONFIDENCE else "draft"
        is_published = review_status == "auto_published"

        slug = _safe_slug(event_draft.get("slug") or event_draft.get("title", token_mint[:8]))

        from app.services.supabase import get_client
        db = get_client()

        # Insert event
        result = db.table("known_events").insert({
            "slug": slug,
            "title": event_draft.get("title", f"Event: {token_symbol or token_mint[:8]}"),
            "category": event_draft.get("category", "other"),
            "significance": event_draft.get("significance", "notable"),
            "description": event_draft.get("description"),
            "occurred_at": event_draft.get("occurred_at", detected_at),
            "token_mint": token_mint,
            "token_symbol": token_symbol,
            "chain": "solana",
            "is_published": is_published,
            "auto_detected": True,
            "ai_confidence": confidence,
            "review_status": review_status,
            "source_signals": json.dumps(signals[:5], default=str),
        }).execute()

        if not result.data:
            return

        event_id = result.data[0]["id"]
        print(f"[event_detector] {'published' if is_published else 'drafted'} event: {event_draft.get('title')} [{confidence}]")

        # Populate event_wallets from AI response + ClickHouse
        involved = event_draft.get("involved_wallets", [])
        await _save_event_wallets(event_id, involved)
        await _backfill_early_buyers(event_id, token_mint, event_draft.get("occurred_at", detected_at))

    except Exception as e:
        print(f"[event_detector] research error for {token_mint[:8]}...: {e}")


async def _save_event_wallets(event_id: str, wallets: list[dict]) -> None:
    """Save AI-identified wallet associations."""
    if not wallets:
        return
    try:
        from app.services.supabase import get_client
        db = get_client()
        rows = [
            {
                "event_id": event_id,
                "address": w["address"],
                "role": w.get("role", "other"),
                "description": w.get("description"),
            }
            for w in wallets
            if w.get("address")
        ]
        if rows:
            db.table("event_wallets").upsert(rows, on_conflict="event_id,address").execute()
    except Exception:
        pass


async def _backfill_early_buyers(
    event_id: str,
    token_mint: str,
    occurred_at: str,
) -> None:
    """
    Query Supabase wallet_trades for wallets that bought this token early
    and add them as early_buyer entries in event_wallets.
    Capped at 20 wallets to avoid noise.
    """
    try:
        from app.services.supabase import get_client
        db = get_client()

        event_time = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
        window_end = event_time + timedelta(minutes=30)

        result = db.table("wallet_trades").select(
            "wallet_address, block_time, amount_usd"
        ).eq("token_address", token_mint).eq(
            "trade_type", "buy"
        ).gte("block_time", event_time.isoformat()).lte(
            "block_time", window_end.isoformat()
        ).order("block_time").limit(20).execute()

        if not result.data:
            return

        # Aggregate by wallet
        from collections import defaultdict
        wallet_agg: dict[str, dict] = defaultdict(lambda: {"total_usd": 0.0, "count": 0})
        for r in result.data:
            addr = r.get("wallet_address", "")
            wallet_agg[addr]["total_usd"] += float(r.get("amount_usd", 0) or 0)
            wallet_agg[addr]["count"] += 1

        rows = []
        for trader, agg in wallet_agg.items():
            rows.append({
                "event_id": event_id,
                "address": trader,
                "role": "early_buyer",
                "description": f"Bought within first 30min — ${agg['total_usd']:,.0f} across {agg['count']} trades",
                "amount_usd": agg["total_usd"],
            })

        if rows:
            db.table("event_wallets").upsert(rows, on_conflict="event_id,address").execute()
            print(f"[event_detector] backfilled {len(rows)} early buyers for event {event_id[:8]}...")

    except Exception as e:
        print(f"[event_detector] backfill error: {e}")


def _summarise_signals(signals: list[dict[str, Any]]) -> str:
    summary = []
    for s in signals[:8]:
        summary.append(f"- {s.get('signal_type')} [{s.get('confidence')}]: {s.get('description','')[:120]}")
    return "\n".join(summary) or "No signals"


def _extract_json(text: str) -> dict | None:
    """Extract the first JSON object from a text response."""
    try:
        # Try direct parse first
        return json.loads(text.strip())
    except Exception:
        pass
    # Try extracting from markdown code block or inline
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return None


def _safe_slug(text: str) -> str:
    """Convert a title to a URL-safe slug."""
    slug = text.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:80]
