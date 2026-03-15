"""
KOL Profiles API Router
Endpoints for KOL profiles, wallets, and rankings.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from app.auth import get_optional_user_id, get_current_user_id
from app.services.supabase import get_client
from app.services.redis_cache import cache_get, cache_set
from app.services.twitter_api import get_twitter_profile, get_recent_tweets, get_kol_social_stats
from app.services.kol_calculator import calculate_profile_rankings

router = APIRouter()


# ── Models ──────────────────────────────────────────────────────────────────────

class KolProfile(BaseModel):
    id: str
    display_name: str
    twitter_handle: Optional[str] = None
    twitter_pfp_url: Optional[str] = None
    telegram_handle: Optional[str] = None
    description: Optional[str] = None
    source: str
    verified: bool = False
    total_pnl_usd: float = 0
    win_rate: float = 0
    trade_count: int = 0
    wallet_count: int = 0
    created_at: str


class KolWallet(BaseModel):
    id: str
    address: str
    label: Optional[str] = None
    is_primary: bool = False
    discovered_via: str
    confidence: float = 1.0


class KolRanking(BaseModel):
    rank: int
    profile: KolProfile
    pnl_usd: float
    volume_usd: float
    trade_count: int
    win_rate: float


class KolSubmission(BaseModel):
    wallet_address: str
    twitter_handle: Optional[str] = None
    display_name: Optional[str] = None
    evidence_text: Optional[str] = None
    evidence_urls: Optional[list[str]] = None


# ── Endpoints ───────────────────────────────────────────────────────────────────

@router.get("/profiles")
async def list_kol_profiles(
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    search: Optional[str] = None,
):
    """List all KOL profiles with optional search."""
    supabase = get_client()
    
    query = supabase.table("kol_profiles").select(
        "*, kol_wallets(count)"
    ).order("total_pnl_usd", desc=True)
    
    if search:
        query = query.or_(
            f"display_name.ilike.%{search}%,twitter_handle.ilike.%{search}%"
        )
    
    result = query.range(offset, offset + limit - 1).execute()
    
    profiles = []
    for row in result.data:
        wallet_count = row.get("kol_wallets", [{}])[0].get("count", 0) if row.get("kol_wallets") else 0
        profiles.append({
            **{k: v for k, v in row.items() if k != "kol_wallets"},
            "wallet_count": wallet_count,
        })
    
    return {"profiles": profiles, "count": len(profiles)}


@router.get("/profiles/{handle}")
async def get_kol_profile(handle: str):
    """Get a KOL profile by Twitter handle or ID."""
    supabase = get_client()
    
    # Try by twitter handle first
    result = supabase.table("kol_profiles").select(
        "*, kol_wallets(*)"
    ).eq("twitter_handle", handle.lower().replace("@", "")).single().execute()
    
    if not result.data:
        # Try by ID
        result = supabase.table("kol_profiles").select(
            "*, kol_wallets(*)"
        ).eq("id", handle).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="KOL profile not found")
    
    return result.data


@router.get("/profiles/{handle}/trades")
async def get_kol_trades(
    handle: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
):
    """Get recent trades for a KOL across all their wallets."""
    supabase = get_client()
    
    # Get profile and wallets
    profile = supabase.table("kol_profiles").select(
        "id, kol_wallets(address)"
    ).eq("twitter_handle", handle.lower().replace("@", "")).single().execute()
    
    if not profile.data:
        raise HTTPException(status_code=404, detail="KOL profile not found")
    
    wallet_addresses = [w["address"] for w in profile.data.get("kol_wallets", [])]
    
    if not wallet_addresses:
        return {"trades": [], "count": 0}
    
    # Get trades from Supabase wallet_trades
    try:
        result = supabase.table("wallet_trades").select(
            "tx_signature, block_time, wallet_address, token_address, "
            "token_symbol, trade_type, amount_tokens, amount_sol, amount_usd, pnl_sol"
        ).in_("wallet_address", wallet_addresses).order(
            "block_time", desc=True
        ).range(offset, offset + limit - 1).execute()
        
        trades = result.data or []
    except Exception:
        # Fallback: fetch recent transactions from Helius for the first wallet
        trades = []
        try:
            from app.services.helius import get_wallet_transactions
            for addr in wallet_addresses[:3]:
                txs = await get_wallet_transactions(addr, limit=min(limit, 20))
                for tx in txs:
                    trades.append({
                        "tx_signature": tx.get("signature", ""),
                        "block_time": tx.get("timestamp"),
                        "wallet_address": addr,
                        "token_address": "",
                        "trade_type": tx.get("type", "UNKNOWN"),
                        "amount_sol": 0,
                        "amount_usd": 0,
                    })
        except Exception:
            pass
    
    return {"trades": trades, "count": len(trades)}


@router.get("/rankings")
async def get_kol_rankings(
    wallet_type: str = Query("kol", regex="^(kol|smart_money|all|global|tracked)$"),
    period: str = Query("3d", regex="^(1d|3d|7d|14d|30d|daily|weekly|monthly|all)$"),
    sort_by: str = Query("pnl_sol", regex="^(pnl_sol|pnl_usd|volume_usd|volume_sol|wins|losses|buys|sells|avg_hold_time|win_rate|pnl|roi|volume|hold_time)$"),
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
):
    """
    Get rankings calculated from wallet_rankings + kol_profiles.
    
    Args:
        wallet_type: Filter by 'kol', 'smart_money', 'all', 'global', or 'tracked'
        period: Time period: 1d, 3d, 7d, 14d, 30d
        sort_by: Metric to sort by (pnl_sol, pnl_usd, volume_usd, volume_sol, wins, losses, buys, sells, avg_hold_time, win_rate)
        sort_dir: Sort direction: asc or desc
        limit: Number of results
        offset: Pagination offset
    
    Returns:
        Rankings with calculated stats including PnL in SOL and USD,
        positions, trades with win/loss breakdown, volume, avg hold time
    """
    # Normalize legacy period values
    period_map = {'daily': '1d', 'weekly': '7d', 'monthly': '30d', 'all': '30d'}
    normalized_period = period_map.get(period, period)
    
    return await calculate_profile_rankings(
        wallet_type=wallet_type,
        period=normalized_period,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset
    )


@router.get("/wallet/{address}")
async def get_kol_by_wallet(address: str):
    """Get KOL profile by wallet address."""
    supabase = get_client()
    
    result = supabase.table("kol_wallets").select(
        "*, kol_profiles(*)"
    ).eq("address", address).single().execute()
    
    if not result.data or not result.data.get("kol_profiles"):
        return {"kol_profile": None}
    
    return {"kol_profile": result.data["kol_profiles"]}


@router.post("/submit")
async def submit_kol(
    submission: KolSubmission,
    user_id: str = Depends(get_current_user_id),
):
    """Submit a new KOL wallet for review."""
    supabase = get_client()
    
    # Check if wallet already exists
    existing = supabase.table("kol_wallets").select("id").eq(
        "address", submission.wallet_address
    ).single().execute()
    
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="This wallet is already registered as a KOL"
        )
    
    # Check for pending submission
    pending = supabase.table("kol_submissions").select("id").eq(
        "wallet_address", submission.wallet_address
    ).eq("status", "pending").single().execute()
    
    if pending.data:
        raise HTTPException(
            status_code=400,
            detail="A submission for this wallet is already pending review"
        )
    
    # Create submission
    result = supabase.table("kol_submissions").insert({
        "wallet_address": submission.wallet_address,
        "twitter_handle": submission.twitter_handle,
        "display_name": submission.display_name,
        "evidence_text": submission.evidence_text,
        "evidence_urls": submission.evidence_urls or [],
        "submitter_id": user_id,
        "status": "pending",
    }).execute()
    
    return {"success": True, "submission_id": result.data[0]["id"]}


@router.get("/submissions")
async def list_submissions(
    status: str = Query("pending", regex="^(pending|approved|rejected|all)$"),
    user_id: str = Depends(get_current_user_id),
):
    """List KOL submissions (admin only for all, users see their own)."""
    supabase = get_client()
    
    # Check if user is admin
    user_data = supabase.table("users").select("tier").eq("id", user_id).single().execute()
    is_admin = user_data.data and user_data.data.get("tier") == "admin"
    
    query = supabase.table("kol_submissions").select("*")
    
    if not is_admin:
        query = query.eq("submitter_id", user_id)
    
    if status != "all":
        query = query.eq("status", status)
    
    result = query.order("created_at", desc=True).execute()
    
    return {"submissions": result.data}


@router.post("/submissions/{submission_id}/review")
async def review_submission(
    submission_id: str,
    approved: bool,
    note: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """Review a KOL submission (admin only)."""
    supabase = get_client()
    
    # Check if user is admin
    user_data = supabase.table("users").select("tier").eq("id", user_id).single().execute()
    if not user_data.data or user_data.data.get("tier") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get submission
    submission = supabase.table("kol_submissions").select("*").eq(
        "id", submission_id
    ).single().execute()
    
    if not submission.data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.data["status"] != "pending":
        raise HTTPException(status_code=400, detail="Submission already reviewed")
    
    # Update submission status
    supabase.table("kol_submissions").update({
        "status": "approved" if approved else "rejected",
        "reviewer_id": user.user_id,
        "reviewer_note": note,
        "reviewed_at": datetime.utcnow().isoformat(),
    }).eq("id", submission_id).execute()
    
    if approved:
        # Create KOL profile
        profile_result = supabase.table("kol_profiles").insert({
            "display_name": submission.data["display_name"] or submission.data["twitter_handle"] or "Unknown",
            "twitter_handle": submission.data["twitter_handle"],
            "source": "user_submission",
        }).execute()
        
        # Add wallet
        supabase.table("kol_wallets").insert({
            "kol_profile_id": profile_result.data[0]["id"],
            "address": submission.data["wallet_address"],
            "label": "Main",
            "is_primary": True,
            "discovered_via": "user_submission",
        }).execute()
    
    return {"success": True, "approved": approved}


@router.get("/profiles/{handle}/social")
async def get_kol_social(handle: str):
    """
    Get Twitter social stats for a KOL.
    Returns profile data, recent tweets, and token mentions.
    Requires TWITTER_BEARER_TOKEN env var.
    """
    # Get KOL profile to verify exists and get twitter handle
    supabase = get_client()
    
    result = supabase.table("kol_profiles").select(
        "twitter_handle"
    ).eq("twitter_handle", handle.lower().replace("@", "")).single().execute()
    
    twitter_handle = result.data.get("twitter_handle") if result.data else handle
    
    if not twitter_handle:
        return {"profile": None, "recent_tweets": [], "top_token_mentions": []}
    
    # Fetch social stats from Twitter API
    stats = await get_kol_social_stats(twitter_handle)
    return stats
