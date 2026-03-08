"""
Wallet activity poller — periodic Helius API calls for user-tracked wallets.

Supplements the Helius webhook (25-address plan limit on free/starter) by
polling all user-tracked wallets every POLL_INTERVAL seconds.
ClickHouse ReplacingMergeTree deduplicates on tx_signature — safe to re-ingest.

Flow per sweep:
  1. Fetch all distinct tracked wallet addresses from Supabase
  2. For each: Helius getWalletTransactions (last 10 txs)
  3. Parse → USD-enrich → write to ClickHouse
  4. Run signal detection on new transfers → write signals to ClickHouse
  5. Sleep POLL_INTERVAL, repeat
"""

import asyncio
from typing import Any

from app.services.helius import get_wallet_transactions, fetch_full_history
from app.services.ingestion import parse_helius_transaction, enrich_with_prices
from app.services.jupiter import get_prices_batch
from app.services import clickhouse
from app.services.signals import detect_signals

POLL_INTERVAL = 300    # seconds between full sweeps (5 min)
POLL_BATCH_SIZE = 5    # concurrent wallets per batch (Helius rate limit friendly)
TXS_PER_WALLET = 10   # recent txs fetched per wallet per sweep
BATCH_DELAY = 1.0     # seconds between batches
BACKFILL_CAP = 1000   # max txs to backfill per wallet (10 pages × 100)


async def _process_tx_batch(
    txs: list[dict],
    wallet_address: str,
    run_signals: bool = True,
) -> int:
    """
    Parse, USD-enrich, write to ClickHouse, and optionally run signal detection
    on a batch of raw Helius transactions. Returns the number of tx rows written.
    """
    tx_rows: list[dict] = []
    transfer_rows: list[dict] = []
    trade_rows: list[dict] = []

    for tx in txs:
        try:
            parsed = parse_helius_transaction(tx)
            tx_rows.append(parsed["transaction"])
            transfer_rows.extend(parsed["transfers"])
            trade_rows.extend(parsed["trades"])
        except Exception as e:
            print(f"[poller] parse error {wallet_address[:8]}...: {e}")

    if not tx_rows:
        return 0

    # USD enrichment — one Jupiter batch call per wallet batch
    unique_mints = list({
        *(t["token_mint"] for t in transfer_rows if t.get("token_mint")),
        *(t["token_out_mint"] for t in trade_rows if t.get("token_out_mint")),
        *(t["token_in_mint"] for t in trade_rows if t.get("token_in_mint")),
    })
    prices = await get_prices_batch(unique_mints)
    enrich_with_prices(transfer_rows, trade_rows, prices)

    await clickhouse.insert_transactions(tx_rows)
    await clickhouse.insert_transfers(transfer_rows)
    await clickhouse.insert_trades(trade_rows)

    # Signal detection on this batch
    signals: list[dict] = []
    if run_signals and transfer_rows:
        try:
            signals = await detect_signals(transfer_rows, wallet_address)
            if signals:
                await clickhouse.insert_signals(signals)
                print(f"[poller] {len(signals)} signals detected for {wallet_address[:8]}...")
        except Exception as e:
            print(f"[poller] signal detection error {wallet_address[:8]}...: {e}")

    # Event detection — runs in background, non-blocking
    # Checks if signals warrant a new entry in known_events (AI + web search)
    if run_signals and signals:
        try:
            from app.services.event_detector import maybe_detect_event
            asyncio.create_task(maybe_detect_event(signals, transfer_rows, wallet_address))
        except Exception:
            pass

    # Identity clustering — runs in background, non-blocking
    # Finds behavioral matches and upserts side_wallet_candidates
    if run_signals:
        try:
            from app.services.clustering import run_clustering_for_wallet
            asyncio.create_task(run_clustering_for_wallet(wallet_address))
        except Exception:
            pass

    return len(tx_rows)


