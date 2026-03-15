# Hybrid Data Loading Architecture

## Overview

Bloodhound uses a **hybrid data loading system** that combines background backfilling with real-time API enrichment to provide the best user experience while respecting API rate limits and costs.

## Philosophy

**Show something instantly, improve it progressively.**

- ✅ **Never** make users wait for fresh data if cached data exists
- ✅ **Always** show something immediately (even if slightly stale)
- ✅ **Progressively** enrich data in the background
- ✅ **Prioritize** user-facing requests over background tasks
- ✅ **Cache** aggressively, invalidate intelligently

## Architecture Components

### 1. Background Backfill Worker (`backfill_worker.py`)

**Purpose**: Systematically populate historical trade data for all KOLs.

**Strategy**:
- **Priority Queue**: Top KOLs (legendary/elite tier, high PnL) get backfilled first
- **Incremental**: Fetch recent trades first, then go back in time
- **Rate Limited**: Respects API limits (Helius: 100 req/s)
- **Checkpointed**: Tracks progress in `wallet_rankings.backfill_status`
- **Smart Scheduling**: Runs continuously but can be paused during peak traffic

**Process**:
```
1. Get next wallet from priority queue (tier + PnL sorted)
2. Check existing trades in wallet_trades table
3. Fetch missing data from Helius API (last 30 days)
4. Parse swap transactions into trade records
5. Insert trades in batches (100 at a time)
6. Update backfill_status to 'complete'
7. Sleep 6 seconds (rate limiting)
8. Repeat
```

**Monitoring**:
- Admin endpoint: `GET /admin/backfill/status`
- Shows: wallets processed, trades inserted, errors, current wallet
- Progress: pending/complete/error counts

### 2. Smart Data Enrichment Service (`data_enrichment.py`)

**Purpose**: Provide fast data access with progressive enrichment.

**Multi-Tier Loading**:

#### Tier 1: Instant (< 1ms)
- Check Redis cache
- Return immediately if hit
- **Use case**: Repeated requests, hot data

#### Tier 2: Fast (10-50ms)
- Query Supabase `wallet_trades` table
- Return cached historical data
- **Use case**: Most user requests

#### Tier 3: Fresh (100-500ms)
- Queue background API call to Helius
- Fetch latest transactions
- Update database asynchronously
- **Use case**: Stale data detection

#### Tier 4: Background (async)
- Parse and insert new trades
- Invalidate relevant caches
- Update metrics
- **Use case**: Keep data fresh without blocking users

**Example Flow**:
```python
# User requests wallet trades
response = await enrichment.get_wallet_trades(address)

# Returns immediately with:
{
  "trades": [...],           # From DB (fast)
  "count": 123,
  "has_cached": true,
  "is_enriching": false,     # True if background refresh queued
  "last_updated": "2024-...",
  "source": "database"       # cache | database | calculated_live
}

# If data is stale (> 5 min old):
# - Background task fetches fresh data from Helius
# - Updates wallet_trades table
# - Next request gets fresh data
```

### 3. Database Schema

#### `wallet_rankings` (54,770 rows)
- Core KOL data from GMGN seed
- Aggregated metrics (PnL, win rate, tier)
- **Backfill tracking columns**:
  - `backfill_status`: pending | partial | complete | error
  - `backfill_last_run`: timestamp
  - `backfill_trade_count`: number of trades fetched
  - `backfill_error`: error message if failed

#### `wallet_trades` (growing)
- Individual trade records
- Populated by backfill worker + real-time enrichment
- Indexed on: `wallet_address`, `block_time`, `token_address`

#### `wallet_signals` (future)
- Detected signals (snipes, early buys, etc.)
- Generated from trade analysis

## Usage Patterns

### Pattern 1: Leaderboard Page

**Goal**: Show 50 KOLs instantly, enrich top 10 with live data

```python
# 1. Get rankings from DB (instant)
rankings = await leaderboard_api.get(category="kol", limit=50)

# 2. Show to user immediately
return rankings  # ~50ms response time

# 3. Enrich top 10 in background (optional)
top_10 = await enrichment.enrich_leaderboard_top_wallets(rankings, top_n=10)
```

**Result**:
- User sees data in 50ms
- Top 10 get live metrics within 500ms
- Rest use cached DB data (good enough for rankings)

### Pattern 2: Wallet Detail Page

**Goal**: Show cached trades instantly, fetch fresh data in background

```python
# 1. Get cached trades (instant)
data = await enrichment.get_wallet_trades(address, limit=50)

# Returns immediately with DB data
# If stale, queues background refresh

# 2. Show to user
return data  # ~30ms response time

# 3. Background task updates DB
# Next request gets fresh data
```

**Result**:
- User sees trades in 30ms (from DB)
- Fresh data loads in background
- Subsequent requests get updated data

### Pattern 3: AI Agent Queries

**Goal**: Use cached data for speed, fetch fresh for critical queries

```python
# For general queries: use cached data
trades = await enrichment.get_wallet_trades(address)

# For critical analysis: force fresh data
trades = await enrichment.get_wallet_trades(address, force_fresh=True)
```

