"""
Bloodhound AI pipeline.
Intent classifier (haiku) → Context injector → Tool loop (sonnet) → Response formatter.
"""

import json
import re
from typing import Any

import anthropic

from app.core.config import get_settings
from app.services import clickhouse, supabase as supabase_svc

settings = get_settings()

# ---------------------------------------------------------------------------
# Tool definitions (Anthropic tool_use format)
# ---------------------------------------------------------------------------

BLOODHOUND_TOOLS: list[dict] = [
    {
        "name": "check_transfers",
        "description": (
            "Check if wallet A has ever sent SOL or tokens to wallet B. "
            "Returns transfer count, total SOL sent, last transfer date, and up to 10 evidence tx signatures."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "from_address": {"type": "string", "description": "Sender wallet address"},
                "to_address": {"type": "string", "description": "Receiver wallet address"},
                "min_amount_sol": {"type": "number", "default": 0.1, "description": "Minimum SOL amount"},
                "time_from": {"type": "string", "nullable": True, "description": "ISO datetime filter start"},
                "time_to": {"type": "string", "nullable": True, "description": "ISO datetime filter end"},
            },
            "required": ["from_address", "to_address"],
        },
    },
    {
        "name": "trace_funding",
        "description": (
            "Trace the original funding source of a wallet. "
            "Follows the first SOL transfer received, hop by hop, up to max_hops deep. "
            "Stops early if a known entity is found."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string"},
                "max_hops": {"type": "integer", "default": 3, "minimum": 1, "maximum": 5},
            },
            "required": ["address"],
        },
    },
    {
        "name": "get_wallet_summary",
        "description": "Get behavioral stats, classification labels, and known identity for a wallet.",
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string"},
                "days_back": {"type": "integer", "default": 90},
            },
            "required": ["address"],
        },
    },
    {
        "name": "get_relationships",
        "description": "Get the top counterparties (wallets this address interacts with most).",
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string"},
                "limit": {"type": "integer", "default": 10, "maximum": 20},
            },
            "required": ["address"],
        },
    },
    {
        "name": "get_leaderboard",
        "description": (
            "Get the top performing wallets (KOLs, known traders) ranked by portfolio value or realized PnL. "
            "Use for questions like: 'top 5 traders today', 'best KOL performers this week', "
            "'who made the most money on Solana', 'top traders by PnL'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["kol", "profitable_trader", "all"],
                    "default": "kol",
                    "description": "kol = key opinion leaders / known names; profitable_trader = volume-ranked DEX traders; all = both",
                },
                "timeframe": {
                    "type": "string",
                    "enum": ["1d", "7d", "30d"],
                    "default": "1d",
                    "description": "Performance window: 1d = today, 7d = this week, 30d = this month",
                },
                "limit": {
                    "type": "integer",
                    "default": 10,
                    "minimum": 5,
                    "maximum": 50,
                    "description": "Number of wallets to return",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_trending_tokens",
        "description": (
            "Get currently trending tokens on Solana DEXes by trade count and momentum. "
            "Use for: 'what tokens are trending', 'hot tokens right now', "
            "'what are people trading today', 'biggest movers'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "default": 10,
                    "minimum": 5,
                    "maximum": 20,
                },
                "sort_type": {
                    "type": "string",
                    "enum": ["trending", "gainers", "losers"],
                    "default": "trending",
                    "description": "trending = by trade activity; gainers = top % price gain; losers = top % price drop",
                },
            },
            "required": [],
        },
    },
    {
        "name": "take_action",
        "description": (
            "Take an agentic action in the app on behalf of the user. "
            "Use when the user says: 'track this wallet', 'alert me when...', 'show me the graph', 'export CSV'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action_type": {
                    "type": "string",
                    "enum": ["track_wallet", "set_alert", "add_label", "open_graph", "export_csv"],
                },
                "parameters": {
                    "type": "object",
                    "description": "Action-specific parameters (e.g. address, label, alert conditions)",
                },
            },
            "required": ["action_type", "parameters"],
        },
    },
]


# ---------------------------------------------------------------------------
# Intent classifier
# ---------------------------------------------------------------------------

