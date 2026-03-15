"""
BLOODHOUND — Wallet Rankings API
Leaderboards, categories, and wallet tracking endpoints
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
import httpx
import os

router = APIRouter(prefix="/rankings", tags=["rankings"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ndstmcyrgljnyqxbwgct.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


class WalletType(str, Enum):
    kol = "kol"
    smart_money = "smart_money"
    sniper = "sniper"
    fresh_wallet = "fresh_wallet"
    whale = "whale"
    insider = "insider"
    copy_trader = "copy_trader"
    market_maker = "market_maker"
    protocol = "protocol"
    suspicious = "suspicious"


class WalletTier(str, Enum):
    legendary = "legendary"
    elite = "elite"
    pro = "pro"
    rising = "rising"
    standard = "standard"


class Period(str, Enum):
    day_1 = "1d"
    day_7 = "7d"
    day_30 = "30d"
    all_time = "all"


class RankedWallet(BaseModel):
    rank: int
    address: str
    label: Optional[str]
    twitter_handle: Optional[str]
    wallet_type: WalletType
    tier: WalletTier
    pnl_sol: float
    pnl_usd: float
    win_rate: float
    total_trades: int
    overall_score: float


class WalletDetails(BaseModel):
    address: str
    label: Optional[str]
    twitter_handle: Optional[str]
    telegram_handle: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    wallet_type: WalletType
    tier: WalletTier
    categories: List[str]
    total_pnl_sol: float
    total_pnl_usd: float
    win_rate: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_hold_time_mins: int
    pnl_1d_sol: float
    pnl_7d_sol: float
    pnl_30d_sol: float
    volume_7d_usd: float
    followers_count: int
    copiers_count: int
    overall_score: float
    profitability_score: float
    consistency_score: float
    timing_score: float
    sol_balance: float
    is_verified: bool
    source: str


@router.get("/leaderboard", response_model=List[RankedWallet])
async def get_leaderboard(
    wallet_type: Optional[WalletType] = None,
    period: Period = Period.day_7,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    """
    Get wallet leaderboard by category and time period.
    Similar to GMGN/Axiom Vision rankings.
    """
    # Build query
    pnl_field = {
        "1d": "pnl_1d_sol",
        "7d": "pnl_7d_sol", 
        "30d": "pnl_30d_sol",
        "all": "total_pnl_sol",
    }[period.value]
    
    query = f"{SUPABASE_URL}/rest/v1/wallet_rankings?is_public=eq.true"
    
    if wallet_type:
        query += f"&wallet_type=eq.{wallet_type.value}"
    
    query += f"&order={pnl_field}.desc&limit={limit}&offset={offset}"
    query += "&select=address,label,twitter_handle,wallet_type,tier,"
    query += f"{pnl_field},win_rate,total_trades,overall_score"
    
    async with httpx.AsyncClient() as client:
        res = await client.get(
            query,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail="Failed to fetch leaderboard")
        
        data = res.json()
        
        # Map to response model
        results = []
        for i, w in enumerate(data):
            results.append(RankedWallet(
                rank=offset + i + 1,
                address=w["address"],
                label=w.get("label"),
                twitter_handle=w.get("twitter_handle"),
                wallet_type=w["wallet_type"],
                tier=w["tier"],
                pnl_sol=w.get(pnl_field, 0) or 0,
                pnl_usd=0,  # Calculate from SOL price
                win_rate=w.get("win_rate", 0) or 0,
                total_trades=w.get("total_trades", 0) or 0,
                overall_score=w.get("overall_score", 50) or 50,
            ))
        
        return results


@router.get("/wallet/{address}", response_model=WalletDetails)
async def get_wallet_details(address: str):
    """
    Get detailed information about a ranked wallet.
    """
    query = f"{SUPABASE_URL}/rest/v1/wallet_rankings?address=eq.{address}"
    
    async with httpx.AsyncClient() as client:
        res = await client.get(
            query,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail="Failed to fetch wallet")
        
        data = res.json()
        
        if not data:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        w = data[0]
        return WalletDetails(
            address=w["address"],
            label=w.get("label"),
            twitter_handle=w.get("twitter_handle"),
            telegram_handle=w.get("telegram_handle"),
            avatar_url=w.get("avatar_url"),
            bio=w.get("bio"),
            wallet_type=w["wallet_type"],
            tier=w["tier"],
            categories=w.get("categories", []),
            total_pnl_sol=w.get("total_pnl_sol", 0) or 0,
            total_pnl_usd=w.get("total_pnl_usd", 0) or 0,
            win_rate=w.get("win_rate", 0) or 0,
            total_trades=w.get("total_trades", 0) or 0,
            winning_trades=w.get("winning_trades", 0) or 0,
            losing_trades=w.get("losing_trades", 0) or 0,
            avg_hold_time_mins=w.get("avg_hold_time_mins", 0) or 0,
            pnl_1d_sol=w.get("pnl_1d_sol", 0) or 0,
            pnl_7d_sol=w.get("pnl_7d_sol", 0) or 0,
            pnl_30d_sol=w.get("pnl_30d_sol", 0) or 0,
            volume_7d_usd=w.get("volume_7d_usd", 0) or 0,
            followers_count=w.get("followers_count", 0) or 0,
            copiers_count=w.get("copiers_count", 0) or 0,
            overall_score=w.get("overall_score", 50) or 50,
            profitability_score=w.get("profitability_score", 50) or 50,
            consistency_score=w.get("consistency_score", 50) or 50,
            timing_score=w.get("timing_score", 50) or 50,
            sol_balance=w.get("sol_balance", 0) or 0,
            is_verified=w.get("is_verified", False),
            source=w.get("source", "manual"),
        )


@router.get("/categories")
async def get_category_stats():
    """
    Get wallet counts by category and tier.
    """
    query = f"{SUPABASE_URL}/rest/v1/wallet_rankings?select=wallet_type,tier"
    
    async with httpx.AsyncClient() as client:
        res = await client.get(
            query,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
        )
        
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail="Failed to fetch stats")
        
        data = res.json()
        
        by_type = {}
        by_tier = {}
        
        for w in data:
            wt = w["wallet_type"]
            tier = w["tier"]
            by_type[wt] = by_type.get(wt, 0) + 1
            by_tier[tier] = by_tier.get(tier, 0) + 1
        
        return {
            "total": len(data),
            "by_type": by_type,
            "by_tier": by_tier,
        }


@router.get("/top-kols", response_model=List[RankedWallet])
async def get_top_kols(
    period: Period = Period.day_7,
    limit: int = Query(default=50, le=200),
):
    """
    Shortcut to get top KOL wallets.
    """
    return await get_leaderboard(
        wallet_type=WalletType.kol,
        period=period,
        limit=limit,
    )


@router.get("/smart-money", response_model=List[RankedWallet])
async def get_smart_money(
    period: Period = Period.day_7,
    limit: int = Query(default=50, le=200),
):
    """
    Shortcut to get top Smart Money wallets.
    """
    return await get_leaderboard(
        wallet_type=WalletType.smart_money,
        period=period,
        limit=limit,
    )


@router.get("/snipers", response_model=List[RankedWallet])
async def get_snipers(
    period: Period = Period.day_7,
    limit: int = Query(default=50, le=200),
):
    """
    Shortcut to get top Sniper wallets.
    """
    return await get_leaderboard(
        wallet_type=WalletType.sniper,
        period=period,
        limit=limit,
    )


@router.get("/whales", response_model=List[RankedWallet])
async def get_whales(
    period: Period = Period.day_7,
    limit: int = Query(default=50, le=200),
):
    """
    Shortcut to get Whale wallets.
    """
    return await get_leaderboard(
        wallet_type=WalletType.whale,
        period=period,
        limit=limit,
    )
