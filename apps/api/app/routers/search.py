"""
Universal search — wallets, tokens, transactions, programs, @handles.
GET /v1/search?q=...&limit=20
GET /v1/search/autocomplete?q=...
"""

import re
from fastapi import APIRouter, Query
from app.services import clickhouse, supabase as supabase_svc
from app.services.redis_cache import cache_get, cache_set, search_key, TTL_SEARCH

router = APIRouter()

# Solana patterns
_ADDR_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_TX_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{86,88}$")
_HANDLE_RE = re.compile(r"^@?[\w]{1,15}$")


def _classify_query(q: str) -> str:
    """Determine what kind of input the user typed."""
    q = q.strip()
    if _TX_RE.match(q):
        return "transaction"
    if _ADDR_RE.match(q):
        return "address"
    if q.startswith("@") or _HANDLE_RE.match(q):
        return "handle"
    return "text"


@router.get("")
async def universal_search(
    q: str = Query(..., min_length=2, max_length=200),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Universal search across wallets, tokens, transactions, known entities.
    Returns typed results with source labels.
    """
    q = q.strip()
    query_type = _classify_query(q)
    results: list[dict] = []

    if query_type == "transaction":
        results.append(
            {"type": "transaction", "id": q, "label": f"{q[:16]}...", "href": f"/tx/{q}"}
        )

    elif query_type == "address":
        # Check if it's a known wallet first
        known = await _safe(supabase_svc.get_known_wallet(q))
        results.append(
            {
                "type": "wallet",
                "id": q,
                "label": (known or {}).get("label", f"{q[:8]}...{q[-4:]}"),
                "sublabel": (known or {}).get("category"),
                "href": f"/wallet/{q}",
                "known": known,
            }
        )

    elif query_type == "handle":
        handle = q.lstrip("@")
        # Search known_wallets by twitter_handle
        client = supabase_svc.get_client()
        result = (
            client.table("known_wallets")
            .select("address,label,category,twitter_handle")
            .ilike("twitter_handle", handle)
            .eq("status", "approved")
            .limit(limit)
            .execute()
        )
        for row in result.data or []:
            results.append(
                {
                    "type": "wallet",
                    "id": row["address"],
                    "label": row["label"],
                    "sublabel": f"@{row.get('twitter_handle', '')}",
                    "href": f"/wallet/{row['address']}",
                    "known": row,
                }
            )

    else:
        # Text search — search known wallet labels
        client = supabase_svc.get_client()
        wallet_results = (
            client.table("known_wallets")
            .select("address,label,category,twitter_handle")
            .ilike("label", f"%{q}%")
            .eq("status", "approved")
            .limit(limit)
            .execute()
        )
        for row in wallet_results.data or []:
            results.append(
                {
                    "type": "wallet",
                    "id": row["address"],
                    "label": row["label"],
                    "sublabel": row.get("category"),
                    "href": f"/wallet/{row['address']}",
                    "known": row,
                }
            )

    return {"q": q, "query_type": query_type, "results": results[:limit]}


@router.get("/autocomplete")
async def search_autocomplete(
    q: str = Query(..., min_length=2, max_length=100),
):
    """
    Fast autocomplete (<100ms target). Checks Redis cache then known_wallets label index.
    """
    q = q.strip()
    cache_key = search_key(f"ac:{q}")
    if cached := await cache_get(cache_key):
        return cached

    suggestions: list[dict] = []
    query_type = _classify_query(q)

    if query_type == "address":
        # Partial address match — suggest the address itself if valid prefix
        suggestions.append(
            {"type": "wallet", "id": q, "label": f"{q[:8]}...", "href": f"/wallet/{q}"}
        )
    else:
        # Label prefix match from Supabase known_wallets
        client = supabase_svc.get_client()
        result = (
            client.table("known_wallets")
            .select("address,label,category")
            .ilike("label", f"{q}%")
            .eq("status", "approved")
            .limit(8)
            .execute()
        )
        for row in result.data or []:
            suggestions.append(
                {
                    "type": "wallet",
                    "id": row["address"],
                    "label": row["label"],
                    "sublabel": row.get("category"),
                    "href": f"/wallet/{row['address']}",
                }
            )

    result_payload = {"q": q, "suggestions": suggestions}
    await cache_set(cache_key, result_payload, TTL_SEARCH)
    return result_payload


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default
