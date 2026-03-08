"""
Entity router — US-B704/705.

GET /v1/entity/{address}
  Returns the identity cluster for a wallet:
  - All suspected side wallets with confidence scores + AI explanation
  - Combined token holdings across all cluster members (merged by mint)
  - Combined events (deduplicated by slug)
  - Known wallet profile for the root address

POST /v1/entity/{address}/dispute/{related_address}
  Submit a dispute for an incorrect side-wallet relationship.
  Reduces confidence ±0.05 per unique disputer.
"""

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_optional_user_id

from app.services import supabase as supabase_svc, birdeye
from app.services.clustering import find_entity_cluster, trace_funding_graph
from app.services.redis_cache import cache_get, cache_set

router = APIRouter()

_ENTITY_TTL = 300  # 5 min


@router.get("/{address}")
async def get_entity(address: str):
    """
    Identity cluster profile for a wallet address.
    Aggregates holdings and events across all suspected side wallets.
    """
    cache_key = f"entity:full:{address}"
    if cached := await cache_get(cache_key):
        return cached

    # Fetch cluster + known wallet in parallel
    cluster, known = await asyncio.gather(
        find_entity_cluster(address),
        _safe(supabase_svc.get_known_wallet(address), default=None),
    )

    all_addresses = [address] + [m["address"] for m in cluster.get("members", [])]

    # Fetch portfolio + events for each address in parallel
    portfolio_results, events_results = await asyncio.gather(
        asyncio.gather(*[
            _safe(birdeye.get_wallet_portfolio(a), default={}) for a in all_addresses
        ]),
        asyncio.gather(*[
            _safe(supabase_svc.get_wallet_events(a), default=[]) for a in all_addresses
        ]),
    )

    # Merge holdings — sum USD value for duplicate mints
    merged: dict[str, dict[str, Any]] = {}
    for portfolio in portfolio_results:
        for token in (portfolio or {}).get("holdings", []):
            mint = token.get("mint") or token.get("address", "")
            if not mint:
                continue
            if mint in merged:
                merged[mint]["usd_value"] = (
                    merged[mint].get("usd_value", 0) + token.get("usd_value", 0)
                )
                merged[mint]["amount"] = (
                    merged[mint].get("amount", 0) + token.get("amount", 0)
                )
            else:
                merged[mint] = dict(token)

    combined_holdings = sorted(
        merged.values(), key=lambda t: t.get("usd_value", 0), reverse=True
    )[:20]

    total_usd = sum(h.get("usd_value", 0) for h in combined_holdings)

    # Deduplicate events across all cluster wallets
    seen: set[str] = set()
    combined_events: list[dict[str, Any]] = []
    for events in events_results:
        for evt in (events or []):
            slug = evt.get("slug", "")
            if slug and slug not in seen:
                seen.add(slug)
                combined_events.append(evt)

    result: dict[str, Any] = {
        "address": address,
        "known_wallet": known,
        "cluster": cluster,
        "total_usd": round(total_usd, 2),
        "combined_holdings": combined_holdings,
        "combined_events": combined_events,
        "wallet_count": len(all_addresses),
    }

    await cache_set(cache_key, result, _ENTITY_TTL)
    return result


@router.get("/{address}/funding-graph")
async def entity_funding_graph(address: str):
    """
    US-B1504: Trace the SOL funding graph for a wallet.
    Returns sibling wallets (likely same entity) discovered by following
    who funded whom. Automatically upserts high-confidence pairs into
    side_wallet_candidates.
    """
    result = await _safe(trace_funding_graph(address), default={
        "root": address,
        "funding_source": None,
        "funding_chain": [],
        "siblings": [],
        "graph": {"nodes": [], "edges": []},
    })
    return result


@router.post("/{address}/dispute/{related_address}")
async def dispute_side_wallet(
    address: str,
    related_address: str,
    user_id: str | None = Depends(get_optional_user_id),
):
    """
    Flag a suspected side-wallet relationship as incorrect.
    Each unique user dispute reduces confidence by 0.05.
    Requires Clerk JWT (injected by Next.js proxy).
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    inserted = await supabase_svc.add_dispute(address, related_address, user_id)
    dispute_count = await supabase_svc.get_dispute_count(address, related_address)
    return {
        "wallet_address": address,
        "related_address": related_address,
        "dispute_submitted": inserted,
        "total_disputes": dispute_count,
        "confidence_adjustment": round(-0.05 * dispute_count, 2),
    }


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default
