from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.rate_limit import RateLimitMiddleware

app = FastAPI(
    title="BLOODHOUND API",
    description="On-Chain Intelligence for Solana",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow Next.js dev server and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://bloodhound.xyz"],
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
        from app.services.clickhouse import get_client
        client = get_client()

        tx_result, wallet_result = await asyncio.gather(
            asyncio.to_thread(client.query, "SELECT count() FROM transfers"),
            asyncio.to_thread(
                client.query,
                "SELECT uniqExact(from_address) FROM transfers"
            ),
        )
        tx_count = int(tx_result.result_rows[0][0] or 0)
        wallet_count = int(wallet_result.result_rows[0][0] or 0)
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


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.routers import wallet, webhooks, search, token, tracked, known, signals, ai, tx

app.include_router(wallet.router,    prefix="/v1/wallet",  tags=["wallet"])
app.include_router(search.router,    prefix="/v1/search",  tags=["search"])
app.include_router(token.router,     prefix="/v1/token",   tags=["token"])
app.include_router(tx.router,        prefix="/v1/tx",      tags=["tx"])
app.include_router(tracked.router,   prefix="/v1/me",      tags=["tracked"])
app.include_router(known.router,     prefix="/v1/known",   tags=["known"])
app.include_router(signals.router,   prefix="/v1/signals", tags=["signals"])
app.include_router(ai.router,        prefix="/v1/ai",      tags=["ai"])
app.include_router(webhooks.router,  prefix="/webhooks",   tags=["webhooks"])
