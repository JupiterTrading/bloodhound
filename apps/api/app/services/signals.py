"""
Signal detection engine — US-B402 / US-B403.
Analyzes parsed transaction batches and produces signal rows for ClickHouse.
Runs after each poller sweep (and can run after webhook ingest).

Signal types:
  large_transfer        — SOL > 1000 OR USD > $50k          [PROBABLE]
  new_wallet_funded     — fresh wallet receives first SOL    [SUSPECTED]
  known_wallet_active   — known labeled entity seen in tx   [CONFIRMED]
  exchange_withdrawal   — known CEX sends to unknown wallet  [PROBABLE]
  multiple_sends        — 1 sender → 5+ recipients in batch [SUSPECTED]
  kol_pre_buy           — KOL bought token before tweeting  [CONFIRMED]
"""

import json
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from app.services import supabase as supabase_svc

# Detection thresholds
LARGE_SOL_THRESHOLD = 1_000.0
LARGE_USD_THRESHOLD = 50_000.0
FAN_OUT_THRESHOLD = 5
KOL_PRE_BUY_WINDOW_HOURS = 24  # tweet must come within 24h after the buy


async def detect_signals(
    transfer_rows: list[dict[str, Any]],
    wallet_address: str,
) -> list[dict[str, Any]]:
    """
    Run all detectors against a batch of transfers for one wallet.
    Returns signal dicts ready for ClickHouse insert.
    """
    if not transfer_rows:
        return []

    signals: list[dict[str, Any]] = []
    signals.extend(await _check_large_transfers(transfer_rows, wallet_address))
    signals.extend(await _check_new_wallet_funded(transfer_rows))
    signals.extend(await _check_known_wallet_active(transfer_rows))
    signals.extend(await _check_exchange_withdrawal(transfer_rows))
    signals.extend(_check_fan_out(transfer_rows))
    signals.extend(await _check_kol_pre_buy(transfer_rows, wallet_address))
    return signals


# ---------------------------------------------------------------------------
# Individual detectors
# ---------------------------------------------------------------------------

def _make_signal(
    signal_type: str,
    confidence: str,
    wallet_address: str,
    description: str,
    tx_signature: str = "",
    token_mint: str = "",
    scope: str = "global",
    metadata: dict | None = None,
) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "detected_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "signal_type": signal_type,
        "confidence": confidence,
        "scope": scope,
        "wallet_address": wallet_address,
        "token_mint": token_mint,
        "tx_signature": tx_signature,
        "description": description,
        "metadata": json.dumps(metadata or {}, default=str),
    }


async def _check_large_transfers(
    transfers: list[dict], wallet_address: str
) -> list[dict]:
    signals = []
    for t in transfers:
        amount = float(t.get("amount", 0))
        amount_usd = float(t.get("amount_usd", 0))
        mint = t.get("token_mint", "")

        is_large_sol = mint == "SOL" and amount >= LARGE_SOL_THRESHOLD
        is_large_usd = amount_usd >= LARGE_USD_THRESHOLD

        if not (is_large_sol or is_large_usd):
            continue

        label = f"{amount:,.0f} SOL" if mint == "SOL" else f"${amount_usd:,.0f}"
        signals.append(_make_signal(
            signal_type="large_transfer",
            confidence="PROBABLE",
            wallet_address=wallet_address,
            description=f"Large transfer: {label} from {t.get('from_address','')[:8]}... → {t.get('to_address','')[:8]}...",
            tx_signature=t.get("tx_signature", ""),
            token_mint=mint,
            metadata={
                "amount": amount,
                "amount_usd": amount_usd,
                "from_address": t.get("from_address"),
                "to_address": t.get("to_address"),
            },
        ))
    return signals


