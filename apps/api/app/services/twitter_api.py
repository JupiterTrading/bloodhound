"""
BLOODHOUND — Twitter API Integration
Fetches follower counts, recent posts, and profile data for KOLs
"""

import os
import httpx
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.services.redis_cache import cache_get, cache_set

TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")
TWITTER_API_BASE = "https://api.twitter.com/2"


class TwitterProfile(BaseModel):
    id: str
    username: str
    name: str
    description: Optional[str] = None
    profile_image_url: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    tweet_count: int = 0
    verified: bool = False
    created_at: Optional[str] = None


class Tweet(BaseModel):
    id: str
    text: str
    created_at: str
    like_count: int = 0
    retweet_count: int = 0
    reply_count: int = 0
    quote_count: int = 0
    # Extracted token mentions
    token_mentions: List[str] = []


async def get_twitter_profile(username: str) -> Optional[TwitterProfile]:
    """
    Fetch Twitter profile data including follower counts.
    Caches for 1 hour.
    """
    if not TWITTER_BEARER_TOKEN:
        return None
    
    cache_key = f"twitter:profile:{username.lower()}"
    if cached := await cache_get(cache_key):
        return TwitterProfile(**cached)
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{TWITTER_API_BASE}/users/by/username/{username}",
                headers={"Authorization": f"Bearer {TWITTER_BEARER_TOKEN}"},
                params={
                    "user.fields": "description,profile_image_url,public_metrics,verified,created_at"
                },
                timeout=10,
            )
            
            if res.status_code != 200:
                return None
            
            data = res.json().get("data")
            if not data:
                return None
            
            metrics = data.get("public_metrics", {})
            profile = TwitterProfile(
                id=data["id"],
                username=data["username"],
                name=data["name"],
                description=data.get("description"),
                profile_image_url=data.get("profile_image_url", "").replace("_normal", "_400x400"),
                followers_count=metrics.get("followers_count", 0),
                following_count=metrics.get("following_count", 0),
                tweet_count=metrics.get("tweet_count", 0),
                verified=data.get("verified", False),
                created_at=data.get("created_at"),
            )
            
            await cache_set(cache_key, profile.model_dump(), ttl=3600)  # 1 hour cache
            return profile
            
    except Exception as e:
        print(f"Twitter API error for {username}: {e}")
        return None


async def get_recent_tweets(username: str, limit: int = 10) -> List[Tweet]:
    """
    Fetch recent tweets from a user.
    Looks for token mentions ($SYMBOL or contract addresses).
    Caches for 15 minutes.
    """
    if not TWITTER_BEARER_TOKEN:
        return []
    
    cache_key = f"twitter:tweets:{username.lower()}:{limit}"
    if cached := await cache_get(cache_key):
        return [Tweet(**t) for t in cached]
    
    try:
        # First get user ID
        profile = await get_twitter_profile(username)
        if not profile:
            return []
        
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{TWITTER_API_BASE}/users/{profile.id}/tweets",
                headers={"Authorization": f"Bearer {TWITTER_BEARER_TOKEN}"},
                params={
                    "max_results": min(limit, 100),
                    "tweet.fields": "created_at,public_metrics",
                    "exclude": "retweets,replies",
                },
                timeout=10,
            )
            
            if res.status_code != 200:
                return []
            
            data = res.json().get("data", [])
            tweets = []
            
            for t in data:
                metrics = t.get("public_metrics", {})
                
                # Extract token mentions ($SYMBOL patterns)
                import re
                token_mentions = re.findall(r'\$([A-Z]{2,10})', t["text"].upper())
                
                tweets.append(Tweet(
                    id=t["id"],
                    text=t["text"],
                    created_at=t["created_at"],
                    like_count=metrics.get("like_count", 0),
                    retweet_count=metrics.get("retweet_count", 0),
                    reply_count=metrics.get("reply_count", 0),
                    quote_count=metrics.get("quote_count", 0),
                    token_mentions=token_mentions,
                ))
            
            await cache_set(cache_key, [t.model_dump() for t in tweets], ttl=900)  # 15 min cache
            return tweets
            
    except Exception as e:
        print(f"Twitter API error fetching tweets for {username}: {e}")
        return []


async def get_kol_social_stats(username: str) -> dict:
    """
    Get combined social stats for a KOL.
    Returns profile + recent tweets with token mentions.
    """
    profile = await get_twitter_profile(username)
    tweets = await get_recent_tweets(username, limit=20)
    
    # Aggregate token mentions
    token_mention_counts = {}
    for tweet in tweets:
        for token in tweet.token_mentions:
            token_mention_counts[token] = token_mention_counts.get(token, 0) + 1
    
    # Sort by mention count
    top_tokens = sorted(token_mention_counts.items(), key=lambda x: -x[1])[:10]
    
    return {
        "profile": profile.model_dump() if profile else None,
        "recent_tweets": [t.model_dump() for t in tweets[:5]],
        "top_token_mentions": top_tokens,
        "total_engagement": sum(t.like_count + t.retweet_count for t in tweets),
    }