async def classify_intent(query: str) -> str:
    """
    Quick haiku call to classify query intent.
    Returns one of the valid intent categories.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=20,
        system=(
            "Classify the following query into exactly one category:\n"
            "relationship_query | wallet_summary | fund_trace | token_query | leaderboard_query | event_query | entity_lookup | agentic_action | unknown\n"
            "Use leaderboard_query for: top traders, best performers, who made money, KOL rankings, trending tokens.\n"
            "Use event_query for: historical Solana events — Libra, $TRUMP launch, $DJT, $BONK, FTX, specific coin launches or scandals.\n"
            "Use entity_lookup for: 'who is [person]', 'what is [project/protocol]', 'tell me about [KOL name]', background on any crypto entity.\n"
            "Respond with only the category name, nothing else."
        ),
        messages=[{"role": "user", "content": query}],
    )
    text = response.content[0].text.strip().lower()
    valid = {
        "relationship_query", "wallet_summary", "fund_trace",
        "token_query", "leaderboard_query", "event_query", "entity_lookup",
        "agentic_action", "unknown",
    }
    return text if text in valid else "unknown"


# ---------------------------------------------------------------------------
# Tool executor
# ---------------------------------------------------------------------------

async def execute_tool(name: str, inputs: dict[str, Any]) -> dict[str, Any]:
    """Dispatch a tool call to the appropriate data layer."""
    if name == "check_transfers":
        import asyncio as _asyncio
        from app.services.redis_cache import cache_get as _cg, cache_set as _cs
        from app.services.wallet_poller import backfill_wallet_and_sides
        from app.services.clustering import run_clustering_for_wallet as _rcfw
        for _addr in (inputs["from_address"], inputs["to_address"]):
            _bfk = f"bh:backfill:{_addr}"
            _cfk = f"bh:cluster:{_addr}"
            if not await _cg(_bfk):
                await _cs(_bfk, 1, 86400)
                await _cs(_cfk, 1, 3600)
                _asyncio.create_task(backfill_wallet_and_sides(_addr))
            elif not await _cg(_cfk):
                await _cs(_cfk, 1, 3600)
                _asyncio.create_task(_rcfw(_addr))
        return await clickhouse.check_transfers_between(
            from_addr=inputs["from_address"],
            to_addr=inputs["to_address"],
            min_amount_sol=inputs.get("min_amount_sol", 0.1),
            date_from=inputs.get("time_from"),
            date_to=inputs.get("time_to"),
        )

    elif name == "trace_funding":
        return await _trace_funding(
            address=inputs["address"],
            max_hops=inputs.get("max_hops", 3),
        )

    elif name == "get_wallet_summary":
        from app.services.classification import classify_wallet
        import asyncio as _asyncio
        from app.services.redis_cache import cache_get as _cg, cache_set as _cs

        address = inputs["address"]
        _bfk = f"bh:backfill:{address}"
        _cfk = f"bh:cluster:{address}"
        if not await _cg(_bfk):
            await _cs(_bfk, 1, 86400)
            await _cs(_cfk, 1, 3600)
            from app.services.wallet_poller import backfill_wallet_and_sides
            _asyncio.create_task(backfill_wallet_and_sides(address))
        elif not await _cg(_cfk):
            await _cs(_cfk, 1, 3600)
            from app.services.clustering import run_clustering_for_wallet as _rcfw
            _asyncio.create_task(_rcfw(address))

        stats, known, cls = await _gather(
            clickhouse.get_wallet_stats(address, inputs.get("days_back", 90)),
            supabase_svc.get_known_wallet(address),
            classify_wallet(address),
        )
        return {
            "stats": stats,
            "known_wallet": known,
            "classification": (cls or {}).get("labels", []),
            "confidence": (cls or {}).get("confidence", {}),
        }

    elif name == "get_relationships":
        counterparties = await clickhouse.get_top_counterparties(
            inputs["address"], limit=inputs.get("limit", 10)
        )
        return {"counterparties": counterparties}

    elif name == "get_leaderboard":
        from app.routers.leaderboard import _batch_portfolio, _batch_pnl_from_clickhouse
        from app.services import supabase as _sb

        category = inputs.get("category", "kol")
        timeframe = inputs.get("timeframe", "1d")
        limit = inputs.get("limit", 10)

        db_category = None if category == "all" else category
        wallets = await _sb.list_known_wallets(category=db_category, limit=limit * 2)
        addresses = [w["address"] for w in wallets[:limit]]
        portfolio_map = await _batch_portfolio(addresses)
        pnl_map = await _batch_pnl_from_clickhouse(addresses, timeframe)

        entries = []
        for w in wallets[:limit]:
            addr = w["address"]
            port = portfolio_map.get(addr, {})
            pnl = pnl_map.get(addr, {})
            entries.append({
                "address": addr,
                "label": w.get("label"),
                "twitter_handle": w.get("twitter_handle"),
                "portfolio_usd": port.get("total_usd"),
                "realized_pnl_usd": pnl.get("realized_pnl_usd"),
                "trade_count": pnl.get("trade_count"),
                "win_rate": pnl.get("win_rate"),
            })

        def _sort(e):
            if e["realized_pnl_usd"] is not None:
                return e["realized_pnl_usd"]
            return e["portfolio_usd"] or 0

        entries.sort(key=_sort, reverse=True)
        for i, e in enumerate(entries, 1):
            e["rank"] = i

        return {
            "category": category,
            "timeframe": timeframe,
            "entries": entries,
            "metric": "realized_pnl_usd" if any(e["realized_pnl_usd"] is not None for e in entries) else "portfolio_usd",
        }

    elif name == "get_trending_tokens":
        from app.services import birdeye as _birdeye

        sort_type = inputs.get("sort_type", "trending")
        limit = inputs.get("limit", 10)

        if sort_type == "trending":
            tokens = await _birdeye.get_trending_tokens(limit=limit)
        elif sort_type in ("gainers", "losers"):
            tokens = await _birdeye.get_gainers_losers(
                timeframe="24h", limit=limit, sort_type=sort_type
            )
        else:
            tokens = await _birdeye.get_trending_tokens(limit=limit)

        return {"tokens": tokens, "sort_type": sort_type}

    elif name == "take_action":
        # Returned to frontend for execution; no server-side effect here
        return {"status": "queued", "action_type": inputs["action_type"]}

    else:
        return {"error": f"Unknown tool: {name}"}


async def _trace_funding(address: str, max_hops: int) -> dict[str, Any]:
    """Hop-by-hop funding trace: follow first SOL received, stop at known entity."""
    import asyncio as _asyncio
    client = clickhouse.get_client()
    trail: list[dict] = []
    current = address

    for hop in range(max_hops):
        result = await _asyncio.to_thread(
            client.query,
            """
            SELECT from_address, amount, tx_signature, block_time
            FROM transfers
            WHERE to_address = {address:String}
              AND token_mint = 'SOL'
            ORDER BY block_time ASC
            LIMIT 1
            """,
            parameters={"address": current},
        )
        if not result.result_rows:
            break

        row = result.result_rows[0]
        funder, amount, sig, block_time = row[0], float(row[1] or 0), row[2], str(row[3])
        known = await _safe(supabase_svc.get_known_wallet(funder))

        trail.append(
            {
                "hop": hop + 1,
                "address": funder,
                "known_label": (known or {}).get("label"),
                "known_category": (known or {}).get("category"),
                "amount_sol": round(amount, 4),
                "tx_signature": sig,
                "block_time": block_time,
            }
        )
        if known:
            break  # Found a known entity — trail is complete
        current = funder

    return {"address": address, "trail": trail, "depth": len(trail)}


# ---------------------------------------------------------------------------
# Main AI query pipeline
# ---------------------------------------------------------------------------

async def run_bloodhound_ai(
    query: str,
    session_id: str,
    context: dict[str, Any],
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Full Bloodhound AI pipeline.
    Returns: {answer, numbers, evidence, confidence, viz_type, actions}
    """
    tracked_wallets: list[dict] = context.get("tracked_wallets", [])
    label_map = {w["label"].lower(): w["address"] for w in tracked_wallets}

    # Resolve labels to addresses in the query
    resolved_query = query
    for label, address in label_map.items():
        resolved_query = re.sub(re.escape(label), address, resolved_query, flags=re.IGNORECASE)

    system_prompt = _build_system_prompt(label_map)

    # Build message history: prepend prior exchanges for multi-turn context
    prior: list[dict] = context.get("prior_messages", [])
    # Resolve labels in prior assistant messages too
    resolved_prior: list[dict] = []
    for msg in prior:
        content = msg["content"]
        if msg["role"] == "user":
            for lbl, addr in label_map.items():
                content = re.sub(re.escape(lbl), addr, content, flags=re.IGNORECASE)
        resolved_prior.append({"role": msg["role"], "content": content})

    messages: list[dict] = [*resolved_prior, {"role": "user", "content": resolved_query}]
    actions: list[dict] = []
    evidence: list[dict] = []

    ai_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    max_iterations = 5
    answer_text = ""

    # Native Anthropic web_search tool — Anthropic executes it server-side, no executor needed
    all_tools = [{"type": "web_search_20250305"}, *BLOODHOUND_TOOLS]

    for _ in range(max_iterations):
        response = await ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=system_prompt,
            tools=all_tools,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    answer_text = block.text
            break

        if response.stop_reason == "tool_use":
            tool_calls = [b for b in response.content if b.type == "tool_use"]
            tool_results: list[dict] = []

            for tool_call in tool_calls:
                result = await execute_tool(tool_call.name, tool_call.input)

                # Collect evidence tx signatures
                if "evidence" in result:
                    evidence.extend(result["evidence"])

                # Collect agentic actions
                if tool_call.name == "take_action" and result.get("status") == "queued":
                    actions.append(
                        {
                            "type": tool_call.input.get("action_type"),
                            "parameters": tool_call.input.get("parameters", {}),
                        }
                    )

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_call.id,
                        "content": json.dumps(result, default=str),
                    }
                )

            # Continue the conversation with tool results
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            # Unexpected stop reason
            for block in response.content:
                if hasattr(block, "text"):
                    answer_text = block.text
            break
    else:
        # Hit max iterations
        if not answer_text:
            answer_text = "[SUSPECTED] Analysis incomplete — reached maximum reasoning steps."

    return {
        "answer": answer_text,
        "numbers": _extract_numbers(answer_text),
        "evidence": evidence[:10],  # cap at 10 evidence items
        "confidence": _extract_confidence(answer_text),
        "viz_type": _infer_viz_type(answer_text, actions),
        "actions": actions,
    }


