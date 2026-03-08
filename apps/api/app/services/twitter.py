"""
Twitter API v2 service — US-B501/B502/B503.

Provides:
  - get_kol_profile(handle)       → followers, bio, profile image
  - get_recent_tweets(user_id)    → last N tweets with engagement metrics
  - get_token_tweet_volume(symbol) → recent tweet count for a $TOKEN (requires Elevated access)

Auth: Bearer token (read-only). No write access needed.
Cache: profile 1hr, tweets 15min, search 15min.

Note: Tweet search (get_token_tweet_volume) requires Twitter API Elevated or Pro tier.
      Basic (free) tier only supports user lookup + user timeline.
      Falls back gracefully with empty results if search is unavailable.
"""

import asyncio
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.redis_cache import cache_get, cache_set, TTL_TWITTER

settings = get_settings()

TWITTER_BASE = "https://api.twitter.com/2"
TTL_TWEETS = 900  # 15 min
TTL_SEARCH = 900  # 15 min


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.twitter_bearer_token}"}


async def get_kol_profile(handle: str) -> dict[str, Any] | None:
    """
    Fetch a Twitter user's public profile by username.
    Returns: {user_id, name, handle, bio, followers, following, tweet_count, profile_image_url}
    Returns None if handle not found or API unavailable.
    """
    if not settings.twitter_bearer_token:
        return None

    clean_handle = handle.lstrip("@")
    key = f"tw:profile:{clean_handle.lower()}"
    if cached := await cache_get(key):
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{TWITTER_BASE}/users/by/username/{clean_handle}",
                headers=_auth_headers(),
                params={
                    "user.fields": "description,public_metrics,profile_image_url,url,entities",
                },
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return None

    user = data.get("data")
    if not user:
        return None

    metrics = user.get("public_metrics", {})
    result = {
        "user_id": user["id"],
        "name": user.get("name"),
        "handle": clean_handle,
        "bio": user.get("description"),
        "followers": metrics.get("followers_count"),
        "following": metrics.get("following_count"),
        "tweet_count": metrics.get("tweet_count"),
        "profile_image_url": user.get("profile_image_url", "").replace("_normal", "_400x400"),
    }
    await cache_set(key, result, TTL_TWITTER)
    return result


async def get_recent_tweets(user_id: str, count: int = 5) -> list[dict[str, Any]]:
    """
    Fetch the most recent tweets for a Twitter user ID.
    Returns list of {tweet_id, text, created_at, url, likes, retweets, replies}
    """
    if not settings.twitter_bearer_token:
        return []

    key = f"tw:tweets:{user_id}:{count}"
    if cached := await cache_get(key):
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{TWITTER_BASE}/users/{user_id}/tweets",
                headers=_auth_headers(),
                params={
                    "max_results": min(count, 10),
                    "tweet.fields": "created_at,public_metrics,text",
                    "exclude": "retweets,replies",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    tweets = []
    for t in data.get("data", []):
        metrics = t.get("public_metrics", {})
        tweets.append({
            "tweet_id": t["id"],
            "text": t.get("text", ""),
            "created_at": t.get("created_at"),
            "url": f"https://x.com/i/web/status/{t['id']}",
            "likes": metrics.get("like_count", 0),
            "retweets": metrics.get("retweet_count", 0),
            "replies": metrics.get("reply_count", 0),
        })

    await cache_set(key, tweets, TTL_TWEETS)
    return tweets


async def get_token_tweet_volume(symbol: str, count: int = 10) -> dict[str, Any]:
    """
    Search recent tweets mentioning a token symbol (e.g. "$TRUMP", "$BONK").
    Returns: {tweet_count, sample_tweets, requires_elevated: bool}

    NOTE: Twitter search requires Elevated or Pro API access.
    Basic access returns 403 — we gracefully return empty with a flag.
    """
    if not settings.twitter_bearer_token:
        return {"tweet_count": 0, "sample_tweets": [], "requires_elevated": True}

    clean = symbol.lstrip("$").upper()
    query = f"${clean} lang:en -is:retweet"
    key = f"tw:search:{clean}"
    if cached := await cache_get(key):
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{TWITTER_BASE}/tweets/search/recent",
                headers=_auth_headers(),
                params={
                    "query": query,
                    "max_results": min(count, 10),
                    "tweet.fields": "created_at,public_metrics,author_id,text",
                },
            )
            if resp.status_code in (403, 401):
                # Basic access — search not available
                return {"tweet_count": 0, "sample_tweets": [], "requires_elevated": True}
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"tweet_count": 0, "sample_tweets": [], "requires_elevated": False}

    meta = data.get("meta", {})
    sample = []
    for t in data.get("data", [])[:5]:
        metrics = t.get("public_metrics", {})
        sample.append({
            "tweet_id": t["id"],
            "text": t.get("text", ""),
            "created_at": t.get("created_at"),
            "url": f"https://x.com/i/web/status/{t['id']}",
            "likes": metrics.get("like_count", 0),
            "retweets": metrics.get("retweet_count", 0),
        })

    result = {
        "tweet_count": meta.get("result_count", len(sample)),
        "sample_tweets": sample,
        "requires_elevated": False,
    }
    await cache_set(key, result, TTL_SEARCH)
    return result


async def get_kol_profile_with_tweets(handle: str) -> dict[str, Any] | None:
    """
    Combined fetch: profile + recent tweets in parallel.
    Returns None if handle is empty or API is unavailable.
    """
    if not handle:
        return None

    profile = await get_kol_profile(handle)
    if not profile:
        return None

    tweets = await get_recent_tweets(profile["user_id"], count=5)
    return {**profile, "recent_tweets": tweets}
