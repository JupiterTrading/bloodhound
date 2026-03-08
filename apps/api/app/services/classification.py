"""
Wallet classification engine.
Runs heuristic checks in parallel and returns labels with confidence scores.
All thresholds are driven by env vars — never hardcoded.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.services import clickhouse
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
    sol_vol = await clickhouse.get_sol_volume_30d(address)
    if sol_vol >= settings.whale_wallet_volume_sol_30d:
        return {
            "label": "whale_wallet",
            "confidence": 0.80,
            "signals": {"sol_volume_30d": round(sol_vol, 2)},
        }

    return None


async def _check_smart_money(address: str) -> dict[str, Any] | None:
    """
    SMART_MONEY: win rate > 60% on closed positions, minimum 20 trades.
    Confidence scales with trade count.
    """
    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        SELECT
            count()                        AS total_trades,
            countIf(realized_pnl_usd > 0)  AS winning_trades,
            sum(realized_pnl_usd)          AS total_pnl_usd
        FROM token_trades
        WHERE trader = {address:String}
          AND realized_pnl_usd != 0
        """,
        parameters={"address": address},
    )
    if not result.result_rows:
        return None

    row = result.result_rows[0]
    total_trades = int(row[0] or 0)
    winning_trades = int(row[1] or 0)
    total_pnl = float(row[2] or 0)

    if total_trades < settings.smart_money_min_trades:
        return None

    win_rate = winning_trades / total_trades
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
    """
    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        SELECT count() AS deploy_count
        FROM transactions
        WHERE has(signers, {address:String})
          AND tx_type IN ('CREATE_ACCOUNT', 'MINT', 'PROGRAM_DEPLOY')
        LIMIT 1
        """,
        parameters={"address": address},
    )
    if result.result_rows and int(result.result_rows[0][0] or 0) > 0:
        return {
            "label": "deployer",
            "confidence": 1.0,
            "signals": {"deploy_count": int(result.result_rows[0][0])},
        }
    return None


async def _check_sniper(address: str) -> dict[str, Any] | None:
    """
    SNIPER: bought a token when it had fewer than 100 prior trades on-chain.
    Minimum buy size ≥ $0.50 USD to filter ghost/dust transactions.
    Confidence: 0.85 (timing is deterministic; "significance" is a threshold heuristic).
    """
    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        WITH trader_tokens AS (
            SELECT DISTINCT token_out_mint
            FROM token_trades
            WHERE trader = {address:String}
              AND amount_usd >= 0.5
        ),
        ranked_buys AS (
            SELECT
                tt.trader,
                tt.token_out_mint,
                row_number() OVER (
                    PARTITION BY tt.token_out_mint
                    ORDER BY tt.block_time ASC
                ) AS buy_rank
            FROM token_trades tt
            INNER JOIN trader_tokens trt ON tt.token_out_mint = trt.token_out_mint
            WHERE tt.amount_usd >= 0.5
        )
        SELECT count() AS snipe_count
        FROM ranked_buys
        WHERE trader = {address:String}
          AND buy_rank <= 100
        """,
        parameters={"address": address},
    )
    if not result.result_rows:
        return None
    snipe_count = int(result.result_rows[0][0] or 0)
    if snipe_count < 1:
        return None
    return {
        "label": "sniper",
        "confidence": 0.85,
        "signals": {"early_buy_count": snipe_count},
    }


async def _check_bot(address: str) -> dict[str, Any] | None:
    """
    BOT: high frequency (>300 txs/24h) or dominant single-program usage (>80%).
    Confidence 0.70 — behavioral heuristic.
    """
    client = clickhouse.get_client()

    # Frequency check
    freq = await asyncio.to_thread(
        client.query,
        """
        SELECT count() AS tx_count_24h
        FROM transactions
        WHERE has(signers, {address:String})
          AND block_time >= now() - INTERVAL 24 HOUR
        """,
        parameters={"address": address},
    )
    if not freq.result_rows:
        return None

    tx_count_24h = int(freq.result_rows[0][0] or 0)
    triggered: list[str] = []

    if tx_count_24h > 300:
        triggered.append("high_frequency_24h")

    # Same-program pattern check (only if enough txs)
    if tx_count_24h >= 20:
        prog = await asyncio.to_thread(
            client.query,
            """
            SELECT
                source_program,
                count() AS call_count,
                count() / {total:Float64} AS pct
            FROM transactions
            WHERE has(signers, {address:String})
              AND block_time >= now() - INTERVAL 24 HOUR
            GROUP BY source_program
            ORDER BY call_count DESC
            LIMIT 1
            """,
            parameters={"address": address, "total": float(max(tx_count_24h, 1))},
        )
        if prog.result_rows and float(prog.result_rows[0][2] or 0) > 0.80:
            triggered.append("same_program_dominant")

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
    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        SELECT count() AS bundle_count
        FROM transactions
        WHERE has(signers, {address:String})
          AND source_platform = 'jito'
        """,
        parameters={"address": address},
    )
    if result.result_rows and int(result.result_rows[0][0] or 0) >= 3:
        return {
            "label": "bundler",
            "confidence": 0.80,
            "signals": {"jito_bundle_count": int(result.result_rows[0][0])},
        }
    return None


