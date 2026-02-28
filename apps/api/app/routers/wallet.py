"""
Wallet API endpoints.
GET /v1/wallet/{address}/summary
GET /v1/wallet/{address}/transfers
GET /v1/wallet/{address}/holdings
GET /v1/wallet/{address}/nft-holdings
GET /v1/wallet/{address}/relationships
GET /v1/wallet/{address}/side-wallets
GET /v1/wallet/{address}/classification
GET /v1/wallet/{address}/intelligence
GET /v1/wallet/{address}/graph
GET /v1/wallet/{address}/tracker-count
"""

import re
from fastapi import APIRouter, Query, HTTPException
from app.services import clickhouse, helius
from app.services import supabase as supabase_svc
from app.services import birdeye, classification as classification_svc
from app.services.redis_cache import (
    cache_get, cache_set, wallet_key,
    TTL_PRICE, TTL_WALLET_STATS, TTL_CLASSIFICATION, TTL_KNOWN_WALLET,
)
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

# Solana address: base58, 32–44 chars
_SOLANA_ADDR_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


def _validate_address(address: str) -> None:
    if not _SOLANA_ADDR_RE.match(address):
        raise HTTPException(status_code=400, detail="Invalid Solana address format")


@router.get("/{address}/summary")
async def wallet_summary(address: str):
    """
    Core wallet summary: stats, SOL balance, portfolio USD, classification.
    Combines ClickHouse aggregate + Helius RPC + Birdeye + Supabase.
    """
    _validate_address(address)

    cache_key = wallet_key(address, "summary")
    if cached := await cache_get(cache_key):
        return cached

    # Fetch in parallel
    import asyncio

    (
        stats,
        sol_balance_result,
        portfolio_result,
        known_wallet,
        classification_result,
        tracker_count,
    ) = await asyncio.gather(
        clickhouse.get_wallet_stats(address),
        _safe(helius.get_sol_balance(address), default=None),
        _safe(birdeye.get_wallet_portfolio(address), default={}),
        _safe(supabase_svc.get_known_wallet(address), default=None),
        _safe(classification_svc.classify_wallet(address), default={"labels": [], "confidence": {}}),
        _safe(supabase_svc.get_tracker_count(address), default=0),
    )

    result = {
        "address": address,
        "sol_balance": sol_balance_result,
        "portfolio_usd": (portfolio_result or {}).get("total_usd"),
        "total_txs": stats.get("total_txs", 0),
        "total_volume_usd": stats.get("total_volume_usd", 0),
        "active_days": stats.get("active_days", 0),
        "first_active": str(stats["first_active"]) if stats.get("first_active") else None,
        "last_active": str(stats["last_active"]) if stats.get("last_active") else None,
        "classification": classification_result.get("labels", []),
        "classification_confidence": classification_result.get("confidence", {}),
        "known_wallet": known_wallet,
        "tracker_count": tracker_count,
    }

    await cache_set(cache_key, result, TTL_WALLET_STATS)
    return result


@router.get("/{address}/transfers")
async def wallet_transfers(
    address: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    token: str | None = None,
    direction: str = Query("both", pattern="^(in|out|both)$"),
    date_from: str | None = None,
    date_to: str | None = None,
    tx_type: str | None = None,
):
    """Paginated transfer history with filters."""
    _validate_address(address)
    offset = (page - 1) * limit
    transfers = await clickhouse.get_wallet_transfers(
        address=address,
        limit=limit,
        offset=offset,
        token_mint=token,
        direction=direction,
        date_from=date_from,
        date_to=date_to,
        tx_type=tx_type,
    )
    # Enrich with known wallet labels
    known_cache: dict[str, dict | None] = {}
    addresses = {t["from_address"] for t in transfers} | {t["to_address"] for t in transfers}
    import asyncio
    labels = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(a), default=None) for a in addresses]
    )
    for addr, label in zip(addresses, labels):
        known_cache[addr] = label

    for t in transfers:
        t["from_known"] = known_cache.get(t["from_address"])
        t["to_known"] = known_cache.get(t["to_address"])

    return {
        "address": address,
        "page": page,
        "limit": limit,
        "transfers": transfers,
    }


@router.get("/{address}/holdings")
async def wallet_holdings(address: str):
    """Token holdings with live USD values from Birdeye."""
    _validate_address(address)
    cache_key = wallet_key(address, "holdings")
    if cached := await cache_get(cache_key):
        return cached

    try:
        portfolio = await birdeye.get_wallet_portfolio(address)
    except Exception:
        portfolio = {"total_usd": None, "holdings": []}

    result = {
        "address": address,
        "total_usd": portfolio.get("total_usd"),
        "holdings": portfolio.get("holdings", []),
    }
    await cache_set(cache_key, result, TTL_PRICE)
    return result


@router.get("/{address}/nft-holdings")
async def wallet_nft_holdings(address: str):
    """
    NFT holdings via Helius DAS API.
    Returns collection name, floor price estimate, image URI.
    """
    _validate_address(address)
    cache_key = wallet_key(address, "nfts")
    if cached := await cache_get(cache_key):
        return cached

    try:
        das_response = await helius.get_token_accounts(address)
        items = das_response.get("result", {}).get("items", [])
        nfts = [
            {
                "mint": item.get("id", ""),
                "name": item.get("content", {}).get("metadata", {}).get("name"),
                "symbol": item.get("content", {}).get("metadata", {}).get("symbol"),
                "image": item.get("content", {}).get("links", {}).get("image"),
                "collection": (item.get("grouping") or [{}])[0].get("group_value"),
            }
            for item in items
            if item.get("interface") in ("V1_NFT", "ProgrammableNFT", "MplCoreAsset")
        ]
    except Exception:
        nfts = []

    result = {"address": address, "nfts": nfts, "count": len(nfts)}
    await cache_set(cache_key, result, TTL_WALLET_STATS)
    return result