async def generate_wallet_intelligence(address: str) -> dict[str, Any]:
    """
    Generate an AI narrative summary for a wallet profile page.
    Lightweight version of the main AI pipeline with pre-loaded wallet context.
    """
    query = f"Give me a comprehensive intelligence summary for wallet {address}. Include their classification, trading behavior, key relationships, and any notable patterns."
    result = await run_bloodhound_ai(
        query=query,
        session_id=f"intel:{address}",
        context={"tracked_wallets": []},
    )
    return {
        "address": address,
        "summary": result["answer"],
        "confidence": result["confidence"],
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_system_prompt(label_map: dict[str, str]) -> str:
    label_context = (
        f"\nTracked wallets (label → address):\n{json.dumps(label_map, indent=2)}"
        if label_map
        else ""
    )
    return f"""You are Bloodhound AI, an on-chain intelligence assistant for Solana.

You have access to:
- On-chain data: wallet transfers, trades, funding traces, counterparties (ClickHouse)
- Known entity database: labeled wallets, KOLs, exchanges (Supabase)
- Live market data: trending tokens, leaderboard PnL (Birdeye)
- Web search: use the web_search tool to find background on events, projects, people, or tokens

RULES — NEVER:
- Link wallet addresses to real-world identities beyond what evidence supports — use "suspected", "may indicate", "possible"
- Make accusations about illegal activity without clear on-chain evidence
- Speculate on future price movements
- Fabricate transaction evidence — every claim must reference a real tx signature
- Answer confidently about wallets with zero on-chain history

WHEN TO USE WEB SEARCH:
- User asks about a historical Solana event (Libra, $TRUMP, $DJT, $BONK, pump.fun launches, FTX)
- User asks "who is [person]" or "what is [project]"
- User wants background context before or alongside on-chain analysis
- Combine web context + on-chain data to give the fullest picture

CONFIDENCE TIERS (always end your answer with one):
- [CONFIRMED] — Direct on-chain proof, evidence tx signatures provided
- [PROBABLE] — Strong multi-signal pattern, multiple supporting signals
- [SUSPECTED] — Weak or single-signal inference, or web-only without on-chain corroboration
- [UNKNOWN] — Insufficient data

WHEN DATA IS ABSENT:
- Zero history → "This address has no recorded on-chain activity. [UNKNOWN]"
- Partial data → Attempt inference, clearly mark [SUSPECTED], offer to clarify
- Ambiguous query → Ask the user to clarify

FORMAT:
- Lead with a clear 1-2 sentence answer
- Follow with key numbers (amounts, dates, counts)
- List evidence tx signatures if available
- Cite web search sources in parentheses if used
- End with confidence tier in brackets
{label_context}"""


def _extract_confidence(text: str) -> str:
    for tier in ("CONFIRMED", "PROBABLE", "SUSPECTED", "UNKNOWN"):
        if f"[{tier}]" in text:
            return tier
    return "UNKNOWN"


def _extract_numbers(text: str) -> list[dict]:
    """Pull out number mentions (SOL amounts, USD values, counts) from the answer."""
    numbers: list[dict] = []
    # SOL amounts
    for m in re.finditer(r"([\d,]+\.?\d*)\s*SOL", text):
        numbers.append({"label": "SOL", "value": m.group(1).replace(",", "")})
    # USD amounts
    for m in re.finditer(r"\$([\d,]+\.?\d*)", text):
        numbers.append({"label": "USD", "value": m.group(1).replace(",", "")})
    return numbers[:10]


def _infer_viz_type(text: str, actions: list[dict]) -> str:
    """Determine what visualization to show with the response."""
    for action in actions:
        if action.get("type") == "open_graph":
            return "graph"
    if "transfer" in text.lower() or "sent" in text.lower():
        return "table"
    return "none"


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception:
        return default


async def _gather(*coros):
    import asyncio
    return await asyncio.gather(*coros, return_exceptions=False)
