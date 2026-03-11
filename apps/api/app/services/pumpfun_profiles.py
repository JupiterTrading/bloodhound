"""
Pump.fun profile scraper — fetch wallet Twitter handles from Pump.fun profiles.

Uses the unofficial profile-api.pump.fun endpoint to get user profile data
including linked Twitter handles for wallets that have set up Pump.fun profiles.
"""

import httpx
from typing import Any

PROFILE_API_BASE = "https://profile-api.pump.fun"
FRONTEND_API_BASE = "https://frontend-api-v3.pump.fun"


async def get_wallet_profile(address: str) -> dict[str, Any] | None:
    """
    Fetch Pump.fun profile for a wallet address.
    Returns profile data including Twitter handle if available.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Try profile API first
            r = await client.get(f"{PROFILE_API_BASE}/users/{address}")
            if r.is_success:
                data = r.json()
                return _parse_profile(data)
            
            # Fallback to frontend API
            r = await client.get(f"{FRONTEND_API_BASE}/users/{address}")
            if r.is_success:
                data = r.json()
                return _parse_profile(data)
    except Exception:
        pass
    
    return None


def _parse_profile(data: dict) -> dict[str, Any]:
    """Parse Pump.fun profile response into normalized format."""
    return {
        "address": data.get("address") or data.get("wallet"),
        "username": data.get("username"),
        "bio": data.get("bio"),
        "profile_image": data.get("profile_image") or data.get("profileImage"),
        "twitter_handle": _extract_twitter(data),
        "telegram_handle": _extract_telegram(data),
        "followers_count": data.get("followers_count") or data.get("followersCount", 0),
        "following_count": data.get("following_count") or data.get("followingCount", 0),
        "tokens_created": data.get("tokens_created") or data.get("tokensCreated", 0),
    }


def _extract_twitter(data: dict) -> str | None:
    """Extract Twitter handle from various possible fields."""
    # Check direct twitter field
    twitter = data.get("twitter") or data.get("twitter_handle") or data.get("twitterHandle")
    if twitter:
        # Clean up handle (remove @ and URL prefixes)
        handle = twitter.strip()
        if handle.startswith("@"):
            handle = handle[1:]
        if "twitter.com/" in handle:
            handle = handle.split("twitter.com/")[-1].split("/")[0].split("?")[0]
        if "x.com/" in handle:
            handle = handle.split("x.com/")[-1].split("/")[0].split("?")[0]
        return handle if handle else None
    
    # Check socials array
    socials = data.get("socials") or data.get("links") or []
    for social in socials:
        if isinstance(social, dict):
            stype = (social.get("type") or social.get("platform") or "").lower()
            url = social.get("url") or social.get("link") or ""
            if stype in ("twitter", "x") or "twitter.com" in url or "x.com" in url:
                handle = url.split("/")[-1].split("?")[0]
                return handle if handle else None
    
    return None


def _extract_telegram(data: dict) -> str | None:
    """Extract Telegram handle from profile data."""
    telegram = data.get("telegram") or data.get("telegram_handle")
    if telegram:
        handle = telegram.strip()
        if handle.startswith("@"):
            handle = handle[1:]
        if "t.me/" in handle:
            handle = handle.split("t.me/")[-1].split("/")[0].split("?")[0]
        return handle if handle else None
    
    # Check socials array
    socials = data.get("socials") or data.get("links") or []
    for social in socials:
        if isinstance(social, dict):
            stype = (social.get("type") or social.get("platform") or "").lower()
            url = social.get("url") or social.get("link") or ""
            if stype == "telegram" or "t.me/" in url:
                handle = url.split("/")[-1].split("?")[0]
                return handle if handle else None
    
    return None


async def enrich_wallet_with_pumpfun(address: str) -> dict[str, Any]:
    """
    Attempt to enrich wallet data with Pump.fun profile info.
    Returns empty dict if no profile found.
    """
    profile = await get_wallet_profile(address)
    if not profile:
        return {}
    
    result = {}
    if profile.get("twitter_handle"):
        result["twitter_handle"] = profile["twitter_handle"]
    if profile.get("telegram_handle"):
        result["telegram_handle"] = profile["telegram_handle"]
    if profile.get("username"):
        result["pumpfun_username"] = profile["username"]
    if profile.get("bio"):
        result["pumpfun_bio"] = profile["bio"]
    if profile.get("profile_image"):
        result["pumpfun_avatar"] = profile["profile_image"]
    
    return result
