# BLOODHOUND — MVP Overhaul Plan
**Date:** 2026-03-14 | **Status:** Active | **Owner:** Build Agent

---

## 0. System Diagnostic Summary

### 0.1 API Keys Inventory

| Service | Key Status | Capabilities |
|---|---|---|
| **Supabase** | ✅ Active | PostgreSQL DB, Auth (anon + service role), RLS, Storage |
| **Helius** | ✅ Active (`62930a03...`) | Enriched TXs, DAS (token accounts, NFTs), RPC, Webhooks (not configured yet) |
| **Birdeye** | ✅ Active (`a0d76ff5...`) | Token prices, OHLCV, portfolio valuation — **BUT** code already replaced with free APIs (DexScreener, GeckoTerminal, RugCheck, Jupiter) |
| **Clerk** | ✅ Active | Auth (email, Google, Twitter OAuth, wallet adapter) |
| **Anthropic** | ✅ Active (`sk-ant-api03...`) | Claude Sonnet/Haiku for AI pipeline — **no credits purchased by user** |
| **Upstash Redis** | ✅ Active | Caching, rate limiting, sliding window |
| **Ably** | ✅ Active (`etZa3g...`) | Real-time WebSocket alerts, pub/sub channels |
| **Dune Analytics** | ✅ Active (`KBdcfX...`) | SQL queries on indexed Solana data — **currently unused in codebase** |
| **ClickHouse** | ❌ REMOVING | Empty database, no data ingested, causes all analytics to return empty |
| **Stripe** | ⚠️ Not configured | Payment/billing not set up |
| **Twitter/X** | ⚠️ Not configured | No bearer token — social features will be placeholder |
| **Resend** | ⚠️ Not configured | Email delivery not available |

### 0.2 What Works Right Now

| Feature | Status | Notes |
|---|---|---|
| Supabase connection | ✅ | Tables exist: `kol_profiles`, `kol_wallets`, `known_wallets`, `tracked_wallets`, `users`, `alerts`, `wallet_rankings`, `wallet_trades` |
| KOL profiles in Supabase | ✅ | Data imported via scripts — profiles + wallets exist |
| Helius wallet transactions | ✅ | `get_wallet_transactions()`, `get_token_accounts()`, `get_nft_holdings()`, `get_sol_balance()` all functional |
| Wallet summary endpoint | ⚠️ Partial | Works but ClickHouse stats return 0/empty — needs Helius fallback |
| Wallet holdings | ✅ | Uses Helius DAS + DexScreener/GeckoTerminal pricing |
| Wallet transfers | ⚠️ Partial | ClickHouse primary returns empty, Helius fallback works for page 1 only |
| Token overview | ✅ | DexScreener free API — price, volume, liquidity, market cap |
| Token security | ✅ | RugCheck free API — rug score, risks, mint/freeze authority |
| Token holders | ✅ | Helius DAS `getTokenAccounts` |
| Trending tokens | ✅ | GeckoTerminal trending pools |
| Search | ⚠️ Partial | Supabase known_wallets search works; ClickHouse prefix search broken |
| KOL rankings | ❌ Broken | Depends entirely on ClickHouse `wallet_trades` table (empty) |
| KOL profile page | ⚠️ Partial | Profile loads from Supabase; trades tab broken (ClickHouse) |
| Bloodhound AI | ⚠️ Partial | Pipeline exists but tools call ClickHouse — returns empty evidence |
| Signals feed | ❌ Broken | ClickHouse signals table empty |
| Graph visualization | ❌ Broken | Depends on ClickHouse counterparties |
| Wallet poller | ❌ Broken | Writes to ClickHouse which is being removed |
| Real-time alerts | ⚠️ Skeleton | Ably key exists, webhook pipeline not connected |

### 0.3 Data Inventory

**Supabase Tables (populated):**
- `kol_profiles` — KOL identities with twitter, display name, source
- `kol_wallets` — Wallet addresses linked to KOL profiles  
- `known_wallets` — Community-submitted labeled wallets
- `wallet_rankings` — Schema exists (from 012 migration) but data may be sparse
- `wallet_trades` — Schema exists, needs population