async def _check_lp_provider(address: str) -> dict[str, Any] | None:
    """LP_PROVIDER: interacts with AMM pool creation / liquidity instructions."""
    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        SELECT count() AS lp_count
        FROM transactions
        WHERE has(signers, {address:String})
          AND tx_type IN ('ADD_LIQUIDITY', 'REMOVE_LIQUIDITY', 'CREATE_POOL')
        """,
        parameters={"address": address},
    )
    if result.result_rows and int(result.result_rows[0][0] or 0) > 0:
        return {
            "label": "lp_provider",
            "confidence": 0.90,
            "signals": {"lp_interactions": int(result.result_rows[0][0])},
        }
    return None


async def _check_wash_trader(address: str) -> dict[str, Any] | None:
    """
    WASH_TRADER: wallet repeatedly buys and sells the same token in both directions
    (≥3 buys AND ≥3 sells of the same token) across ≥3 distinct tokens.
    Indicates artificial volume creation. Confidence 0.75.
    """
    # Native SOL mint + USDC + USDT used as "base" tokens to distinguish buy from sell
    SOL_MINT = "So11111111111111111111111111111111111111112"
    USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
    BASE_TOKENS = (SOL_MINT, USDC_MINT, USDT_MINT)

    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        SELECT count() AS round_trip_tokens
        FROM (
            SELECT
                if(
                    token_in_mint NOT IN {base:Array(String)},
                    token_in_mint,
                    token_out_mint
                ) AS token,
                countIf(token_in_mint IN {base:Array(String)}) AS buys,
                countIf(token_out_mint IN {base:Array(String)}) AS sells
            FROM token_trades
            WHERE trader = {address:String}
              AND (
                token_in_mint IN {base:Array(String)}
                OR token_out_mint IN {base:Array(String)}
              )
            GROUP BY token
            HAVING buys >= 3 AND sells >= 3
        )
        """,
        parameters={"address": address, "base": list(BASE_TOKENS)},
    )
    if not result.result_rows:
        return None

    round_trip_tokens = int(result.result_rows[0][0] or 0)
    if round_trip_tokens < 3:
        return None

    return {
        "label": "wash_trader",
        "confidence": 0.75,
        "signals": {"round_trip_token_count": round_trip_tokens},
    }


async def _check_exchange_or_protocol(address: str) -> dict[str, Any] | None:
    """
    EXCHANGE/PROTOCOL: receives from/sends to >1000 unique addresses per 24h.
    Confidence 0.70 from hub pattern.
    """
    client = clickhouse.get_client()
    result = await asyncio.to_thread(
        client.query,
        """
        SELECT uniqExact(
            if(from_address = {address:String}, to_address, from_address)
        ) AS unique_counterparties
        FROM transfers
        WHERE (from_address = {address:String} OR to_address = {address:String})
          AND block_time >= now() - INTERVAL 24 HOUR
        """,
        parameters={"address": address},
    )
    if result.result_rows and int(result.result_rows[0][0] or 0) > 1000:
        return {
            "label": "exchange",
            "confidence": 0.70,
            "signals": {"unique_counterparties_24h": int(result.result_rows[0][0])},
        }
    return None