@router.get("/{address}/relationships")
async def wallet_relationships(
    address: str,
    limit: int = Query(10, ge=1, le=50),
):
    """Top counterparties + relationship summary, enriched with known wallet labels."""
    _validate_address(address)
    cache_key = wallet_key(address, f"relationships:{limit}")
    if cached := await cache_get(cache_key):
        return cached

    counterparties = await clickhouse.get_top_counterparties(address, limit=limit)

    import asyncio
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(c["counterparty"]), default=None) for c in counterparties]
    )
    for cp, known in zip(counterparties, known_results):
        cp["known_wallet"] = known

    result = {"address": address, "counterparties": counterparties}
    await cache_set(cache_key, result, TTL_WALLET_STATS)
    return result


@router.get("/{address}/side-wallets")
async def wallet_side_wallets(address: str):
    """
    Suspected side wallets above the confidence threshold.
    Enriched with known wallet labels and signals breakdown.
    """
    _validate_address(address)
    candidates = await supabase_svc.get_side_wallet_candidates(
        address, min_confidence=settings.side_wallet_min_confidence
    )

    import asyncio
    known_results = await asyncio.gather(
        *[_safe(supabase_svc.get_known_wallet(c["related_address"]), default=None) for c in candidates]
    )
    # Normalize to match frontend SideWalletCandidate interface
    normalized = [
        {
            "address": c["related_address"],
            "confidence": c["confidence"],
            "signals": c.get("signals", []),
            "signal_weights": c.get("signal_weights", {}),
            "known_label": (known or {}).get("label"),
        }
        for c, known in zip(candidates, known_results)
    ]
    return {"address": address, "candidates": normalized}


@router.get("/{address}/classification")
async def wallet_classification(
    address: str,
    force_refresh: bool = Query(False),
):
    """
    AI classification labels with confidence scores.
    Returns cached result or triggers recomputation.
    """
    _validate_address(address)
    result = await classification_svc.classify_wallet(address, force_refresh=force_refresh)
    return {
        "address": address,
        "labels": result.get("labels", []),
        "confidence": result.get("confidence", {}),
        "signals": result.get("signals", {}),
        "computed_at": result.get("computed_at"),
    }


@router.get("/{address}/intelligence")
async def wallet_intelligence(address: str):
    """
    Full AI-generated narrative summary of wallet behavior.
    Calls Bloodhound AI with wallet context pre-loaded.
    """
    _validate_address(address)
    cache_key = wallet_key(address, "intelligence")
    if cached := await cache_get(cache_key):
        return cached

    # Build context and delegate to AI service
    try:
        from app.services.ai_pipeline import generate_wallet_intelligence
        result = await generate_wallet_intelligence(address)
    except Exception as e:
        result = {
            "address": address,
            "summary": None,
            "confidence": "UNKNOWN",
            "error": str(e),
        }

    await cache_set(cache_key, result, TTL_CLASSIFICATION)
    return result


@router.get("/{address}/graph")
async def wallet_graph(
    address: str,
    depth: int = Query(2, ge=1, le=5),
):
    """
    Graph data (nodes + edges) for relationship visualization.
    Depth > 3 triggers a warning — can be very large.
    """
    _validate_address(address)
    if depth > 3:
        # Still compute but warn
        pass

    # Seed node
    known = await _safe(supabase_svc.get_known_wallet(address), default=None)
    classification = await _safe(
        classification_svc.classify_wallet(address),
        default={"labels": []},
    )
    nodes = [
        {
            "id": address,
            "label": (known or {}).get("label", address[:8] + "..."),
            "type": "seed",
            "classification": classification.get("labels", []),
            "known": known,
        }
    ]
    edges = []
    seen_addresses = {address}
    frontier = [address]

    for hop in range(depth):
        next_frontier: list[str] = []
        import asyncio
        batch = await asyncio.gather(
            *[clickhouse.get_top_counterparties(addr, limit=10) for addr in frontier]
        )
        for source_addr, counterparties in zip(frontier, batch):
            for cp in counterparties:
                target = cp["counterparty"]
                if not target:
                    continue
                edge_id = f"{source_addr}-{target}"
                edges.append(
                    {
                        "id": edge_id,
                        "source": source_addr,
                        "target": target,
                        "interaction_count": cp["interaction_count"],
                        "total_volume_usd": cp["total_volume_usd"],
                        "last_interaction": str(cp.get("last_interaction", "")),
                    }
                )
                if target not in seen_addresses:
                    seen_addresses.add(target)
                    next_frontier.append(target)
                    nodes.append(
                        {
                            "id": target,
                            "label": target[:8] + "...",
                            "type": "hop",
                            "hop": hop + 1,
                            "classification": [],
                            "known": None,
                        }
                    )
        frontier = next_frontier
        if not frontier:
            break

    return {
        "address": address,
        "depth": depth,
        "nodes": nodes,
        "edges": edges,
        "warning": "Graph may be very large at this depth." if depth > 3 else None,
    }


@router.get("/{address}/tracker-count")
async def wallet_tracker_count(address: str):
    """How many users are tracking this wallet. Public endpoint."""
    _validate_address(address)
    count = await supabase_svc.get_tracker_count(address)
    return {"address": address, "tracker_count": count}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _safe(coro, default=None):
    """Await a coroutine and return default on any exception."""
    try:
        return await coro
    except Exception:
        return default
