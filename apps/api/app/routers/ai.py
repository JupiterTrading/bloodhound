"""
Bloodhound AI query endpoint.
POST /v1/ai/query
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_pipeline import run_bloodhound_ai
from app.services.redis_cache import cache_get, cache_set
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


class TrackedWallet(BaseModel):
    label: str
    address: str


class AIQueryContext(BaseModel):
    tracked_wallets: list[TrackedWallet] = []


class AIQueryRequest(BaseModel):
    query: str
    session_id: str
    context: AIQueryContext = AIQueryContext()


@router.post("/query")
async def bloodhound_ai_query(body: AIQueryRequest):
    """
    Bloodhound AI — natural language on-chain intelligence.

    Pipeline: Intent Classifier (haiku) → Context Injector → Tool Loop (sonnet) → Formatter
    Returns: {answer, numbers, evidence, confidence, viz_type, actions}

    Rate limits applied upstream by RateLimitMiddleware.
    Session context (last 10 queries) is injected via context.tracked_wallets for label resolution.
    """
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if len(body.query) > 2000:
        raise HTTPException(status_code=400, detail="Query too long (max 2000 characters)")
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="Bloodhound AI is not configured on this instance")

    context = {
        "tracked_wallets": [w.model_dump() for w in body.context.tracked_wallets],
    }

    result = await run_bloodhound_ai(
        query=body.query,
        session_id=body.session_id,
        context=context,
    )
    return result
