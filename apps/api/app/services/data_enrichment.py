"""
Smart data enrichment service - hybrid approach.

This service implements a multi-tier data loading strategy:
1. **Instant**: Return cached data from Supabase (historical trades, rankings)
2. **Fast**: Enrich with Redis-cached live data (recent prices, volumes)
3. **Fresh**: Fetch missing/stale data from external APIs on-demand
4. **Background**: Queue expensive lookups for async processing

Used by:
- Wallet detail pages (show cached trades instantly, enrich with live data)
- Leaderboard (show DB rankings, enrich top 10 with live metrics)
- AI agent (use cached data for speed, fetch fresh for critical queries)
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Any

from app.core.config import settings
from app.services.supabase import get_client
from app.services.redis_cache import cache_get, cache_set
from app.services.helius import get_wallet_transactions, get_token_price
from app.services.birdeye import get_token_overview

logger = logging.getLogger(__name__)


class DataEnrichmentService:
    """
    Smart data enrichment with progressive loading.
    
    Philosophy:
    - Never make users wait for fresh data if cached data exists
    - Show something immediately, improve it progressively
    - Prioritize user-facing requests over background tasks
    - Cache aggressively, invalidate intelligently
    """

    def __init__(self):
        self.sb = get_client()

    async def get_wallet_trades(
        self,
        address: str,
        limit: int = 50,
        force_fresh: bool = False
    ) -> dict[str, Any]:
        """
        Get wallet trades with progressive enrichment.
        
        Returns:
        {
            "trades": [...],           # Immediate from DB
            "count": 123,
            "has_cached": true,
            "is_enriching": false,     # True if background enrichment queued
            "last_updated": "2024-..."
        }
        """
        cache_key = f"wallet_trades:{address}:{limit}"
        
        # Layer 1: Check Redis cache (sub-millisecond)
        if not force_fresh:
            cached = await cache_get(cache_key)
            if cached:
                logger.info(f"[enrich] Cache HIT for {address[:8]}... trades")
                return {**cached, "source": "cache"}

        # Layer 2: Get from Supabase (fast, ~10-50ms)
        try:
            result = self.sb.table("wallet_trades").select(
                "tx_signature, block_time, wallet_address, token_address, "
                "token_symbol, trade_type, amount_sol, amount_usd, pnl_sol, "
                "dex, is_snipe, is_early"
            ).eq("wallet_address", address).order(
                "block_time", desc=True
            ).limit(limit).execute()

            trades = result.data or []
            
            # Check if we have recent data
            has_recent = False
            if trades:
                latest = datetime.fromisoformat(trades[0]["block_time"].replace("Z", "+00:00"))
                age_minutes = (datetime.now(timezone.utc) - latest).total_seconds() / 60
                has_recent = age_minutes < 5  # Data less than 5 minutes old

            response = {
                "trades": trades,
                "count": len(trades),
                "has_cached": len(trades) > 0,
                "is_enriching": False,
                "last_updated": trades[0]["block_time"] if trades else None,
                "source": "database"
            }

            # Layer 3: If data is stale or missing, queue background refresh
            if not has_recent or len(trades) == 0:
                logger.info(f"[enrich] Queueing background refresh for {address[:8]}...")
                asyncio.create_task(self._enrich_wallet_trades_background(address))
                response["is_enriching"] = True

            # Cache the response
            await cache_set(cache_key, response, ttl=300)  # 5 min cache
            return response

        except Exception as e:
            logger.error(f"[enrich] Error fetching trades for {address}: {e}")
            return {
                "trades": [],
                "count": 0,
                "has_cached": False,
                "is_enriching": False,
                "error": str(e),
                "source": "error"
            }

    async def _enrich_wallet_trades_background(self, address: str):
        """
        Background task to fetch fresh trades from Helius and update DB.
        This runs async and doesn't block the user request.
        """
        try:
            logger.info(f"[enrich] Background enrichment started for {address[:8]}...")
            
            # Get latest trade we have
            existing = self.sb.table("wallet_trades").select(
                "block_time"
            ).eq("wallet_address", address).order(
                "block_time", desc=True
            ).limit(1).execute()

            since = None
            if existing.data:
                since = existing.data[0]["block_time"]

            # Fetch recent transactions from Helius
            txs = await get_wallet_transactions(address, limit=100)
            
            # Parse and insert new trades
            new_trades = []
            for tx in txs:
                if tx.get("type") == "SWAP":
                    trade = self._parse_swap(tx, address)
                    if trade and (not since or trade["block_time"] > since):
                        new_trades.append(trade)

            if new_trades:
                # Insert in batches
                for i in range(0, len(new_trades), 50):
                    batch = new_trades[i:i+50]
                    self.sb.table("wallet_trades").insert(batch).execute()
                
                logger.info(f"[enrich] Inserted {len(new_trades)} new trades for {address[:8]}...")
                
                # Invalidate cache
                cache_key = f"wallet_trades:{address}:*"
                # Note: Redis doesn't support wildcard delete in basic cache_get/set
                # In production, use Redis SCAN or tag-based invalidation

        except Exception as e:
            logger.error(f"[enrich] Background enrichment failed for {address}: {e}")

    def _parse_swap(self, tx: dict, wallet_address: str) -> Optional[dict]:
        """Parse Helius transaction into trade record."""
        try:
            token_transfers = tx.get("tokenTransfers", [])
            if len(token_transfers) < 2:
                return None

            # Simplified swap parsing
            trade_type = "buy"
            token_address = None
            amount_sol = 0
            
            for transfer in token_transfers:
                if transfer.get("fromUserAccount") == wallet_address:
                    if transfer.get("mint") == "So11111111111111111111111111111111111111112":
                        trade_type = "buy"
                        amount_sol = transfer.get("tokenAmount", 0)
                    else:
                        trade_type = "sell"
                        token_address = transfer.get("mint")
                elif transfer.get("toUserAccount") == wallet_address:
                    if transfer.get("mint") != "So11111111111111111111111111111111111111112":
                        token_address = transfer.get("mint")

            if not token_address:
                return None

            return {
                "tx_signature": tx.get("signature"),
                "block_time": datetime.fromtimestamp(
                    tx.get("timestamp", 0), tz=timezone.utc
                ).isoformat(),
                "wallet_address": wallet_address,
                "token_address": token_address,
                "token_symbol": None,
                "trade_type": trade_type,
                "amount_sol": amount_sol,
                "amount_usd": 0,
                "dex": tx.get("source", "unknown"),
                "is_snipe": False,
                "is_early": False,
            }

        except Exception as e:
            logger.error(f"[enrich] Error parsing swap: {e}")
            return None

    async def get_wallet_metrics(
        self,
        address: str,
        force_fresh: bool = False
    ) -> dict[str, Any]:
        """
        Get wallet performance metrics with smart caching.
        
        Returns aggregated metrics like PnL, win rate, trade count.
        Uses DB for historical data, live API for recent performance.
        """
        cache_key = f"wallet_metrics:{address}"
        
        # Check cache first
        if not force_fresh:
            cached = await cache_get(cache_key)
            if cached:
                return {**cached, "source": "cache"}

        try:
            # Get from wallet_rankings (fast)
            ranking = self.sb.table("wallet_rankings").select(
                "total_pnl_sol, total_pnl_usd, win_rate, total_trades, "
                "pnl_1d_usd, pnl_7d_usd, pnl_30d_usd, volume_7d_usd, "
                "tier, wallet_type, overall_score"
            ).eq("address", address).single().execute()

            if ranking.data:
                metrics = {
                    **ranking.data,
                    "source": "database",
                    "cached_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Cache for 5 minutes
                await cache_set(cache_key, metrics, ttl=300)
                return metrics
            else:
                # Wallet not in rankings - calculate on the fly
                return await self._calculate_metrics_live(address)

        except Exception as e:
            logger.error(f"[enrich] Error fetching metrics for {address}: {e}")
            return {"error": str(e), "source": "error"}

    async def _calculate_metrics_live(self, address: str) -> dict[str, Any]:
        """Calculate metrics from wallet_trades on the fly."""
        try:
            # Get all trades for this wallet
            trades = self.sb.table("wallet_trades").select(
                "trade_type, amount_usd, pnl_sol, block_time"
            ).eq("wallet_address", address).execute()

            if not trades.data:
                return {
                    "total_pnl_usd": 0,
                    "win_rate": 0,
                    "total_trades": 0,
                    "source": "calculated_empty"
                }

            # Calculate metrics
            total_trades = len(trades.data)
            winning_trades = sum(1 for t in trades.data if (t.get("pnl_sol") or 0) > 0)
            total_pnl = sum(t.get("amount_usd", 0) for t in trades.data)
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0

            metrics = {
                "total_pnl_usd": total_pnl,
                "win_rate": win_rate,
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "source": "calculated_live"
            }

            return metrics

        except Exception as e:
            logger.error(f"[enrich] Error calculating live metrics: {e}")
            return {"error": str(e), "source": "error"}

    async def enrich_leaderboard_top_wallets(
        self,
        rankings: list[dict],
        top_n: int = 10
    ) -> list[dict]:
        """
        Enrich top N wallets in leaderboard with live data.
        
        Strategy:
        - Top 10: Get fresh metrics from APIs
        - Rest: Use cached DB data
        
        This ensures the most visible wallets have the freshest data
        without overwhelming APIs.
        """
        enriched = []
        
        for i, entry in enumerate(rankings):
            if i < top_n:
                # Enrich with live data
                live_metrics = await self.get_wallet_metrics(
                    entry["profile"]["id"],
                    force_fresh=True
                )
                enriched.append({**entry, **live_metrics, "is_live": True})
            else:
                # Use cached data
                enriched.append({**entry, "is_live": False})

        return enriched


# Global service instance
_service: Optional[DataEnrichmentService] = None


def get_enrichment_service() -> DataEnrichmentService:
    """Get the global enrichment service instance."""
    global _service
    if _service is None:
        _service = DataEnrichmentService()
    return _service