async def _poll_wallet(address: str) -> int:
    """Fetch and ingest recent transactions for one wallet."""
    try:
        txs = await get_wallet_transactions(address, limit=TXS_PER_WALLET)
        if not txs:
            return 0
        return await _process_tx_batch(txs, address, run_signals=True)
    except Exception as e:
        print(f"[poller] error {address[:8]}...: {e}")
        return 0


async def poll_once(addresses: list[str]) -> None:
    """Poll all addresses in small batches to stay within Helius rate limits."""
    total_txs = 0
    for i in range(0, len(addresses), POLL_BATCH_SIZE):
        batch = addresses[i : i + POLL_BATCH_SIZE]
        counts = await asyncio.gather(*[_poll_wallet(a) for a in batch])
        total_txs += sum(counts)
        if i + POLL_BATCH_SIZE < len(addresses):
            await asyncio.sleep(BATCH_DELAY)

    if total_txs:
        print(f"[poller] swept {len(addresses)} wallets — {total_txs} txs ingested")


async def backfill_wallet(address: str) -> None:
    """
    US-B405: Pull full transaction history for a wallet from Helius and write
    to ClickHouse. Called once when a user first tracks a wallet.
    Capped at BACKFILL_CAP transactions to stay within rate limits.
    Signal detection is skipped for backfills (historical noise).
    """
    print(f"[backfill] starting for {address[:8]}...")
    try:
        all_txs: list[dict[str, Any]] = []
        before: str | None = None

        while len(all_txs) < BACKFILL_CAP:
            batch = await get_wallet_transactions(address, before=before, limit=100)
            if not batch:
                break
            all_txs.extend(batch)
            before = batch[-1].get("signature")
            if len(batch) < 100:
                break
            await asyncio.sleep(0.15)  # gentle on Helius rate limit

        if not all_txs:
            print(f"[backfill] no history found for {address[:8]}...")
            return

        # Process in chunks of 100 so we don't hold huge lists in memory
        total = 0
        for i in range(0, len(all_txs), 100):
            chunk = all_txs[i : i + 100]
            total += await _process_tx_batch(chunk, address, run_signals=False)
            await asyncio.sleep(0.1)

        print(f"[backfill] {address[:8]}... complete — {total} txs written")

    except Exception as e:
        print(f"[backfill] error {address[:8]}...: {e}")


async def backfill_wallet_and_sides(address: str, side_limit: int = 5) -> None:
    """
    On-demand full intelligence fetch: backfill tx history, run clustering to
    detect side wallets, then backfill those side wallets too.
    Called when any wallet is first searched or queried via AI.
    """
    # Step 1: backfill the primary wallet
    await backfill_wallet(address)

    # Step 2: run clustering now that ClickHouse has data
    try:
        from app.services.clustering import run_clustering_for_wallet
        await run_clustering_for_wallet(address)
    except Exception as e:
        print(f"[backfill] clustering error for {address[:8]}...: {e}")
        return

    # Step 3: backfill top side wallet candidates
    try:
        from app.services import supabase as _sb
        from app.services.redis_cache import cache_get as _cg, cache_set as _cs
        candidates = await _sb.get_side_wallet_candidates(address, min_confidence=0.45)
        for c in candidates[:side_limit]:
            side_addr = c["related_address"]
            bfk = f"bh:backfill:{side_addr}"
            if not await _cg(bfk):
                await _cs(bfk, 1, 86400)
                print(f"[backfill] side wallet {side_addr[:8]}... queued")
                await backfill_wallet(side_addr)
    except Exception as e:
        print(f"[backfill] side wallet error for {address[:8]}...: {e}")


async def run_poller() -> None:
    """
    Background polling loop. Started in FastAPI lifespan, cancelled on shutdown.
    """
    print(f"[poller] starting — interval {POLL_INTERVAL}s, batch {POLL_BATCH_SIZE}")
    while True:
        try:
            from app.services.supabase import get_all_tracked_wallet_addresses
            addresses = await get_all_tracked_wallet_addresses()
            if addresses:
                await poll_once(addresses)
        except asyncio.CancelledError:
            print("[poller] shutting down")
            break
        except Exception as e:
            print(f"[poller] sweep error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