**Local JSON Data Files (scripts/kol-data/):**
- `aggregated-kols.json` — **1.4M lines**, rich data: wallet, name, twitter, avatar, category, sources[], tags[], metrics (pnl_1d/7d/30d, winrate_7d/30d)
- `aggregated-smart-money.json` — Smart money wallets with similar structure
- `aggregated-all-wallets.json` — Combined dataset
- `gmgn-kols-complete.json` — 143 KOLs from GMGN
- `axiom-kols.json`, `axiom-vision-kols-2026-03-13.json` — Axiom scraped data
- `axiom-global-wallets.json` — Global wallet rankings from Axiom
- `kolscan-complete.json` — KolScan scraped data
- `birdeye-smartmoney.json` — Birdeye smart money wallets
- `dexscreener-wallets-2026-03-14.json` — DexScreener wallet data
- `stalkchain-wallets-2026-03-14.json` — StalkChain data

### 0.4 Critical Architecture Decision

**ClickHouse is being removed entirely.** All analytics that currently depend on ClickHouse will be replaced with:

1. **Supabase PostgreSQL** — Store wallet trades, signals, transfer history in `wallet_trades`, `wallet_signals`, `leaderboard_snapshots` tables (schema already exists in 012_wallet_rankings.sql)
2. **Helius API** — Real-time transaction fetching, on-demand wallet analysis
3. **Imported seed data** — The `aggregated-kols.json` file has rich PnL/winrate metrics that can seed `wallet_rankings` immediately
4. **Dune Analytics** — Leverage the existing API key for batch analytics (currently completely unused)

---

## 1. Sprint 1 — Data Layer Overhaul (CRITICAL PATH)

**Goal:** Remove ClickHouse, rewire all data flows to Supabase + Helius + seed data. Make rankings load with real data.

### 1.1 Remove ClickHouse

**US-M100: Remove all ClickHouse dependencies**
- Remove `clickhouse-connect` from `requirements.txt`
- Delete `app/services/clickhouse.py`
- Remove ClickHouse config from `app/core/config.py`
- Remove ClickHouse env vars from `.env.example`
- Update every file that imports from `clickhouse`:
  - `wallet.py` — replace with Helius direct calls + Supabase
  - `wallet_poller.py` — write to Supabase `wallet_trades` instead
  - `ai_pipeline.py` — query Supabase + Helius instead
  - `kol_calculator.py` — query Supabase `wallet_trades` + `wallet_rankings`
  - `leaderboard.py` — use Supabase `wallet_rankings` table
  - `signals.py` — use Supabase `wallet_signals` table
  - `classification.py` — use Helius + Supabase
  - `clustering.py` — use Supabase
  - `event_detector.py` — use Supabase
  - `new_pair_monitor.py` — use Supabase
  - `pumpfun.py` — use Supabase
  - `ingestion.py` — write to Supabase
  - `birdeye.py` — remove ClickHouse comment reference
  - `webhooks.py` — write to Supabase
  - `tracked.py` — use Supabase
  - `token.py` — use Supabase + Helius
- Delete `packages/db/schema/002_clickhouse.sql`
- Delete `scripts/migrate-clickhouse.js`

**Tests:**
- `test_no_clickhouse_imports`: Grep entire `apps/api/` for `clickhouse` — must find 0 matches
- `test_health_endpoint`: `GET /health` returns 200
- `test_wallet_summary`: `GET /v1/wallet/{known_address}/summary` returns data without ClickHouse
- `test_wallet_transfers_helius_fallback`: Transfers endpoint returns Helius data

### 1.2 Seed Rankings from Aggregated Data

**US-M101: Import aggregated KOL data into wallet_rankings**
- Create import script: `scripts/seed-wallet-rankings.mjs`
- Read `aggregated-kols.json` and `aggregated-smart-money.json`
- For each entry, upsert into `wallet_rankings` table:
  - `address` = wallet
  - `label` = name
  - `twitter_handle` = twitter
  - `avatar_url` = avatar
  - `wallet_type` = 'kol' or 'smart_money' based on `is_kol`/`is_smart_money`
  - `pnl_1d_sol`, `pnl_7d_sol`, `pnl_30d_sol` from metrics
  - `win_rate` from metrics.winrate_7d
  - `categories` = tags[]
  - `source` = sources[0]
  - `confidence` = source_count / 6 (normalized)
