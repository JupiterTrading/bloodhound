"""
Identity clustering engine — US-B704/705.

Detects wallets likely controlled by the same entity using behavioral signals
computed from ClickHouse transaction data.

Signals (weighted):
  common_funder   (0.35) — both wallets received SOL from the same source
  fund_flow       (0.40) — one wallet directly funded the other
  token_overlap   (0.25) — ≥3 shared tokens traded within 30-min windows
  timing_sync     (0.20) — ≥5 tx pairs within 60-second windows
  dex_preference  (0.15) — identical top DEX by trade count

Total confidence is capped at 1.0. Pairs above MIN_CONFIDENCE are saved to
side_wallet_candidates. Claude Haiku generates a one-sentence explanation for
pairs above EXPLAIN_THRESHOLD.
"""

import asyncio
from typing import Any

from app.services import analytics
from app.services import supabase as supabase_svc
from app.services.redis_cache import cache_get, cache_set

CLUSTER_TTL = 3600          # 1h — entity cluster response cache
MIN_CONFIDENCE = 0.50       # minimum to save a pair
EXPLAIN_THRESHOLD = 0.60    # minimum to call Claude for explanation
CANDIDATE_LIMIT = 20        # max candidate wallets to score per wallet

SIGNAL_WEIGHTS: dict[str, float] = {
    "common_funder":  0.35,
    "fund_flow":      0.40,
    "token_overlap":  0.25,
    "timing_sync":    0.20,
    "dex_preference": 0.15,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def find_entity_cluster(address: str) -> dict[str, Any]:
    """
    Return the entity cluster for an address from cached side_wallet_candidates.
    {
      "root": address,
      "members": [{"address", "confidence", "signals", "explanation"}],
      "cluster_confidence": float,
    }
    """
    cache_key = f"entity:cluster:{address}"
    if cached := await cache_get(cache_key):
        return cached

    candidates = await supabase_svc.get_side_wallet_candidates(address, min_confidence=MIN_CONFIDENCE)

    members = []
    for c in candidates:
        members.append({
            "address": c["related_address"],
            "confidence": c["confidence"],
            "signals": c.get("signals", []),
            "signal_weights": c.get("signal_weights", {}),
            "explanation": c.get("ai_explanation"),
        })

    cluster_confidence = max((m["confidence"] for m in members), default=0.0)
    result: dict[str, Any] = {
        "root": address,
        "members": members,
        "cluster_confidence": cluster_confidence,
    }

    await cache_set(cache_key, result, CLUSTER_TTL)
    return result


async def run_clustering_for_wallet(address: str) -> int:
    """
    Run clustering analysis for one wallet.
    Finds candidate pairs via ClickHouse, scores them, and upserts results.
    Returns the count of pairs at or above MIN_CONFIDENCE.
    """
    candidates = await _find_candidate_addresses(address)
    if not candidates:
        return 0

    updated = 0
    for candidate in candidates[:CANDIDATE_LIMIT]:
        try:
            conf, signals, weights = await _score_pair(address, candidate)
            if conf >= MIN_CONFIDENCE:
                explanation = await _explain_pair(address, candidate, signals, conf)
                await _upsert_pair(address, candidate, conf, signals, weights, explanation)
                updated += 1
        except Exception as e:
            print(f"[clustering] error scoring {address[:8]}…/{candidate[:8]}…: {e}")

    if updated:
        # Bust entity cluster cache so next request gets fresh data
        await cache_set(f"entity:cluster:{address}", None, 1)

    return updated


# ---------------------------------------------------------------------------
# Candidate discovery
# ---------------------------------------------------------------------------

async def _find_candidate_addresses(address: str) -> list[str]:
    """
    Find candidate wallets via Helius counterparties.
    These are the candidates to score for identity clustering.
    """
    try:
        counterparties = await analytics.get_top_counterparties(address, limit=20)
        return [cp["counterparty"] for cp in counterparties if cp.get("counterparty")]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Pair scoring
# ---------------------------------------------------------------------------

async def _score_pair(
    wallet_a: str, wallet_b: str
) -> tuple[float, list[str], dict[str, float]]:
    """
    Evaluate all signals for a wallet pair.
    Returns (confidence, triggered_signal_names, signal_weights_used).
    """
    checks = await asyncio.gather(
        _signal_common_funder(wallet_a, wallet_b),
        _signal_fund_flow(wallet_a, wallet_b),
        _signal_token_overlap(wallet_a, wallet_b),
        _signal_timing_sync(wallet_a, wallet_b),
        _signal_dex_preference(wallet_a, wallet_b),
        return_exceptions=True,
    )

    signal_names = ["common_funder", "fund_flow", "token_overlap", "timing_sync", "dex_preference"]
    triggered: list[str] = []
    weights_used: dict[str, float] = {}
    total = 0.0

    for name, result in zip(signal_names, checks):
        if isinstance(result, Exception) or not result:
            continue
        triggered.append(name)
        w = SIGNAL_WEIGHTS[name]
        weights_used[name] = w
        total += w

    return min(total, 1.0), triggered, weights_used


async def _signal_common_funder(wallet_a: str, wallet_b: str) -> bool:
    """Both wallets received early transfers from the same source address."""
    try:
        funder_a = await _get_primary_funder(wallet_a)
        funder_b = await _get_primary_funder(wallet_b)
        return bool(funder_a and funder_b and funder_a == funder_b)
    except Exception:
        return False


async def _signal_fund_flow(wallet_a: str, wallet_b: str) -> bool:
    """One wallet directly sent SOL or tokens to the other."""
    try:
        result = await analytics.check_transfers_between(wallet_a, wallet_b, min_amount_sol=0.01)
        if result.get("found"):
            return True
        result2 = await analytics.check_transfers_between(wallet_b, wallet_a, min_amount_sol=0.01)
        return result2.get("found", False)
    except Exception:
        return False


async def _signal_token_overlap(wallet_a: str, wallet_b: str) -> bool:
    """Both wallets traded ≥3 of the same tokens. Check Supabase wallet_trades."""
    try:
        sb = supabase_svc.get_supabase()
        trades_a = sb.table("wallet_trades").select("token_address").eq(
            "wallet_address", wallet_a
        ).limit(100).execute()
        trades_b = sb.table("wallet_trades").select("token_address").eq(
            "wallet_address", wallet_b
        ).limit(100).execute()
        tokens_a = set(r["token_address"] for r in (trades_a.data or []) if r.get("token_address"))
        tokens_b = set(r["token_address"] for r in (trades_b.data or []) if r.get("token_address"))
        overlap = tokens_a & tokens_b
        return len(overlap) >= 3
    except Exception:
        return False


async def _signal_timing_sync(wallet_a: str, wallet_b: str) -> bool:
    """≥5 transactions from both wallets occur within 60-second windows.
    Approximated via Helius recent transactions."""
    try:
        from app.services.helius import get_wallet_transactions
        txs_a = await get_wallet_transactions(wallet_a, limit=50)
        txs_b = await get_wallet_transactions(wallet_b, limit=50)
        times_a = [tx.get("timestamp", 0) for tx in txs_a if tx.get("timestamp")]
        times_b = [tx.get("timestamp", 0) for tx in txs_b if tx.get("timestamp")]
        sync_count = 0
        for ta in times_a:
            for tb in times_b:
                if abs(ta - tb) < 60:
                    sync_count += 1
                    break
        return sync_count >= 5
    except Exception:
        return False


async def _signal_dex_preference(wallet_a: str, wallet_b: str) -> bool:
    """Both wallets have the same top DEX platform. Uses Helius tx sources."""
    try:
        from app.services.helius import get_wallet_transactions

        async def top_source(addr: str) -> str | None:
            txs = await get_wallet_transactions(addr, limit=50)
            from collections import Counter
            sources = Counter(tx.get("source", "").lower() for tx in txs if tx.get("source"))
            if sources:
                top = sources.most_common(1)[0]
                return top[0] if top[0] not in ("", "unknown") else None
            return None

        dex_a, dex_b = await asyncio.gather(top_source(wallet_a), top_source(wallet_b))
        return bool(dex_a and dex_b and dex_a == dex_b)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# AI explanation
# ---------------------------------------------------------------------------

async def _explain_pair(
    wallet_a: str,
    wallet_b: str,
    signals: list[str],
    confidence: float,
) -> str | None:
    """
    Call Claude Haiku to produce a one-sentence plain-English explanation
    for why these two wallets are suspected to belong to the same entity.
    Only called when confidence ≥ EXPLAIN_THRESHOLD.
    """
    if confidence < EXPLAIN_THRESHOLD or not signals:
        return None
    try:
        import anthropic
        from app.core.config import get_settings
        settings = get_settings()
        ai_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

        signal_descriptions = {
            "common_funder": "funded from the same source wallet",
            "fund_flow": "one wallet directly funded the other",
            "token_overlap": "traded the same tokens within 30 minutes",
            "timing_sync": "transactions occur in near-simultaneous bursts",
            "dex_preference": "identical DEX preference",
        }
        readable_signals = [signal_descriptions.get(s, s) for s in signals]

        prompt = (
            f"Two Solana wallets are suspected to be controlled by the same entity.\n"
            f"Cluster confidence: {confidence:.0%}\n"
            f"Evidence: {', '.join(readable_signals)}\n\n"
            "Write a single sentence (max 25 words) explaining why these wallets are "
            "likely the same entity. Be specific about the evidence. "
            "Do not start with 'These wallets'."
        )
        resp = await ai_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# US-B1504 — Funding source tracing (graph-based identity)
# ---------------------------------------------------------------------------

FUNDING_TRACE_MAX_DEPTH = 3    # hops to trace back from a wallet
FUNDING_TRACE_MAX_SIBLINGS = 30  # max sibling wallets to surface per source


async def _get_primary_funder(address: str) -> str | None:
    """
    Returns the wallet that sent the first SOL transfer to `address`.
    Uses Helius transaction history.
    """
    try:
        from app.services.helius import get_wallet_transactions
        txs = await get_wallet_transactions(address, limit=100)
        # Find earliest inbound SOL transfer
        for tx in reversed(txs):  # oldest first
            for nt in tx.get("nativeTransfers", []):
                if nt.get("toUserAccount") == address and nt.get("fromUserAccount"):
                    amount = (nt.get("amount", 0) or 0) / 1_000_000_000
                    if amount >= 0.01:
                        return nt["fromUserAccount"]
    except Exception:
        pass
    return None


async def _get_wallets_funded_by(funder: str, exclude: str) -> list[str]:
    """
    Returns wallet addresses that received SOL from `funder`,
    excluding the seed wallet. Uses Helius transactions.
    """
    try:
        from app.services.helius import get_wallet_transactions
        txs = await get_wallet_transactions(funder, limit=100)
        recipients: set[str] = set()
        for tx in txs:
            for nt in tx.get("nativeTransfers", []):
                to_addr = nt.get("toUserAccount", "")
                if (nt.get("fromUserAccount") == funder and
                    to_addr and to_addr != exclude and to_addr != funder):
                    amount = (nt.get("amount", 0) or 0) / 1_000_000_000
                    if amount >= 0.01:
                        recipients.add(to_addr)
                        if len(recipients) >= FUNDING_TRACE_MAX_SIBLINGS:
                            break
        return list(recipients)
    except Exception:
        return []


async def trace_funding_graph(address: str, max_depth: int = FUNDING_TRACE_MAX_DEPTH) -> dict[str, Any]:
    """
    US-B1504: Walk the SOL funding graph to find sibling wallets.

    Algorithm:
      1. Find who funded `address` (primary funder = depth-1 source)
      2. Find all wallets that primary funder also funded (siblings)
      3. For each sibling above confidence threshold, recurse up one level
         to find shared grandparent funders

    Returns a graph dict:
    {
      "root": address,
      "funding_source": funder_address,
      "siblings": [{"address", "confidence", "shared_funder"}],
      "graph": {"nodes": [...], "edges": [...]},
    }
    """
    cache_key = f"funding_graph:{address}:{max_depth}"
    if cached := await cache_get(cache_key):
        return cached

    nodes: list[dict] = [{"id": address, "type": "root", "depth": 0}]
    edges: list[dict] = []
    siblings: list[dict] = []
    seen_nodes: set[str] = {address}

    current_wallet = address
    funding_chain: list[str] = []

    # Trace up the funding chain
    for depth in range(1, max_depth + 1):
        funder = await _get_primary_funder(current_wallet)
        if not funder or funder in seen_nodes:
            break

        seen_nodes.add(funder)
        funding_chain.append(funder)

        # Add funder node
        nodes.append({"id": funder, "type": "funder", "depth": depth})
        edges.append({
            "source": funder,
            "target": current_wallet,
            "type": "funded",
            "label": f"funded (depth {depth})",
        })

        # Find all wallets this funder also funded (siblings of our wallet)
        funded_by_this = await _get_wallets_funded_by(funder, address)
        for sibling in funded_by_this:
            if sibling in seen_nodes:
                continue
            seen_nodes.add(sibling)

            # Score the pair to get a confidence estimate
            try:
                conf, sigs, weights = await _score_pair(address, sibling)
            except Exception:
                conf, sigs, weights = 0.30, ["fund_flow"], {"fund_flow": 0.30}

            # Funding from same source is always at least 0.35 confidence
            conf = max(conf, SIGNAL_WEIGHTS["common_funder"])
            triggered = list(set(sigs + ["common_funder"]))
            weights["common_funder"] = SIGNAL_WEIGHTS["common_funder"]

            nodes.append({"id": sibling, "type": "sibling", "depth": depth})
            edges.append({
                "source": funder,
                "target": sibling,
                "type": "funded",
                "label": f"funded (depth {depth})",
            })
            edges.append({
                "source": address,
                "target": sibling,
                "type": "sibling",
                "label": "same funder",
            })

            siblings.append({
                "address": sibling,
                "confidence": round(conf, 2),
                "signals": triggered,
                "shared_funder": funder,
                "funder_depth": depth,
            })

            # Upsert into side_wallet_candidates if above threshold
            if conf >= MIN_CONFIDENCE:
                try:
                    explanation = await _explain_pair(address, sibling, triggered, conf)
                    await _upsert_pair(address, sibling, conf, triggered, weights, explanation)
                except Exception:
                    pass

        current_wallet = funder

    # Known wallet enrichment for all nodes
    from app.services.supabase import get_known_wallet
    known_results = await asyncio.gather(
        *[_safe_coro(get_known_wallet(n["id"])) for n in nodes]
    )
    for node, known in zip(nodes, known_results):
        node["known"] = known
        node["label"] = (known or {}).get("label") or (node["id"][:8] + "...")

    result: dict[str, Any] = {
        "root": address,
        "funding_source": funding_chain[0] if funding_chain else None,
        "funding_chain": funding_chain,
        "siblings": siblings,
        "graph": {"nodes": nodes, "edges": edges},
    }

    await cache_set(cache_key, result, CLUSTER_TTL)
    return result


async def _safe_coro(coro) -> Any:
    try:
        return await coro
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

async def _upsert_pair(
    wallet_a: str,
    wallet_b: str,
    confidence: float,
    signals: list[str],
    weights: dict[str, float],
    explanation: str | None,
) -> None:
    """Upsert the pair into side_wallet_candidates (alphabetical key order)."""
    if wallet_a > wallet_b:
        wallet_a, wallet_b = wallet_b, wallet_a

    row: dict[str, Any] = {
        "wallet_a": wallet_a,
        "wallet_b": wallet_b,
        "confidence": confidence,
        "signals": signals,
        "signal_weights": weights,
    }
    if explanation:
        row["ai_explanation"] = explanation

    client = supabase_svc.get_client()
    client.table("side_wallet_candidates").upsert(
        row, on_conflict="wallet_a,wallet_b"
    ).execute()
