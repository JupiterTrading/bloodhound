# Bloodhound — Roadmap Detail
**Last updated: Mar 6 2026**

## Current Status: Sprint B15 — Free API Stack + Universal Wallet Intelligence

### Completed ✅
- GitHub org live, repo structured
- All core pages built: explorer, wallet, token, tx, graph, AI terminal, tracked, signals, intelligence, leaderboard, portfolio, entity, events, billing, admin
- Authentication (Clerk) integrated
- Supabase + ClickHouse + Redis deployed
- Known wallets seeded (129 rows — KOLs, exchanges, protocols + 8 known events)
- Leaderboard + trending live on Intelligence page
- Wallet poller running (background polling for tracked wallets every 5min)
- USD enrichment on ingest (Jupiter batch price API) ✅
- Signal detection engine ✅
- AI web search (Brave Search) ✅
- Historical backfill on wallet track ✅
- AI signals + events context tools ✅
- NFT holdings (Helius DAS) ✅
- Wash trader classification ✅
- Side wallet dispute system ✅
- API key management (Pro) ✅
- Stripe billing integration ✅
- QA pass complete — auth proxy fixed, schema types fixed, dispute security fixed ✅
- Railway backend deployed ✅
- Helius webhook registered (25 slots, top KOLs + exchanges) ✅
- **Birdeye ($200/mo) replaced with free APIs** ✅
  - Jupiter → token prices + wallet portfolio USD
  - DexScreener → token overview, pairs, OHLCV
  - RugCheck → security / rug risk (better than Birdeye)
  - GeckoTerminal → trending tokens, gainers/losers
  - Helius DAS → token holders

### Completed Sprint B15 ✅
- [x] Backfill on any wallet search — fire `backfill_wallet()` on first view of any wallet (US-B1501)
- [x] Pump.fun WebSocket — real-time new token launch + early buyer detection (US-B1502)
- [x] New pair monitor — DexScreener token profiles polling every 60s (US-B1503)
- [x] Funding source tracing — multi-hop SOL graph, `/v1/entity/{address}/funding-graph` (US-B1504)
- [x] KOL activity feed — `GET /v1/leaderboard/kol-feed` + Signals page tab (US-B701)
- [x] Smart money consensus — `GET /v1/leaderboard/smart-money?mint=` + token page panel (US-B702)
- [x] ClickHouse inserts made fully async (asyncio.to_thread for all insert calls)
- [x] Events seed data — 10 historic Solana events seeded (trump, bonk, jup, wif, ftx, etc.)

### Remaining
- [ ] Vercel frontend deployment (manual step — set NEXT_PUBLIC_API_URL in Vercel)
- [ ] Railway env vars: HELIUS_WEBHOOK_ID + HELIUS_WEBHOOK_SECRET (manual step)

---

## API Strategy (Updated Mar 6 2026)

### Free (no cost)
| API | Used for |
|-----|---------|
| Jupiter Price API | Token prices, wallet portfolio USD values |
| DexScreener | Token overview, new pairs, pair data |
| RugCheck | Token security / rug risk score |
| GeckoTerminal | Trending tokens, gainers/losers |
| Helius DAS (free tier) | Token accounts, NFTs, transaction history |
| Pump.fun WebSocket | Real-time new token launches |
| Solana public RPC | Basic chain data fallback |

### Paid (minimum viable spend)
| API | Cost | Used for |
|-----|------|---------|
| Helius Growth | $49/mo | Enhanced tx parsing, DAS, webhooks |
| Anthropic Claude | Pay-per-use | AI terminal, classification |
| Upstash Redis | ~$10/mo | Caching layer |
| Supabase | Free → $25/mo | User data, known wallets, events |
| ClickHouse Cloud | ~$40/mo | Analytics, trade history |

### Removed
- ~~Birdeye $200/mo~~ — fully replaced by free alternatives
- ~~Ably $X/mo~~ — defer until real-time alerts are prioritized
- ~~Twitter API $100/mo~~ — defer to Sprint B5

**MVP monthly cost: ~$150-200/mo** (vs $750-970/mo originally planned)

---

## Phase 1 (Foundation) — ✅ COMPLETE

- [x] All core pages built and styled
- [x] Authentication (Clerk)
- [x] Helius integration
- [x] ClickHouse schema + Railway deployment
- [x] Known wallets + events seeded
- [x] Stripe billing

---

## Phase 2 (Intelligence Layer) — IN PROGRESS

- [x] Wallet classification (10 labels)
- [x] Side wallet detection + dispute system
- [x] Signal detection engine
- [x] AI terminal with tool calls
- [x] Wallet + token + NFT data
- [x] Leaderboard + trending
- [x] Portfolio dashboard
- [x] API key management
- [ ] **Backfill on any wallet search** — any wallet searched populates ClickHouse (US-B1501)
- [ ] **Pump.fun WebSocket** — new launch detection, early buyer identification (US-B1502)
- [ ] **New pair monitor** — DexScreener new pairs every 30s (US-B1503)
- [ ] **Graph-based identity** — funding source tracing for side wallet detection (US-B1504)

---

## Phase 3 (Social + Events + Deep Intelligence) — PLANNED

**New Pairs Intelligence (the trencher killer feature):**
- [ ] Detect new pairs on Pump.fun + Raydium in real-time
- [ ] Identify dev wallet, first 50 buyers immediately
- [ ] Cross-reference early buyers against known_wallets + side wallet graph
- [ ] Surface: "5 of first 20 buyers connected to KOL X"

**Graph-based Identity:**
- [ ] Funding source tracing ("follow the SOL")
- [ ] Token overlap clustering (same obscure tokens = same person)
- [ ] Timing correlation clustering
- [ ] AI reasoning over graph evidence

**Twitter/Social (Sprint B5):**
- [ ] KOL Twitter profile enrichment (US-B501)
- [ ] Token narrative tracker — tweet volume per $TOKEN (US-B502)
- [ ] Tweet → trade correlation — KOL pre-buy detection (US-B503)
- [ ] KOL activity feed (US-B701)

**Event Intelligence:**
- [ ] Event pages `/event/[slug]` — narrative + wallets + flow graph (US-B605)
- [ ] Wallet → event cross-reference on profile pages (US-B606)
- [ ] AI event context tool (US-B406)

---

## Phase 4 (Scale + Monetization) — FUTURE

- [ ] Yellowstone gRPC stream (when revenue supports ~$500/mo) — replaces all polling
- [ ] KOL win rate leaderboard (requires months of ClickHouse data)
- [ ] Custom Geyser indexer (replaces Helius at scale)
- [ ] Team workspaces
- [ ] Solana Foundation grant application
- [ ] Mobile app

---

## Product Vision (North Star)

**The ultimate on-chain intelligence platform for Solana traders.**

1. **Search anything** — any wallet, any token, any KOL. Instant data. No pre-registration required. Backfill fires on first search.

2. **New pairs intelligence** — the moment a token launches, know who deployed it, who bought first, and whether any of those wallets connect to known insiders.

3. **Identity** — link any wallet to a person via behavioral clustering, funding source tracing, and social graph. Zach XBT-grade inference, automated.

4. **AI that knows everything** — on-chain data + known identities + active signals + web context. Ask anything, get calibrated evidence-backed answers.