- Also upsert into `kol_profiles` + `kol_wallets` if not exists
- Cross-reference with existing `kol_profiles` to avoid duplicates

**Tests:**
- `test_seed_import`: Run script, verify `wallet_rankings` has > 100 rows
- `test_kol_profiles_populated`: `kol_profiles` count matches expected
- `test_rankings_api`: `GET /v1/kol/rankings` returns non-empty array

### 1.3 Rewrite KOL Rankings Calculator

**US-M102: Rankings from Supabase instead of ClickHouse**
- Rewrite `kol_calculator.py` to query `wallet_rankings` table directly
- For KOL rankings: JOIN `kol_profiles` with `wallet_rankings` on wallet address
- For smart money: Filter `wallet_rankings` WHERE `wallet_type = 'smart_money'`
- Support all sort options: pnl, roi, win_rate, volume, hold_time
- Support all time periods via `pnl_1d_sol`, `pnl_7d_sol`, `pnl_30d_sol` columns
- Cache results in Redis (5 min TTL)

**Tests:**
- `test_rankings_kol`: Returns KOL-type wallets sorted by PnL
- `test_rankings_smart_money`: Returns smart_money wallets
- `test_rankings_sort_winrate`: Sorting by win_rate works
- `test_rankings_period_filter`: Different periods return different results

### 1.4 Rewrite Wallet Poller for Supabase

**US-M103: Wallet poller writes to Supabase wallet_trades**
- Rewrite `_process_tx_batch` to insert into Supabase `wallet_trades` instead of ClickHouse
- Parse Helius enriched transactions → extract buy/sell trades
- Detect snipes (first 10 blocks), early buys (first hour)
- Calculate hold time for sells (match with previous buys)
- Write to `wallet_trades` table with proper schema

**Tests:**
- `test_poller_processes_tx`: Given mock Helius TX, writes correct row to Supabase
- `test_poller_detects_snipe`: Flags is_snipe correctly for early transactions
- `test_poller_no_duplicates`: Same TX processed twice → only 1 row

### 1.5 Rewrite AI Pipeline Tools

**US-M104: AI tools query Supabase + Helius instead of ClickHouse**
- `check_transfers` → Use Helius `get_wallet_transactions` + filter
- `trace_funding` → Use Helius transaction history, hop through first funder
- `get_wallet_summary` → Use Helius balance + Supabase wallet_rankings + portfolio
- `get_relationships` → Use Helius recent TXs to extract counterparties
- `get_kol_rankings` → Query Supabase wallet_rankings
- `get_token_info` → DexScreener + RugCheck + Jupiter
- Add new tool: `get_trending_tokens` → GeckoTerminal trending

**Tests:**
- `test_ai_check_transfers`: Tool returns transfers between two known wallets
- `test_ai_wallet_summary`: Returns meaningful data for a known wallet
- `test_ai_trending_tokens`: Returns current trending tokens

---

## 2. Sprint 2 — Leaderboard Overhaul

**Goal:** Rename to Leaderboard, load real data, add Axiom-level customization and animated UX.

### 2.1 Route & Navigation Rename

**US-M200: Rename /rankings to /leaderboard**
- Create new route: `apps/web/src/app/(app)/leaderboard/page.tsx`
- Redirect old `/rankings` → `/leaderboard`
- Update Sidebar nav: change href from `/rankings` to `/leaderboard`
- Update all internal links referencing `/rankings`
- Sidebar label: "Leaderboard" (not "KOL Rankings")

**Tests:**
- `test_leaderboard_route`: `/leaderboard` renders without error
- `test_rankings_redirect`: `/rankings` redirects to `/leaderboard`
- `test_sidebar_link`: Sidebar contains link to `/leaderboard`

### 2.2 Leaderboard Tabs & Filters (Axiom-inspired)

