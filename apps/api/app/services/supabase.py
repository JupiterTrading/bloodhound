"""
Supabase client — operational data: users, tracked wallets, known wallets, classifications, alerts.
Uses the service role key (server-side only — never expose to client).
"""

from functools import lru_cache
from typing import Any

from supabase import create_client, Client
from app.core.config import get_settings

settings = get_settings()


@lru_cache()
def get_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# ---------------------------------------------------------------------------
# Known Wallets
# ---------------------------------------------------------------------------

async def get_known_wallet(address: str) -> dict[str, Any] | None:
    """Check if address is an approved known wallet. Returns label/category or None."""
    client = get_client()
    result = (
        client.table("known_wallets")
        .select("label,category,description,twitter_handle,telegram_handle,confidence")
        .eq("address", address)
        .eq("status", "approved")
        .maybe_single()
        .execute()
    )
    return result.data


async def list_known_wallets(
    category: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Return a list of approved known wallets, optionally filtered by category."""
    client = get_client()
    query = (
        client.table("known_wallets")
        .select("address,label,category,description,twitter_handle,confidence")
        .eq("status", "approved")
        .order("confidence", desc=True)
        .limit(limit)
    )
    if category:
        query = query.eq("category", category)
    result = query.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Wallet Classifications (cache layer)
# ---------------------------------------------------------------------------

async def get_wallet_classification(address: str) -> dict[str, Any] | None:
    """Fetch cached classification. Returns None if missing or expired."""
    from datetime import datetime, timezone

    client = get_client()
    result = (
        client.table("wallet_classifications")
        .select("labels,confidence,signals,computed_at,expires_at")
        .eq("address", address)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None

    expires_at = result.data.get("expires_at")
    if expires_at:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            return None

    return result.data


async def save_wallet_classification(
    address: str,
    labels: list[str],
    confidence: dict[str, float],
    signals: dict[str, Any],
    expires_hours: int = 24,
) -> None:
    """Upsert wallet classification cache."""
    from datetime import datetime, timezone, timedelta

    client = get_client()
    now = datetime.now(timezone.utc)
    client.table("wallet_classifications").upsert(
        {
            "address": address,
            "labels": labels,
            "confidence": confidence,
            "signals": signals,
            "computed_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=expires_hours)).isoformat(),
        },
        on_conflict="address",
    ).execute()


# ---------------------------------------------------------------------------
# Side Wallet Candidates
# ---------------------------------------------------------------------------

async def get_side_wallet_candidates(
    address: str, min_confidence: float = 0.5
) -> list[dict[str, Any]]:
    """Get suspected side wallets above the confidence threshold."""
    client = get_client()
    result_a = (
        client.table("side_wallet_candidates")
        .select("*")
        .eq("wallet_a", address)
        .gte("confidence", min_confidence)
        .execute()
    )
    result_b = (
        client.table("side_wallet_candidates")
        .select("*")
        .eq("wallet_b", address)
        .gte("confidence", min_confidence)
        .execute()
    )
    candidates: list[dict[str, Any]] = []
    for row in result_a.data or []:
        candidates.append({**row, "related_address": row["wallet_b"]})
    for row in result_b.data or []:
        candidates.append({**row, "related_address": row["wallet_a"]})
    return candidates


async def upsert_side_wallet_candidate(
    wallet_a: str,
    wallet_b: str,
    confidence: float,
    signals: list[str],
    signal_weights: dict[str, float],
) -> None:
    """Insert or update a side wallet candidate pair (normalized order)."""
    if wallet_a > wallet_b:
        wallet_a, wallet_b = wallet_b, wallet_a
    client = get_client()
    client.table("side_wallet_candidates").upsert(
        {
            "wallet_a": wallet_a,
            "wallet_b": wallet_b,
            "confidence": confidence,
            "signals": signals,
            "signal_weights": signal_weights,
        },
        on_conflict="wallet_a,wallet_b",
    ).execute()


# ---------------------------------------------------------------------------
# Tracker Count
# ---------------------------------------------------------------------------

async def get_tracker_count(address: str) -> int:
    """How many users are tracking this wallet address."""
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .select("id", count="exact")
        .eq("address", address)
        .execute()
    )
    return result.count or 0


# ---------------------------------------------------------------------------
# Tracked Wallets
# ---------------------------------------------------------------------------

async def get_user_tracked_wallets(user_id: str) -> list[dict[str, Any]]:
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .select("*, wallet_groups(name)")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


async def add_tracked_wallet(
    user_id: str,
    address: str,
    label: str,
    group_id: str | None = None,
    is_own: bool = False,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .insert(
            {
                "user_id": user_id,
                "address": address,
                "label": label,
                "group_id": group_id,
                "is_own": is_own,
                "tags": tags or [],
            }
        )
        .execute()
    )
    return result.data[0]


async def update_tracked_wallet(
    user_id: str, address: str, updates: dict[str, Any]
) -> dict[str, Any] | None:
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .update(updates)
        .eq("user_id", user_id)
        .eq("address", address)
        .execute()
    )
    return result.data[0] if result.data else None


async def delete_tracked_wallet(user_id: str, address: str) -> bool:
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .delete()
        .eq("user_id", user_id)
        .eq("address", address)
        .execute()
    )
    return bool(result.data)


async def count_trackers_for_wallet(address: str) -> int:
    """Count how many users (across all users) are tracking a given address."""
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .select("address", count="exact")
        .eq("address", address)
        .execute()
    )
    return result.count or 0


async def get_all_tracked_wallet_addresses() -> list[str]:
    """
    Return distinct wallet addresses tracked by any user.
    Used by the background polling service to know what to poll.
    """
    client = get_client()
    result = client.table("tracked_wallets").select("address").execute()
    seen: set[str] = set()
    addresses: list[str] = []
    for row in result.data or []:
        addr = row.get("address")
        if addr and addr not in seen:
            seen.add(addr)
            addresses.append(addr)
    return addresses


async def get_own_wallets(user_id: str) -> list[dict[str, Any]]:
    """Return tracked wallets where is_own=True for a user (their personal wallets)."""
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .select("address,label,tags,created_at")
        .eq("user_id", user_id)
        .eq("is_own", True)
        .order("created_at")
        .execute()
    )
    return result.data or []


async def get_kol_addresses() -> list[str]:
    """Return all approved KOL wallet addresses from known_wallets."""
    client = get_client()
    result = (
        client.table("known_wallets")
        .select("address")
        .eq("status", "approved")
        .eq("category", "kol")
        .execute()
    )
    return [row["address"] for row in (result.data or [])]


async def count_user_tracked_wallets(user_id: str) -> int:
    client = get_client()
    result = (
        client.table("tracked_wallets")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    return result.count or 0


async def count_user_groups(user_id: str) -> int:
    client = get_client()
    result = (
        client.table("wallet_groups")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    return result.count or 0


# ---------------------------------------------------------------------------
# Wallet Groups
# ---------------------------------------------------------------------------

async def get_user_groups(user_id: str) -> list[dict[str, Any]]:
    client = get_client()
    result = (
        client.table("wallet_groups")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


async def create_group(user_id: str, name: str) -> dict[str, Any]:
    client = get_client()
    result = (
        client.table("wallet_groups")
        .insert({"user_id": user_id, "name": name})
        .execute()
    )
    return result.data[0]


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

async def get_user_alerts(user_id: str) -> list[dict[str, Any]]:
    client = get_client()
    result = (
        client.table("alerts")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


async def get_active_alerts_for_wallet(wallet_address: str) -> list[dict[str, Any]]:
    """All active alert rules that watch this wallet address."""
    client = get_client()
    result = (
        client.table("alerts")
        .select("*")
        .eq("wallet_address", wallet_address)
        .eq("is_active", True)
        .execute()
    )
    return result.data or []


async def create_alert(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    client = get_client()
    result = (
        client.table("alerts")
        .insert({"user_id": user_id, **data})
        .execute()
    )
    return result.data[0]


async def update_alert(
    user_id: str, alert_id: str, updates: dict[str, Any]
) -> dict[str, Any] | None:
    client = get_client()
    result = (
        client.table("alerts")
        .update(updates)
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def delete_alert(user_id: str, alert_id: str) -> bool:
    client = get_client()
    result = (
        client.table("alerts")
        .delete()
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(result.data)


async def count_user_alerts(user_id: str) -> int:
    client = get_client()
    result = (
        client.table("alerts")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    return result.count or 0


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def get_or_create_user(
    clerk_id: str, email: str | None = None, display_name: str | None = None
) -> dict[str, Any]:
    """Sync Clerk user into our users table on first sign-in."""
    client = get_client()
    existing = (
        client.table("users")
        .select("*")
        .eq("id", clerk_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        return existing.data

    result = (
        client.table("users")
        .insert(
            {
                "id": clerk_id,
                "email": email,
                "display_name": display_name,
                "tier": "free",
            }
        )
        .execute()
    )
    return result.data[0]


async def get_user_tier(user_id: str) -> str:
    """Return 'free' | 'pro' | 'enterprise'."""
    client = get_client()
    result = (
        client.table("users")
        .select("tier")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return (result.data or {}).get("tier", "free")


# ---------------------------------------------------------------------------
# Known Events  (US-B604)
# ---------------------------------------------------------------------------

async def list_events(
    category: str | None = None,
    significance: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """List published known events, newest first."""
    client = get_client()
    query = (
        client.table("known_events")
        .select("id,slug,title,category,significance,occurred_at,token_symbol,token_mint,description")
        .eq("is_published", True)
        .order("occurred_at", desc=True)
        .limit(limit)
    )
    if category:
        query = query.eq("category", category)
    if significance:
        query = query.eq("significance", significance)
    result = query.execute()
    return result.data or []


async def get_event_by_slug(slug: str) -> dict[str, Any] | None:
    """Get a single event with its involved wallets."""
    client = get_client()
    result = (
        client.table("known_events")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", True)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None

    event = result.data

    # Fetch involved wallets
    wallets_result = (
        client.table("event_wallets")
        .select("address,role,description,amount_usd")
        .eq("event_id", event["id"])
        .order("amount_usd", desc=True)
        .execute()
    )
    event["wallets"] = wallets_result.data or []
    return event


async def validate_api_key(key_hash: str) -> dict | None:
    """
    Look up an API key by its SHA-256 hash.
    Returns {"id": ..., "user_id": ...} or None.
    Used by the rate-limit middleware to authenticate bh_* bearer tokens.
    """
    client = get_client()
    try:
        result = (
            client.table("api_keys")
            .select("id,user_id")
            .eq("key_hash", key_hash)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None
    except Exception:
        return None


async def touch_api_key(key_id: str) -> None:
    """Update last_used_at for an API key. Fire-and-forget."""
    from datetime import datetime, timezone
    client = get_client()
    try:
        client.table("api_keys").update(
            {"last_used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", key_id).execute()
    except Exception:
        pass


async def add_dispute(
    wallet_address: str, related_address: str, user_id: str
) -> bool:
    """
    Insert a dispute for a side-wallet pair. Ignores duplicates.
    Returns True if inserted, False if already exists.
    """
    client = get_client()
    try:
        client.table("side_wallet_disputes").insert(
            {
                "wallet_address": wallet_address,
                "related_address": related_address,
                "user_id": user_id,
            }
        ).execute()
        return True
    except Exception:
        return False


async def get_dispute_count(wallet_address: str, related_address: str) -> int:
    """Count distinct user disputes for a side-wallet pair."""
    client = get_client()
    result = (
        client.table("side_wallet_disputes")
        .select("id", count="exact")
        .eq("wallet_address", wallet_address)
        .eq("related_address", related_address)
        .execute()
    )
    return result.count or 0


async def get_wallet_events(address: str) -> list[dict[str, Any]]:
    """Return events that a wallet was involved in (US-B606)."""
    client = get_client()
    result = (
        client.table("event_wallets")
        .select("role,description,amount_usd,known_events(slug,title,category,significance,occurred_at,token_symbol)")
        .eq("address", address)
        .execute()
    )
    rows = result.data or []
    # Flatten: merge event fields into the row
    out = []
    for row in rows:
        event = row.pop("known_events", {}) or {}
        out.append({**event, **row})
    return out