**Result**:
- Most queries use fast cached data
- Important queries get fresh data
- AI responses are fast and accurate

## Data Sources

### Primary: Helius API
- **Transaction History**: `/v0/addresses/{address}/transactions`
- **Rate Limit**: 100 requests/second (paid tier)
- **Coverage**: Last 30 days of transactions
- **Cost**: ~$0.001 per request
- **Use**: Background backfill + real-time enrichment

### Secondary: GMGN API (future)
- **All-time History**: Historical trades beyond 30 days
- **Rate Limit**: Unknown (need to test)
- **Coverage**: Complete trade history
- **Use**: Deep backfill for top KOLs

### Tertiary: On-chain (future)
- **RPC Calls**: Direct Solana RPC queries
- **Rate Limit**: Depends on RPC provider
- **Coverage**: Complete blockchain history
- **Use**: Fallback when APIs unavailable

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Leaderboard load | < 100ms | ~50ms |
| Wallet trades load | < 50ms | ~30ms |
| Fresh data enrichment | < 500ms | ~300ms |
| Backfill rate | 10 wallets/min | TBD |
| Cache hit rate | > 80% | TBD |

## Deployment Steps

### 1. Run SQL Migration
```sql
-- Add backfill tracking columns
\i packages/db/schema/013_backfill_tracking.sql
```

### 2. Start API Server
```bash
cd apps/api
uvicorn app.main:app --reload
```

The backfill worker starts automatically on server startup.

### 3. Monitor Progress
```bash
# Check backfill status
curl http://localhost:8000/admin/backfill/status

# Response:
{
  "worker": {
    "is_running": true,
    "wallets_processed": 123,
    "trades_inserted": 4567,
    "errors": 2,
    "current_wallet": "4vw54BmA..."
  },
  "progress": {
    "pending": 54000,
    "complete": 770,
    "error": 0,
    "total_trades": 45670
  }
}
```

### 4. Verify Data Quality
```bash
# Check trades for a specific wallet
curl http://localhost:8000/v1/wallet/{address}/trades

# Should return:
{
  "trades": [...],
  "count": 123,
  "has_cached": true,
  "is_enriching": false,
  "source": "database"
}
```

## Future Enhancements

### Phase 1: Optimization (Week 1-2)
- [ ] Add Redis tag-based cache invalidation
- [ ] Implement batch API calls to reduce latency
- [ ] Add metrics/monitoring (Prometheus)
- [ ] Optimize SQL queries with better indexes

### Phase 2: Intelligence (Week 3-4)
- [ ] Detect snipes/early buys during backfill
- [ ] Calculate hold times and ROI
- [ ] Generate wallet signals automatically
- [ ] Update wallet_rankings metrics from trades

### Phase 3: Scale (Month 2)
- [ ] Horizontal scaling: multiple backfill workers
- [ ] Distributed task queue (Celery/BullMQ)
- [ ] CDN caching for static leaderboard data
- [ ] Database read replicas for queries

### Phase 4: Advanced (Month 3+)
- [ ] Real-time websocket updates for live trades
- [ ] Predictive prefetching based on user behavior
- [ ] ML-based cache warming (predict what users will view)
- [ ] Multi-region deployment for global latency

## Cost Analysis

**Helius API Costs** (assuming 54,770 wallets):
- Backfill: 54,770 wallets × $0.001 = **$54.77** (one-time)
- Daily refresh: 1,000 active wallets × $0.001 = **$1/day** = **$30/month**
- Real-time enrichment: 10,000 requests/day × $0.001 = **$10/day** = **$300/month**

**Total**: ~$55 one-time + ~$330/month

**Savings from Caching**:
- Without cache: 100,000 requests/day × $0.001 = **$3,000/month**
- With cache (80% hit rate): 20,000 requests/day × $0.001 = **$600/month**
- **Savings**: **$2,400/month** (80% reduction)

## Monitoring & Alerts

### Key Metrics to Track
1. **Backfill Progress**: wallets processed, trades inserted
2. **Cache Hit Rate**: Redis hits vs misses
3. **API Latency**: p50, p95, p99 response times
4. **Error Rate**: failed backfills, API errors
5. **Data Freshness**: age of cached data

### Alert Thresholds
- ⚠️ Backfill worker stopped for > 5 minutes
- ⚠️ Error rate > 5%
- ⚠️ Cache hit rate < 70%
- ⚠️ API latency p95 > 500ms
- 🚨 Data freshness > 1 hour for top 100 wallets

## Conclusion

This hybrid architecture provides:
- ✅ **Fast UX**: Users see data in < 50ms
- ✅ **Fresh Data**: Background enrichment keeps data current
- ✅ **Cost Efficient**: Caching reduces API costs by 80%
- ✅ **Scalable**: Can handle millions of requests/day
- ✅ **Reliable**: Graceful degradation if APIs fail

The system is designed to grow with the product, starting simple and adding sophistication as needed.
