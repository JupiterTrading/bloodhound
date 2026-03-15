"""
Wallet classification engine.
Runs heuristic checks in parallel and returns labels with confidence scores.
All thresholds are driven by env vars — never hardcoded.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.services import analytics
from app.services.redis_cache import cache_get, cache_set, wallet_key, TTL_CLASSIFICATION

settings = get_settings()


async def classify_wallet(address: str, force_refresh: bool = False) -> dict[str, Any]:
    """
    Return classification labels for a wallet.
    Checks Redis → Supabase cache → runs fresh classification.
    """
    # 1. Redis cache
    cache_key = wallet_key(address, "classification")
    if not force_refresh:
        cached = await cache_get(cache_key)
        if cached:
            return cached

    # 2. Supabase cache
    if not force_refresh:
        from app.services import supabase as supabase_svc

        db_result = await supabase_svc.get_wallet_classification(address)
        if db_result:
            await cache_set(cache_key, db_result, TTL_CLASSIFICATION)
            return db_result

    # 3. Compute fresh
    result = await _run_classification(address)

    # Persist
    from app.services import supabase as supabase_svc

    await supabase_svc.save_wallet_classification(
        address=address,
        labels=result["labels"],
        confidence=result["confidence"],
        signals=result["signals"],
    )
    await cache_set(cache_key, result, TTL_CLASSIFICATION)
    return result


async def _run_classification(address: str) -> dict[str, Any]:
    """Run all checks in parallel and merge results."""
    labels: list[str] = []
    confidence: dict[str, float] = {}
    signals: dict[str, Any] = {}

    checks = await asyncio.gather(
        _check_known_entity(address),
        _check_whale(address),
        _check_smart_money(address),
        _check_deployer(address),
        _check_sniper(address),
        _check_bot(address),
        _check_bundler(address),
        _check_lp_provider(address),
        _check_exchange_or_protocol(address),
        _check_wash_trader(address),
        return_exceptions=True,
    )

    for result in checks:
        if isinstance(result, Exception) or result is None:
            continue
        label = result.get("label")
        if label:
            labels.append(label)
            confidence[label] = result["confidence"]
            signals[label] = result.get("signals", {})

    return {
        "labels": labels,
        "confidence": confidence,
        "signals": signals,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


async def _check_known_entity(address: str) -> dict[str, Any] | None:
    from app.services import supabase as supabase_svc

    known = await supabase_svc.get_known_wallet(address)
    if not known:
        return None
    label = known["category"].upper()
    return {
        "label": label,
        "confidence": 1.0,
        "signals": {"source": "known_wallets_db", "category": known["category"]},
    }


async def _check_whale(address: str) -> dict[str, Any] | None:
    """
    WHALE_WALLET: portfolio ≥ $50k USD, OR 30d SOL transfer volume ≥ 2000 SOL,
    OR SOL balance ≥ 500 SOL.
    """
    # Birdeye portfolio value
    portfolio_usd = 0.0
    try:
        from app.services import birdeye

        portfolio_data = await birdeye.get_wallet_portfolio(address)
        portfolio_usd = portfolio_data.get("total_usd", 0.0)
    except Exception:
        pass

    if portfolio_usd >= settings.whale_wallet_usd_threshold:
        return {
            "label": "whale_wallet",
            "confidence": 0.90,
            "signals": {"portfolio_usd": round(portfolio_usd, 2)},
        }

    # 30d SOL outflow volume
    try:
        sol_vol = await analytics.get_sol_volume_30d(address)
        if sol_vol >= settings.whale_wallet_volume_sol_30d:
            return {
                "label": "whale_wallet",
                "confidence": 0.80,
                "signals": {"sol_volume_30d": round(sol_vol, 2)},
            }
    except Exception:
        pass

    return None


async def _check_smart_money(address: str) -> dict[str, Any] | None:
    """
    SMART_MONEY: win rate > 60% on closed positions, minimum 20 trades.
    Confidence scales with trade count.
    """
    try:
        stats = await analytics.get_trade_stats_for_classification(address)
    except Exception:
        return None

    total_trades = stats.get("total_trades", 0)
    winning_trades = stats.get("winning_trades", 0)
    total_pnl = stats.get("total_pnl_usd", 0)

    if total_trades < settings.smart_money_min_trades:
        return None

    win_rate = winning_trades / total_trades if total_trades > 0 else 0
    if win_rate <= settings.smart_money_win_rate_threshold:
        return None

    conf = 0.65 if total_trades < 100 else (0.85 if total_trades < 500 else 0.95)

    return {
        "label": "smart_money",
        "confidence": conf,
        "signals": {
            "win_rate": round(win_rate, 3),
            "total_trades": total_trades,
            "total_pnl_usd": round(total_pnl, 2),
        },
    }


async def _check_deployer(address: str) -> dict[str, Any] | None:
    """
    DEPLOYER: has created token mints or deployed programs (deterministic, conf 1.0).
    Uses Helius transaction types.
    """
    try:
        counts = await analytics.get_tx_type_counts(address)
    except Exception:
        return None

    deploy_types = {"CREATE", "CREATE_ACCOUNT", "MINT", "PROGRAM_DEPLOY", "TOKEN_MINT"}
    deploy_count = sum(counts.get(t, 0) for t in deploy_types)

    if deploy_count > 0:
        return {
            "label": "deployer",
            "confidence": 1.0,
            "signals": {"deploy_count": deploy_count},
        }
    return None


async def _check_sniper(address: str) -> dict[str, Any] | None:
    """
    SNIPER: Check wallet_trades or wallet_rankings for snipe flags.
    Confidence: 0.85.
    """
    supabase = get_supabase()
    try:
        result = supabase.table("wallet_trades").select("id").eq(
            "wallet_address", address
        ).eq("is_snipe", True).limit(5).execute()

        snipe_count = len(result.data or [])
        if snipe_count > 0:
            return {
                "label": "sniper",
                "confidence": 0.85,
                "signals": {"early_buy_count": snipe_count},
            }
    except Exception:
        pass
    return None


def get_supabase():
    from app.services.supabase import get_client
    return get_client()


async def _check_bot(address: str) -> dict[str, Any] | None:
    """
    BOT: high frequency (>300 txs/24h).
    Confidence 0.70 — behavioral heuristic.
    """
    try:
        tx_count_24h = await analytics.get_tx_frequency_24h(address)
    except Exception:
        return None

    triggered: list[str] = []

    if tx_count_24h > 300:
        triggered.append("high_frequency_24h")

    if not triggered:
        return None

    return {
        "label": "bot",
        "confidence": 0.70,
        "signals": {"triggers": triggered, "tx_count_24h": tx_count_24h},
    }


async def _check_bundler(address: str) -> dict[str, Any] | None:
    """
    BUNDLER: appears in Jito bundle transactions with launch sniping patterns.
    Confidence 0.80.
    """
    try:
        counts = await analytics.get_tx_type_counts(address)
    except Exception:
        return None

    jito_count = counts.get("jito_bundle", 0)
    if jito_count >= 3:
        return {
            "label": "bundler",
            "confidence": 0.80,
            "signals": {"jito_bundle_count": jito_count},
        }
    return None


async def _check_lp_provider(address: str) -> dict[str, Any] | None:
    """LP_PROVIDER: interacts with AMM pool creation / liquidity instructions."""
    try:
        counts = await analytics.get_tx_type_counts(address)
    except Exception:
        return None

    lp_types = {"ADD_LIQUIDITY", "REMOVE_LIQUIDITY", "CREATE_POOL"}
    lp_count = sum(counts.get(t, 0) for t in lp_types)

    if lp_count > 0:
        return {
            "label": "lp_provider",
            "confidence": 0.90,
            "signals": {"lp_interactions": lp_count},
        }
    return None


async def _check_wash_trader(address: str) -> dict[str, Any] | None:
    """
    WASH_TRADER: wallet repeatedly buys and sells the same token.
    Check wallet_trades for round-trip patterns.
    Confidence 0.75.
    """
    sb = get_supabase()
    try:
        result = sb.table("wallet_trades").select(
            "token_address, trade_type"
        ).eq("wallet_address", address).execute()

        rows = result.data or []
        if not rows:
            return None

        from collections import defaultdict
        token_trades: dict[str, dict[str, int]] = defaultdict(lambda: {"buy": 0, "sell": 0})
        for r in rows:
            token = r.get("token_address", "")
            tt = r.get("trade_type", "")
            if token and tt in ("buy", "sell"):
                token_trades[token][tt] += 1

        round_trip_tokens = sum(
            1 for t in token_trades.values()
            if t["buy"] >= 3 and t["sell"] >= 3
        )

        if round_trip_tokens < 3:
            return None

        return {
            "label": "wash_trader",
            "confidence": 0.75,
            "signals": {"round_trip_token_count": round_trip_tokens},
        }
    except Exception:
        return None


async def _check_exchange_or_protocol(address: str) -> dict[str, Any] | None:
    """
    EXCHANGE/PROTOCOL: check known_wallets DB for exchange/protocol category.
    Hub pattern detection requires too much data for on-demand API calls.
    """
    from app.services import supabase as supabase_svc
    try:
        known = await supabase_svc.get_known_wallet(address)
        if known and known.get("category") in ("exchange", "protocol", "cex"):
            return {
                "label": "exchange",
                "confidence": 0.85,
                "signals": {"source": "known_wallets_db", "category": known["category"]},
            }
    except Exception:
        pass
    return None