**US-M201: Advanced filter system**
- **Primary tabs**: KOLs | Smart Money | All Wallets | Tracked (user's)
- **Time period selector**: 1D | 3D | 7D | 30D | All Time
- **Sort dropdown**: PnL | ROI % | Win Rate | Volume | Avg Hold Time | Trades
- **Min trades filter**: Slider/input to filter by minimum trade count
- **Search within leaderboard**: Filter by name/twitter handle
- Persist filter state in URL params (shareable links)
- Persist user preferences in localStorage

**Tests:**
- `test_filter_kol_tab`: KOL tab shows only wallet_type='kol'
- `test_filter_period`: Switching period changes displayed data
- `test_filter_sort`: Each sort option reorders the table
- `test_url_params`: Filters persist in URL and restore on load
- `test_search_filter`: Typing a name filters the leaderboard

### 2.3 Leaderboard Table Design

**US-M202: Premium table with animations**
- **Rank column**: Gold/Silver/Bronze medals for top 3 with glow effects
- **Profile column**: Avatar (twitter PFP or generated), name, @handle, verified badge
- **PnL column**: Green/red with background tint, animated on data change
- **Win Rate column**: Mini progress bar + percentage
- **Trades column**: Trade count with mini sparkline if data available
- **Volume column**: Formatted USD with K/M/B suffixes
- **Rank change indicator**: ▲▼ arrows with green/red for position changes
- **Row hover**: Left accent border slide-in, subtle background lift
- **New entry animation**: Rows animate in with staggered fadeUp
- **Data flash**: When data updates, cells flash green/red briefly

**Tests:**
- `test_table_renders_data`: Table shows correct number of rows
- `test_top3_medals`: Top 3 rows have medal indicators
- `test_pnl_color`: Positive PnL shows green, negative shows red
- `test_responsive_table`: Table is scrollable on mobile

### 2.4 Leaderboard Stats Header

**US-M203: Stats bar above table**
- Total KOLs tracked count
- Total wallets in system
- Best performer today (name + PnL)
- Data freshness indicator ("Updated 3m ago" with live dot)
- Period being viewed

**Tests:**
- `test_stats_header_renders`: Stats bar shows all metrics
- `test_stats_updates`: Changing period updates the stats

---

## 3. Sprint 3 — AI, Explorer, Dashboard

### 3.1 Bloodhound AI Enhancement

**US-M300: Dynamic AI response rendering**
- Render markdown in AI responses (bold, links, lists, code blocks)
- Render inline wallet/token links as clickable chips → navigate to profile
- Render PnL numbers with color coding (green/red)
- Render token mentions with price badges
- Add "suggested follow-up" buttons below responses
- Add copy-to-clipboard for addresses and data
- Improve empty state with categorized example queries:
  - **Wallet Analysis**: "classify wallet X", "who funded X"
  - **Token Research**: "is token X safe?", "who are the top holders of X"
  - **KOL Intelligence**: "what tokens has @handle mentioned?", "top KOLs today"
  - **Trending**: "what's trending right now?", "any interesting new pairs?"

**US-M301: AI data sources expansion**
- Add `get_token_security` tool (RugCheck integration)
- Add `get_trending_tokens` tool (GeckoTerminal)
- Add `get_kol_profile` tool (Supabase KOL data)
- Add `get_token_holders` tool (Helius DAS)
- Add `get_dex_enhanced_info` tool (DexScreener paid orders, boosts)
- Expand system prompt with Bloodhound personality and rules

**Tests:**
- `test_ai_renders_markdown`: Response with **bold** renders correctly
- `test_ai_wallet_link`: Wallet address in response is clickable
- `test_ai_token_security_tool`: "is X token safe?" invokes RugCheck tool
- `test_ai_trending_tool`: "what's trending?" returns GeckoTerminal data

### 3.2 DEX Explorer Redesign

**US-M310: Explorer page with live data**
- **Search bar** (existing) — improved with autocomplete from Supabase known_wallets
- **Trending tokens section**: Top 10 from GeckoTerminal, auto-refresh every 60s
  - Token name, price, 24h change %, volume, mini chart
  - Click → navigate to `/token/{mint}`
- **Hot pairs section**: New pairs from GeckoTerminal/DexScreener
  - Pair name, age, liquidity, volume, buy/sell ratio
- **Top KOL activity**: Recent trades from tracked KOL wallets
  - KOL name + avatar, token traded, amount, time ago
- **Market overview**: SOL price, total DeFi volume, active wallets count

**Tests:**
- `test_explorer_trending_loads`: Trending tokens section shows data
- `test_explorer_hot_pairs`: Hot pairs section renders
- `test_explorer_search`: Search navigates to correct wallet/token page
- `test_explorer_responsive`: Layout works on mobile

### 3.3 Tracked Wallets → Dashboard

**US-M320: Dashboard page replacing simple wallet list**
- **Portfolio overview card**: Total value across all tracked wallets, 24h change
- **Activity feed**: Recent transactions across all tracked wallets, live via Ably
- **Wallet cards grid**: Each tracked wallet as a card showing:
  - Label, address (truncated), SOL balance, portfolio value
  - Last activity time, number of recent trades
  - Quick actions: View profile, Remove, Set alert
- **Add wallet form**: Improved with address validation and auto-label from known_wallets
- **Aggregate stats**: Total PnL, best performer, most active wallet

**Tests:**
- `test_dashboard_loads_wallets`: Shows user's tracked wallets
- `test_dashboard_add_wallet`: Can add a new wallet
- `test_dashboard_remove_wallet`: Can remove a wallet
- `test_dashboard_portfolio_value`: Shows aggregate portfolio value

---

## 4. Sprint 4 — Design Polish & Sidebar

### 4.1 Sidebar Redesign

**US-M400: Fix sidebar issues**
- Rename "KOL Rankings" → "Leaderboard" in sidebar
- Fix collapse button positioning (currently clips outside container)
- Improve section label typography — bolder, better contrast
- Fix keyboard shortcut display (⌘K should show Ctrl+K on Windows)
- Improve active state — more visible accent indicator
- Add tooltip on collapsed items
- Fix mobile nav alignment and touch targets (44px minimum)

**Tests:**
- `test_sidebar_labels`: All nav items have correct labels
- `test_sidebar_collapse`: Collapse/expand works without layout shift
- `test_sidebar_active_state`: Active page highlighted correctly
- `test_mobile_nav`: Mobile hamburger menu opens/closes correctly

### 4.2 Global Design Consistency

**US-M410: Fix misaligned elements across all pages**
- Audit and fix button padding/sizing inconsistency
- Ensure all cards use `.card` base class with consistent border-radius
- Fix font-size inconsistencies (some pages use px, others rem)
- Ensure all interactive elements have proper hover/focus states
- Fix z-index stacking issues (sidebar vs Bloomberg nav vs modals)
- Ensure consistent page container widths (max-width: 1200px)
- Fix tracked wallets page — convert inline styles to Tailwind classes

**US-M411: Add missing animations**
- Page transition animations (fade in on route change)
- Table row entrance animations (staggered)
- Data update flash animations on live data
- Loading skeleton animations (consistent across all pages)
- Button press micro-interactions

**Tests:**
- `test_no_inline_styles`: No inline `style={}` objects in new code
- `test_consistent_card_class`: All card elements use `.card` class
- `test_animations_present`: Key animations exist in globals.css

### 4.3 Responsive Design Pass

**US-M420: Mobile-first responsive fixes**
- Leaderboard table: horizontal scroll on mobile, sticky rank column
- Explorer: stack sections vertically on mobile
- Dashboard: single-column card layout on mobile
- AI terminal: full-width input, adjusted padding
- All modals: proper mobile sizing and dismissal

**Tests:**
- `test_leaderboard_mobile`: Table scrolls horizontally on narrow viewport
- `test_explorer_mobile`: Sections stack correctly
- `test_ai_mobile`: Input area is usable on mobile

---

## 5. Sprint 5 — Database Hardening

**Goal:** Enrich the data layer with additional contextual sources to make the platform more comprehensive and useful.

### 5.1 Dune Analytics Integration

**US-M500: Leverage existing Dune API key**
- Create `app/services/dune.py` service
- Implement batch wallet analytics queries:
  - Total realized PnL for wallet over time periods
  - Trade history aggregation
  - DEX volume by wallet
- Schedule daily Dune query execution for top KOL wallets
- Store results in `wallet_rankings` table (update PnL metrics)
- Use Dune for historical data that Helius can't provide (beyond 100 TX limit)

**Tests:**
- `test_dune_query_executes`: Can run a Dune query and get results
- `test_dune_updates_rankings`: Query results update wallet_rankings PnL fields

### 5.2 RugCheck Deep Integration

**US-M510: Token safety everywhere**
- Add rug score to token pages (already working via `get_token_security`)
- Show rug risk indicator on trending tokens in Explorer
- Add rug check to AI token analysis tool
- Color-code tokens in leaderboard trade history by risk level
- Add "Token Safety" section to KOL profile (% of risky tokens traded)

**Tests:**
- `test_rugcheck_on_token_page`: Token page shows security score
- `test_rugcheck_on_trending`: Trending tokens have risk indicator
- `test_ai_uses_rugcheck`: AI mentions rug risk when analyzing tokens

### 5.3 DexScreener Enhanced Data

**US-M520: Leverage DexScreener premium endpoints**
- Show if token has paid DexScreener profile (trust signal)
- Show boost count (social signal)
- Show community takeover status
- Add DexScreener social links to token pages
- Embed DexScreener chart iframe on token pages

**Tests:**
- `test_dex_paid_indicator`: Token with paid profile shows indicator
- `test_dex_chart_embed`: Chart iframe loads on token page

### 5.4 Jupiter Token List Integration

**US-M530: Verified token metadata**
- Use Jupiter strict token list as trust indicator
- Show "Verified" badge for tokens on Jupiter strict list
- Use Jupiter metadata for token logos, symbols, decimals
- Add Jupiter swap link on token pages

**Tests:**
- `test_jupiter_verified_badge`: Known token shows verified badge
- `test_jupiter_metadata`: Token symbol/logo from Jupiter renders

### 5.5 Bubblemaps Embed

**US-M540: Holder distribution visualization**
- Add Bubblemaps iframe embed to token pages
- URL format: `https://app.bubblemaps.io/sol/token/{mint}`
- Show as tab or expandable section on token page
- Add "View on Bubblemaps" link to AI token responses

**Tests:**
- `test_bubblemaps_iframe`: Token page has Bubblemaps iframe
- `test_bubblemaps_in_ai`: AI response includes Bubblemaps link for token queries

### 5.6 Axiom Trade Link Integration

**US-M550: Quick-trade from Bloodhound**
- Add "Trade on Axiom" button on token pages
- URL format: `https://axiom.trade/t/{mint}` (or equivalent)
- Add similar links for Jupiter, Raydium
- Show DEX liquidity comparison on token page

**Tests:**
- `test_trade_links_present`: Token page has trade links
- `test_trade_link_format`: Links point to correct URLs

### 5.7 Periodic Data Refresh Pipeline

**US-M560: Keep rankings fresh**
- Create `/v1/admin/refresh-rankings` endpoint (admin key protected)
- On trigger: For top 200 wallets in `wallet_rankings`:
  1. Fetch recent transactions from Helius (last 24h)
  2. Parse into trades, calculate PnL
  3. Update `wallet_rankings` PnL columns
  4. Update `wallet_rankings.updated_at`
- Schedule via Railway cron or manual trigger
- Also run Dune batch queries for deeper historical analysis

**Tests:**
- `test_refresh_updates_data`: After refresh, wallet_rankings.updated_at is recent
- `test_refresh_admin_only`: Non-admin request returns 403

---

## 6. AI Model Analysis & Agent Qualification

### 6.1 Cost Analysis

| Model | Cost (Input/Output per 1M tokens) | Best For | Latency |
|---|---|---|---|
| Claude Haiku 3.5 | $0.25 / $1.25 | Intent classification, simple queries | ~200ms |
| Claude Sonnet 4 | $3.00 / $15.00 | Tool use, complex reasoning, main pipeline | ~1-3s |
| Claude Opus 4 | $15.00 / $75.00 | Complex multi-hop analysis (use sparingly) | ~3-8s |
| GPT-4o-mini | $0.15 / $0.60 | Alternative for classification (cheaper) | ~200ms |
| GPT-4o | $2.50 / $10.00 | Alternative for main pipeline | ~1-2s |
| Gemini 2.0 Flash | $0.10 / $0.40 | Ultra-cheap classification alternative | ~150ms |
| Deepseek V3 | $0.27 / $1.10 | Cost-effective reasoning alternative | ~1-2s |

**Recommendation:** Current setup (Haiku classifier + Sonnet tool loop) is optimal. Average AI query costs ~$0.01-0.03. At 1000 queries/day = ~$10-30/day. Consider GPT-4o-mini as Haiku replacement for 40% cost reduction on classification step.

### 6.2 Bloodhound as Claude AI Agent

To qualify as a bonafide Claude/AI agent, Bloodhound needs:

1. **Tool Use (already implemented)**: Agent calls tools (check_transfers, get_wallet_summary, etc.) in a loop until it has enough info to answer
2. **Multi-step reasoning**: Already handles up to 5 tool call iterations
3. **Memory/Context**: Session history maintained, tracked wallets injected as context
4. **Agentic Actions**: Can track wallets, set alerts, add labels on user's behalf
5. **To qualify further**:
   - Register with Anthropic's agent directory (when available)
   - Implement MCP (Model Context Protocol) server so Claude Desktop can use Bloodhound as a tool provider
   - Create an API that exposes Bloodhound's tools in MCP format
   - This would let any Claude-powered app query Bloodhound's on-chain intelligence

---

## 7. Testing Strategy

### 7.1 Backend Tests (Python pytest)

Location: `apps/api/tests/`

```
tests/
├── test_health.py          # Health endpoint
├── test_wallet.py          # Wallet summary, transfers, holdings
├── test_kol.py             # KOL profiles, rankings
├── test_leaderboard.py     # Leaderboard filtering, sorting
├── test_ai.py              # AI pipeline, tool execution
├── test_token.py           # Token overview, security, holders
├── test_tracked.py         # Tracked wallets CRUD
├── test_signals.py         # Signal detection
├── test_services/
│   ├── test_helius.py      # Helius API integration
│   ├── test_birdeye.py     # DexScreener/GeckoTerminal/RugCheck
│   ├── test_kol_calc.py    # Rankings calculator
│   └── test_dune.py        # Dune Analytics
└── conftest.py             # Shared fixtures, mock Supabase client
```

### 7.2 Frontend Tests (Vitest + React Testing Library)

Location: `apps/web/src/__tests__/`

```
__tests__/
├── pages/
│   ├── leaderboard.test.tsx
│   ├── ai.test.tsx
│   ├── explorer.test.tsx
│   └── dashboard.test.tsx
├── components/
│   ├── sidebar.test.tsx
│   ├── leaderboard-table.test.tsx
│   └── ai-terminal.test.tsx
└── lib/
    └── api.test.ts
```

### 7.3 Integration Tests

- `test_full_kol_flow`: Import KOL → appears in rankings → profile page loads → trades show
- `test_full_wallet_flow`: Search wallet → summary loads → transfers show → can track
- `test_full_ai_flow`: Ask question → AI responds → evidence links work → actions execute

---

## 8. Execution Order

1. **Write MVP_PLAN.md** ← YOU ARE HERE
2. **Sprint 1.1**: Remove ClickHouse (all 43 files, 268 references)
3. **Sprint 1.2**: Seed wallet_rankings from aggregated data
4. **Sprint 1.3**: Rewrite KOL calculator for Supabase
5. **Sprint 1.4**: Rewrite wallet poller for Supabase
6. **Sprint 1.5**: Rewrite AI pipeline tools
7. **Sprint 2.1-2.4**: Leaderboard overhaul
8. **Sprint 3.1-3.3**: AI, Explorer, Dashboard
9. **Sprint 4.1-4.3**: Design polish
10. **Sprint 5.1-5.7**: Database hardening
11. **Verification**: Run all tests, manual QA pass

Each sprint produces a working, testable increment. No sprint depends on later sprints.
