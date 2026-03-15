"""
Universal search — wallets, tokens, transactions, programs, @handles.

GET /v1/search?q=...&limit=20
GET /v1/search/autocomplete?q=...
"""

import re
import logging
import httpx
from fastapi import APIRouter, Query

from app.services import supabase as supabase_svc
from app.services.redis_cache import cache_get, cache_set, search_key, TTL_SEARCH

logger = logging.getLogger(__name__)

# DexScreener API endpoints
DEXSCREENER_SEARCH_URL = "https://api.dexscreener.com/latest/dex/search"


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
        try:
            client = supabase_svc.get_client()
            result = (
                client.table("known_wallets")
                .select("address,label,category,twitter_handle")
                .ilike("twitter_handle", f"%{handle}%")
                .eq("status", "approved")
                .limit(limit)
                .execute()
            )
            for row in result.data or []:
                results.append({
                    "type": "wallet",
                    "id": row["address"],
                    "label": row["label"],
                    "sublabel": f"@{row.get('twitter_handle', '')}",
                    "href": f"/wallet/{row['address']}",
                    "known": row,
                })
        except Exception as e:
            logger.warning(f"Supabase handle search error: {e}")


    else:
        # Text search — known wallet labels + DexScreener token search
        try:
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
                results.append({
                    "type": "wallet",
                    "id": row["address"],
                    "label": row["label"],
                    "sublabel": row.get("category"),
                    "href": f"/wallet/{row['address']}",
                    "known": row,
                })
        except Exception as e:
            logger.warning(f"Supabase text search error: {e}")

        # Token search via DexScreener (free, no key required)
        token_results = await _search_dexscreener(q, limit - len(results))
        results.extend(token_results)

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

    elif query_type == "transaction":
        # Transaction signature — suggest navigating to tx detail
        suggestions.append(
            {"type": "transaction", "id": q, "label": f"{q[:16]}...", "href": f"/tx/{q}"}
        )
    else:
        # Label prefix match from Supabase known_wallets
        try:
            client = supabase_svc.get_client()
            result = (
                client.table("known_wallets")
                .select("address,label,category")
                .ilike("label", f"{q}%")
                .eq("status", "approved")
                .limit(5)
                .execute()
            )
            for row in result.data or []:
                suggestions.append({
                    "type": "wallet",
                    "id": row["address"],
                    "label": row["label"],
                    "sublabel": row.get("category"),
                    "href": f"/wallet/{row['address']}",
                })
        except Exception as e:
            logger.warning(f"Supabase autocomplete error: {e}")

        # Token autocomplete via DexScreener
        if len(suggestions) < 8:
            token_results = await _search_dexscreener(q, 8 - len(suggestions))
            suggestions.extend(token_results)

    result_payload = {"q": q, "suggestions": suggestions}

    await cache_set(cache_key, result_payload, TTL_SEARCH)

    return result_payload





async def _safe(coro, default=None):

    try:

        return await coro

    except Exception:

        return default



async def _search_dexscreener(query: str, limit: int = 10) -> list[dict]:
    """
    Search DexScreener for Solana tokens.
    Handles multiple API response formats gracefully.
    """
    results: list[dict] = []
    seen_mints: set[str] = set()
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            # Try the search endpoint first
            resp = await http.get(DEXSCREENER_SEARCH_URL, params={"q": query})
            
            if resp.status_code == 200:
                data = resp.json()
                
                # Handle different response formats
                pairs = []
                if isinstance(data, dict):
                    # Standard format: {"pairs": [...]}
                    pairs = data.get("pairs") or []
                    # Alternative format: {"data": {"pairs": [...]}}
                    if not pairs and "data" in data:
                        pairs = data.get("data", {}).get("pairs") or []
                elif isinstance(data, list):
                    # Direct array of pairs
                    pairs = data
                
                for pair in pairs:
                    if not isinstance(pair, dict):
                        continue
                    # Filter to Solana only
                    chain_id = pair.get("chainId", "").lower()
                    if chain_id != "solana":
                        continue
                    
                    base = pair.get("baseToken") or {}
                    mint = base.get("address", "")
                    if not mint or mint in seen_mints:
                        continue
                    
                    seen_mints.add(mint)
                    results.append(
                        {
                            "type": "token",
                            "id": mint,
                            "label": base.get("name") or base.get("symbol") or mint[:8],
                            "sublabel": base.get("symbol"),
                            "href": f"/token/{mint}",
                        }
                    )
                    if len(results) >= limit:
                        break
            else:
                logger.warning(f"DexScreener search returned status {resp.status_code}")
                
    except httpx.TimeoutException:
        logger.debug(f"DexScreener search timeout for query: {query}")
    except Exception as e:
        logger.warning(f"DexScreener search error: {e}")
    
    return results
