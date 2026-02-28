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


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.routers import wallet, webhooks, search, token, tracked, known, signals, ai

app.include_router(wallet.router,    prefix="/v1/wallet",  tags=["wallet"])
app.include_router(search.router,    prefix="/v1/search",  tags=["search"])
app.include_router(token.router,     prefix="/v1/token",   tags=["token"])
app.include_router(tracked.router,   prefix="/v1/me",      tags=["tracked"])
app.include_router(known.router,     prefix="/v1/known",   tags=["known"])
app.include_router(signals.router,   prefix="/v1/signals", tags=["signals"])
app.include_router(ai.router,        prefix="/v1/ai",      tags=["ai"])
app.include_router(webhooks.router,  prefix="/webhooks",   tags=["webhooks"])