async def _check_new_wallet_funded(transfers: list[dict]) -> list[dict]:
    """Fresh wallet (≤1 prior tx) receives ≥0.1 SOL."""
    signals = []
    sol_inflows = [
        t for t in transfers
        if t.get("token_mint") == "SOL" and float(t.get("amount", 0)) >= 0.1
    ]
    for t in sol_inflows:
        to_addr = t.get("to_address", "")
        if not to_addr:
            continue
        try:
            from app.services.analytics import get_wallet_stats
            stats = await get_wallet_stats(to_addr, days=3650)
            if int(stats.get("total_txs", 0)) <= 1:
                signals.append(_make_signal(
                    signal_type="new_wallet_funded",
                    confidence="SUSPECTED",
                    wallet_address=to_addr,
                    description=f"New wallet funded: {float(t.get('amount',0)):.2f} SOL from {t.get('from_address','')[:8]}...",
                    tx_signature=t.get("tx_signature", ""),
                    metadata={
                        "amount_sol": float(t.get("amount", 0)),
                        "funder": t.get("from_address"),
                    },
                ))
        except Exception:
            pass
    return signals


async def _check_known_wallet_active(transfers: list[dict]) -> list[dict]:
    """Known labeled entity appears in a transfer (either side)."""
    signals = []
    checked: set[str] = set()
    for t in transfers:
        for role, addr in [("sender", t.get("from_address","")), ("receiver", t.get("to_address",""))]:
            if not addr or addr in checked:
                continue
            checked.add(addr)
            try:
                known = await supabase_svc.get_known_wallet(addr)
                if known and known.get("status") == "approved":
                    signals.append(_make_signal(
                        signal_type="known_wallet_active",
                        confidence="CONFIRMED",
                        wallet_address=addr,
                        description=f"{known['label']} ({known['category']}) active as {role}: {float(t.get('amount',0)):.2f} {t.get('token_mint','')}",
                        tx_signature=t.get("tx_signature", ""),
                        token_mint=t.get("token_mint", ""),
                        metadata={
                            "label": known["label"],
                            "category": known["category"],
                            "role": role,
                            "amount": float(t.get("amount", 0)),
                        },
                    ))
            except Exception:
                pass
    return signals


async def _check_exchange_withdrawal(transfers: list[dict]) -> list[dict]:
    """Known CEX/exchange sends SOL to an unknown wallet."""
    signals = []
    for t in transfers:
        if t.get("token_mint") != "SOL":
            continue
        from_addr = t.get("from_address", "")
        if not from_addr:
            continue
        try:
            known = await supabase_svc.get_known_wallet(from_addr)
            if known and known.get("category") in ("exchange", "cex"):
                to_addr = t.get("to_address", "")
                signals.append(_make_signal(
                    signal_type="exchange_withdrawal",
                    confidence="PROBABLE",
                    wallet_address=to_addr,
                    description=f"Exchange withdrawal: {known['label']} → {to_addr[:8]}... ({float(t.get('amount',0)):.2f} SOL)",
                    tx_signature=t.get("tx_signature", ""),
                    metadata={
                        "exchange": known["label"],
                        "exchange_address": from_addr,
                        "to_address": to_addr,
                        "amount_sol": float(t.get("amount", 0)),
                    },
                ))
        except Exception:
            pass
    return signals


def _check_fan_out(transfers: list[dict]) -> list[dict]:
    """One sender → 5+ distinct recipients in the same batch."""
    signals = []
    by_sender: dict[str, set[str]] = defaultdict(set)
    sender_sig: dict[str, str] = {}
    for t in transfers:
        s, r = t.get("from_address",""), t.get("to_address","")
        if s and r:
            by_sender[s].add(r)
            sender_sig.setdefault(s, t.get("tx_signature",""))

    for sender, recipients in by_sender.items():
        if len(recipients) >= FAN_OUT_THRESHOLD:
            signals.append(_make_signal(
                signal_type="multiple_sends",
                confidence="SUSPECTED",
                wallet_address=sender,
                description=f"Fan-out: {sender[:8]}... sent to {len(recipients)} different wallets in one sweep",
                tx_signature=sender_sig.get(sender, ""),
                metadata={"recipient_count": len(recipients), "recipients": list(recipients)[:20]},
            ))
    return signals


