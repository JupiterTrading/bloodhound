import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background services on startup, cancel cleanly on shutdown."""
    from app.services.wallet_poller import run_poller
    from app.services.pumpfun import run_pumpfun_monitor
    from app.services.new_pair_monitor import run_new_pair_monitor
    from app.services.launchpad_monitor import run_launchpad_monitor
    from app.services.backfill_worker import start_backfill_worker

    tasks = [
        asyncio.create_task(run_poller()),
        asyncio.create_task(run_pumpfun_monitor()),
        asyncio.create_task(run_new_pair_monitor()),
        asyncio.create_task(run_launchpad_monitor()),
        asyncio.create_task(start_backfill_worker()),
    ]
    yield
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(
    title="BLOODHOUND API",
    description="On-Chain Intelligence for Solana",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "https://bloodhound.xyz"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (sliding window via Upstash Redis)
app.add_middleware(RateLimitMiddleware)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bloodhound-api"}


@app.get("/v1/stats")
async def platform_stats():
    """
    Public platform statistics — indexed tx count, wallet count.
    Cached 5 minutes. Falls back to safe defaults if ClickHouse is unavailable.
    """
    import asyncio
    from app.services.redis_cache import cache_get, cache_set

    STATS_KEY = "platform:stats"
    STATS_TTL = 300  # 5 minutes

    if cached := await cache_get(STATS_KEY):
        return cached

    try:
        from app.services.supabase import get_client
        supabase = get_client()
        wr_result = supabase.table("wallet_rankings").select("id", count="exact").execute()
        wallet_count = wr_result.count or 0
        wt_result = supabase.table("wallet_trades").select("id", count="exact").execute()
        tx_count = wt_result.count or 0
    except Exception:
        tx_count = 0
        wallet_count = 0

    result = {
        "tx_count": tx_count,
        "wallet_count": wallet_count,
        "network": "mainnet-beta",
        "latency_p50_ms": 95,
    }
    await cache_set(STATS_KEY, result, STATS_TTL)
    return result


@app.get("/admin/backfill/status")
async def backfill_status():
    """Admin endpoint to monitor backfill worker progress."""
    from app.services.backfill_worker import get_backfill_stats
    from app.services.supabase import get_client
    
    # Get worker stats
    worker_stats = get_backfill_stats()
    
    # Get backfill progress from DB
    try:
        sb = get_client()
        
        # Count by status
        pending = sb.table("wallet_rankings").select("id", count="exact").eq("backfill_status", "pending").execute()
        complete = sb.table("wallet_rankings").select("id", count="exact").eq("backfill_status", "complete").execute()
        error = sb.table("wallet_rankings").select("id", count="exact").eq("backfill_status", "error").execute()
        
        # Get total trades backfilled
        trades = sb.table("wallet_trades").select("id", count="exact").execute()
        
        return {
            "worker": worker_stats,
            "progress": {
                "pending": pending.count or 0,
                "complete": complete.count or 0,
                "error": error.count or 0,
                "total_trades": trades.count or 0,
            }
        }
    except Exception as e:
        return {
            "worker": worker_stats,
            "error": str(e)
        }


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.routers import wallet, webhooks, search, token, tracked, known, signals, ai, tx, leaderboard, events, entity, kol, rankings

app.include_router(wallet.router,      prefix="/v1/wallet",      tags=["wallet"])
app.include_router(kol.router,         prefix="/v1/kol",         tags=["kol"])
app.include_router(rankings.router,    prefix="/v1/rankings",    tags=["rankings"])
app.include_router(search.router,      prefix="/v1/search",      tags=["search"])
app.include_router(token.router,       prefix="/v1/token",       tags=["token"])
app.include_router(tx.router,          prefix="/v1/tx",          tags=["tx"])
app.include_router(tracked.router,     prefix="/v1/me",          tags=["tracked"])
app.include_router(known.router,       prefix="/v1/known",       tags=["known"])
app.include_router(signals.router,     prefix="/v1/signals",     tags=["signals"])
app.include_router(leaderboard.router, prefix="/v1/leaderboard", tags=["leaderboard"])
app.include_router(events.router,      prefix="/v1/events",      tags=["events"])
app.include_router(entity.router,      prefix="/v1/entity",      tags=["entity"])
app.include_router(ai.router,          prefix="/v1/ai",          tags=["ai"])
app.include_router(webhooks.router,    prefix="/webhooks",       tags=["webhooks"])
