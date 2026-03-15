"""
Background worker for backfilling KOL trade history.

This worker runs continuously in the background, systematically fetching
historical trade data for all KOLs in the wallet_rankings table and storing
it in wallet_trades for fast access.

Strategy:
1. Priority queue: Top KOLs by tier and PnL get backfilled first
2. Incremental backfill: Fetch recent trades first, then go back in time
3. Rate limiting: Respect API limits (Helius: 100 req/s, GMGN: varies)
4. Checkpointing: Track progress in backfill_status table
5. Smart scheduling: Backfill during low-traffic hours, pause during peak
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.services.supabase import get_client
from app.services.helius import get_wallet_transactions
from app.services.redis_cache import cache_get, cache_set

logger = logging.getLogger(__name__)


class BackfillWorker:
    def __init__(self):
        self.sb = get_client()
        self.is_running = False
        self.current_wallet = None
        self.stats = {
            "wallets_processed": 0,
            "trades_inserted": 0,
            "errors": 0,
            "started_at": None,
        }

    async def start(self):
        """Start the backfill worker."""
        if self.is_running:
            logger.warning("[backfill] Worker already running")
            return

        self.is_running = True
        self.stats["started_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("[backfill] Starting background worker")

        try:
            await self._run_backfill_loop()
        except Exception as e:
            logger.error(f"[backfill] Worker crashed: {e}", exc_info=True)
            self.is_running = False

    async def stop(self):
        """Stop the backfill worker gracefully."""
        logger.info("[backfill] Stopping worker...")
        self.is_running = False

    async def _run_backfill_loop(self):
        """Main backfill loop - processes wallets in priority order."""
        while self.is_running:
            try:
                # Get next wallet to backfill
                wallet = await self._get_next_wallet()
                if not wallet:
                    logger.info("[backfill] No more wallets to backfill, sleeping 1h")
                    await asyncio.sleep(3600)
                    continue

                self.current_wallet = wallet["address"]
                logger.info(
                    f"[backfill] Processing {wallet['address'][:8]}... "
                    f"(tier={wallet.get('tier')}, pnl={wallet.get('total_pnl_usd')})"
                )

                # Backfill this wallet's trades
                await self._backfill_wallet(wallet)
                self.stats["wallets_processed"] += 1

                # Rate limiting: 10 wallets/minute = 6s between wallets
                await asyncio.sleep(6)

            except Exception as e:
                logger.error(f"[backfill] Error processing wallet: {e}", exc_info=True)
                self.stats["errors"] += 1
                await asyncio.sleep(30)

    async def _get_next_wallet(self) -> Optional[dict]:
        """
        Get next wallet to backfill, prioritized by:
        1. Tier (legendary > elite > pro > rising > standard)
        2. Total PnL (highest first)
        3. Not yet backfilled or backfill incomplete
        """
        try:
            # Check backfill_status to find wallets that need work
            result = self.sb.table("wallet_rankings").select(
                "address, tier, total_pnl_usd, label"
            ).is_("backfill_status", None).or_(
                "backfill_status.eq.pending,backfill_status.eq.partial"
            ).order("tier").order("total_pnl_usd", desc=True).limit(1).execute()

            if result.data:
                return result.data[0]
            return None

        except Exception as e:
            logger.error(f"[backfill] Error getting next wallet: {e}")
            return None

    async def _backfill_wallet(self, wallet: dict):
        """
        Backfill trade history for a single wallet.
        
        Strategy:
        1. Check what we already have in wallet_trades
        2. Fetch missing data from Helius (last 30 days) or GMGN (all time)
        3. Parse and insert trades
        4. Update backfill_status
        """
        address = wallet["address"]
        
        try:
            # Check existing trades
            existing = self.sb.table("wallet_trades").select(
                "block_time"
            ).eq("wallet_address", address).order(
                "block_time", desc=True
            ).limit(1).execute()

            last_trade_time = None
            if existing.data:
                last_trade_time = existing.data[0]["block_time"]
                logger.info(f"[backfill] {address[:8]}... has trades up to {last_trade_time}")

            # Fetch trades from Helius (last 30 days)
            trades = await self._fetch_trades_helius(address, last_trade_time)
            
            if trades:
                # Insert trades in batches
                inserted = await self._insert_trades_batch(trades)
                self.stats["trades_inserted"] += inserted
                logger.info(f"[backfill] Inserted {inserted} trades for {address[:8]}...")

                # Update backfill status
                await self._update_backfill_status(address, "complete", len(trades))
            else:
                # No trades found - mark as complete anyway
                await self._update_backfill_status(address, "complete", 0)

        except Exception as e:
            logger.error(f"[backfill] Error backfilling {address}: {e}")
            await self._update_backfill_status(address, "error", 0, str(e))
            raise

    async def _fetch_trades_helius(
        self, address: str, since: Optional[str] = None
    ) -> list[dict]:
        """
        Fetch trades from Helius API.
        
        Helius provides transaction history with parsed swap data.
        We'll fetch the last 30 days or since last known trade.
        """
        try:
            # Calculate time range
            end_time = datetime.now(timezone.utc)
            if since:
                start_time = datetime.fromisoformat(since.replace("Z", "+00:00"))
            else:
                start_time = end_time - timedelta(days=30)

            # Fetch transactions from Helius
            txs = await get_wallet_transactions(
                address,
                limit=1000,
                before=None,
                until=int(start_time.timestamp())
            )

            # Parse swaps from transactions
            trades = []
            for tx in txs:
                # Look for swap instructions
                if tx.get("type") == "SWAP":
                    trade = self._parse_swap_transaction(tx, address)
                    if trade:
                        trades.append(trade)

            logger.info(f"[backfill] Fetched {len(trades)} trades from Helius for {address[:8]}...")
            return trades

        except Exception as e:
            logger.error(f"[backfill] Helius fetch error for {address}: {e}")
            return []

    def _parse_swap_transaction(self, tx: dict, wallet_address: str) -> Optional[dict]:
        """Parse a Helius transaction into a wallet_trade record."""
        try:
            # Extract swap data from Helius transaction format
            # This is a simplified parser - real implementation needs to handle
            # various DEX formats (Raydium, Orca, Jupiter, etc.)
            
            token_transfers = tx.get("tokenTransfers", [])
            if len(token_transfers) < 2:
                return None

            # Determine buy/sell based on SOL flow
            trade_type = "buy"  # Default
            token_in = None
            token_out = None
            amount_in = 0
            amount_out = 0

            for transfer in token_transfers:
                if transfer.get("fromUserAccount") == wallet_address:
                    token_in = transfer.get("mint")
                    amount_in = transfer.get("tokenAmount", 0)
                elif transfer.get("toUserAccount") == wallet_address:
                    token_out = transfer.get("mint")
                    amount_out = transfer.get("tokenAmount", 0)

            # If selling token for SOL, it's a sell
            if token_in and token_in != "So11111111111111111111111111111111111111112":
                trade_type = "sell"

            return {
                "tx_signature": tx.get("signature"),
                "block_time": datetime.fromtimestamp(
                    tx.get("timestamp", 0), tz=timezone.utc
                ).isoformat(),
                "wallet_address": wallet_address,
                "token_address": token_out if trade_type == "buy" else token_in,
                "token_symbol": None,  # Will be enriched later
                "trade_type": trade_type,
                "amount_sol": amount_in if trade_type == "buy" else amount_out,
                "amount_usd": 0,  # Will be calculated from price
                "dex": tx.get("source", "unknown"),
                "is_snipe": False,  # Will be calculated
                "is_early": False,  # Will be calculated
            }

        except Exception as e:
            logger.error(f"[backfill] Error parsing transaction: {e}")
            return None

    async def _insert_trades_batch(self, trades: list[dict]) -> int:
        """Insert trades in batches to avoid overwhelming Supabase."""
        batch_size = 100
        inserted = 0

        for i in range(0, len(trades), batch_size):
            batch = trades[i:i + batch_size]
            try:
                result = self.sb.table("wallet_trades").insert(batch).execute()
                inserted += len(result.data) if result.data else 0
            except Exception as e:
                logger.error(f"[backfill] Batch insert error: {e}")
                # Try inserting one by one to find problematic records
                for trade in batch:
                    try:
                        self.sb.table("wallet_trades").insert(trade).execute()
                        inserted += 1
                    except Exception as e2:
                        logger.error(f"[backfill] Failed to insert trade {trade.get('tx_signature')}: {e2}")

        return inserted

    async def _update_backfill_status(
        self, address: str, status: str, trade_count: int, error: Optional[str] = None
    ):
        """Update backfill status in wallet_rankings."""
        try:
            self.sb.table("wallet_rankings").update({
                "backfill_status": status,
                "backfill_last_run": datetime.now(timezone.utc).isoformat(),
                "backfill_trade_count": trade_count,
                "backfill_error": error,
            }).eq("address", address).execute()
        except Exception as e:
            logger.error(f"[backfill] Error updating status for {address}: {e}")

    def get_stats(self) -> dict:
        """Get current worker statistics."""
        return {
            **self.stats,
            "is_running": self.is_running,
            "current_wallet": self.current_wallet,
        }


# Global worker instance
_worker: Optional[BackfillWorker] = None


async def start_backfill_worker():
    """Start the global backfill worker."""
    global _worker
    if _worker is None:
        _worker = BackfillWorker()
    await _worker.start()


async def stop_backfill_worker():
    """Stop the global backfill worker."""
    global _worker
    if _worker:
        await _worker.stop()


def get_backfill_stats() -> dict:
    """Get backfill worker statistics."""
    global _worker
    if _worker:
        return _worker.get_stats()
    return {"is_running": False}
