"""
Known wallets — public lookup, community submissions, dispute system.
GET  /v1/known/{address}
POST /v1/known/submit
POST /v1/known/{address}/dispute
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user_id
from app.services import supabase as supabase_svc

router = APIRouter()

VALID_CATEGORIES = {
    "kol",
    "known_figure",
    "profitable_trader",
    "protocol_team",
    "exchange",
    "suspected_bad_actor",
}


@router.get("")
async def list_known_wallets(
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """List approved known wallets, optionally filtered by category."""
    wallets = await supabase_svc.list_known_wallets(category=category, limit=limit)
    return {"wallets": wallets, "count": len(wallets)}


@router.get("/{address}")
async def get_known_wallet(address: str):
    """Check if address is a known wallet. Returns label + category or 404."""
    known = await supabase_svc.get_known_wallet(address)
    if not known:
        raise HTTPException(status_code=404, detail="Wallet not in known_wallets database")
    return {"address": address, **known}


class SubmitWalletRequest(BaseModel):
    address: str
    label: str
    category: str
    evidence_text: str | None = None
    evidence_urls: list[str] = []
    twitter_handle: str | None = None
    telegram_handle: str | None = None


@router.post("/submit", status_code=201)
async def submit_known_wallet(
    body: SubmitWalletRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Submit a wallet for admin review. Requires authentication."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {sorted(VALID_CATEGORIES)}",
        )

    client = supabase_svc.get_client()
    result = (
        client.table("known_wallet_submissions")
        .insert(
            {
                "address": body.address,
                "label": body.label,
                "category": body.category,
                "evidence_text": body.evidence_text,
                "evidence_urls": body.evidence_urls,
                "twitter_handle": body.twitter_handle,
                "telegram_handle": body.telegram_handle,
                "submitter_id": user_id,
                "status": "pending",
            }
        )
        .execute()
    )
    return {
        "status": "submitted",
        "message": "Your submission is under review. We'll update the database if approved.",
        "submission_id": result.data[0]["id"],
    }


class DisputeRequest(BaseModel):
    dispute_type: str  # 'incorrect_label' | 'incorrect_category' | 'side_wallet_false_positive'
    explanation: str
    evidence_urls: list[str] = []


@router.post("/{address}/dispute")
async def dispute_wallet(
    address: str,
    body: DisputeRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Dispute a wallet label or side-wallet flag. Goes to admin review queue.
    Community disputes affect side_wallet_candidates.community_score by ±0.05.
    """
    valid_types = {"incorrect_label", "incorrect_category", "side_wallet_false_positive"}
    if body.dispute_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid dispute_type: {valid_types}")

    # Record dispute — for now store as a notification type in our DB
    # Full dispute queue system is a Phase 2 admin panel feature
    client = supabase_svc.get_client()
    client.table("notifications").insert(
        {
            "user_id": user_id,
            "type": "wallet_dispute",
            "content": {
                "address": address,
                "dispute_type": body.dispute_type,
                "explanation": body.explanation,
                "evidence_urls": body.evidence_urls,
            },
            "is_read": False,
        }
    ).execute()

    # If side wallet dispute, adjust confidence slightly
    if body.dispute_type == "side_wallet_false_positive":
        candidates = await supabase_svc.get_side_wallet_candidates(address, min_confidence=0.0)
        db = supabase_svc.get_client()
        for candidate in candidates:
            new_score = max(0.0, candidate.get("community_score", 0.5) - 0.05)
            votes = candidate.get("user_votes", {})
            votes[user_id] = "dispute"
            db.table("side_wallet_candidates").update(
                {"community_score": new_score, "user_votes": votes}
            ).eq("id", candidate["id"]).execute()

    return {
        "status": "recorded",
        "message": "Your dispute has been recorded and will be reviewed by our team.",
    }