async def _check_kol_pre_buy(
    transfers: list[dict],
    wallet_address: str,
) -> list[dict]:
    """
    KOL pre-buy signal — US-B503.
    Checks if the wallet is a known KOL (has twitter_handle), then looks for token
    trades in this batch and cross-references against the KOL's recent tweets.

    Pattern: KOL bought $TOKEN at time T, then tweeted "$TOKEN" within KOL_PRE_BUY_WINDOW_HOURS.
    Confidence: CONFIRMED when tweet timestamp > buy timestamp by <24h.

    Note: Only fires when Twitter Elevated API access is available (search endpoint).
    """
    signals: list[dict] = []
    try:
        known = await supabase_svc.get_known_wallet(wallet_address)
        if not known or not known.get("twitter_handle") or known.get("category") not in ("kol", "fund"):
            return []

        twitter_handle = known["twitter_handle"]

        # Collect token mints bought in this batch (from_address = wallet = seller of SOL)
        # In trades: wallet sold SOL to buy token → token_out_mint is what they received
        bought_mints: dict[str, dict] = {}  # mint → {amount, tx_signature, block_time}
        for t in transfers:
            if (
                t.get("from_address") == wallet_address
                and t.get("token_mint") != "SOL"
                and float(t.get("amount_usd", 0)) > 100  # min $100 buy to reduce noise
            ):
                mint = t["token_mint"]
                if mint not in bought_mints:
                    bought_mints[mint] = {
                        "amount_usd": float(t.get("amount_usd", 0)),
                        "tx_signature": t.get("tx_signature", ""),
                        "block_time": t.get("block_time"),
                    }

        if not bought_mints:
            return []

        # Fetch KOL's recent tweets
        from app.services.twitter import get_kol_profile, get_recent_tweets
        profile = await get_kol_profile(twitter_handle)
        if not profile:
            return []

        tweets = await get_recent_tweets(profile["user_id"], count=10)
        if not tweets:
            return []

        # Cross-reference: did any tweet mention a bought token after the buy?
        for tweet in tweets:
            tweet_text = tweet.get("text", "").upper()
            tweet_time_str = tweet.get("created_at")
            if not tweet_time_str:
                continue

            from datetime import timezone
            tweet_time = datetime.fromisoformat(tweet_time_str.replace("Z", "+00:00"))

            for mint, buy_info in bought_mints.items():
                buy_time = buy_info.get("block_time")
                if not buy_time:
                    continue

                # Normalise buy_time
                if isinstance(buy_time, str):
                    buy_time = datetime.fromisoformat(buy_time.replace("Z", "+00:00"))
                elif hasattr(buy_time, "tzinfo") and buy_time.tzinfo is None:
                    buy_time = buy_time.replace(tzinfo=timezone.utc)

                # Tweet must be AFTER the buy and within the window
                delta_hours = (tweet_time - buy_time).total_seconds() / 3600
                if not (0 <= delta_hours <= KOL_PRE_BUY_WINDOW_HOURS):
                    continue

                # Check if tweet mentions this token (by symbol fragment or mint prefix)
                mint_prefix = mint[:8].upper()
                if mint_prefix not in tweet_text and "$" not in tweet_text:
                    continue

                # Strong enough match
                signals.append(_make_signal(
                    signal_type="kol_pre_buy",
                    confidence="CONFIRMED",
                    wallet_address=wallet_address,
                    token_mint=mint,
                    tx_signature=buy_info["tx_signature"],
                    description=(
                        f"KOL pre-buy: {known['label']} (@{twitter_handle}) bought "
                        f"${buy_info['amount_usd']:,.0f} of {mint[:8]}... "
                        f"then tweeted {delta_hours:.1f}h later"
                    ),
                    metadata={
                        "kol_label": known["label"],
                        "twitter_handle": twitter_handle,
                        "tweet_id": tweet.get("tweet_id"),
                        "tweet_url": tweet.get("url"),
                        "tweet_text": tweet.get("text", "")[:200],
                        "hours_before_tweet": round(delta_hours, 2),
                        "buy_amount_usd": buy_info["amount_usd"],
                        "mint": mint,
                    },
                ))
                break  # one signal per tweet is enough

    except Exception:
        pass

    return signals
