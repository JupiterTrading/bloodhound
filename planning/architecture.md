# Bloodhound — Architecture & Stack Research

## Solana Data APIs — Research Complete (Feb 2026)

### Tier 1: Non-Negotiables

**Helius** (helius.dev)
- PRIMARY source for: enriched/parsed transaction history, NFT/cNFT via DAS, real-time webhooks
- Enhanced Transactions API: parses raw txs into typed events (SWAP, TRANSFER, NFT_SALE, etc.)
- Webhooks: filter by address/type/program, delivers parsed payloads, retry logic built in
- Pricing: Starter ~$49, Business ~$199, Professional ~$499/mo
- Free tier: 1M credits (good for dev/prototyping)
- **VERDICT: Foundation data layer. Non-negotiable.**

**Birdeye** (birdeye.so)
- PRIMARY source for: token price history (OHLCV), DEX trade data, portfolio USD valuation, token security scores
- Wallet portfolio endpoint: token holdings with live USD values
- Token security: rug pull risk scores, honeypot detection
- Multi-chain (Solana + EVM chains)
- Pricing: Basic ~$50, Premium ~$200, Business ~$500/mo
- Free: 50K calls/mo
- **VERDICT: Non-negotiable for price/market context.**

### Tier 2: Free/Supplementary

**Jupiter API** — FREE
- Current token prices, swap routing, curated token list (~600K+ tokens)
- No auth required at base tier, ~100-600 req/min
- Does NOT have: historical prices, wallet history, DEX analytics
- **Use for: real-time price lookups, token metadata, swap route analysis**

**Solana FM** — Free tier
- Address labels database (exchanges, protocols, notable wallets)
- Good supplementary source for entity attribution
- Not as rich as Helius for enriched txs
- **Use for: supplementary entity labels**

### Tier 3: Real-Time Streaming (Add Later)
- **QuickNode Yellowstone gRPC** (~$149/mo add-on) — sub-second tx streaming, programmable JS filters
- **Triton One Dragon's Mouth** — enterprise gRPC, Triton-hosted, sub-50ms latency
- **Self-hosted Geyser** — $1,500-5,000+/mo infra, full data control, only at scale

### Shyft.to — Alternative/Backup
- Similar to Helius but less mature, cheaper at lower tiers (~$29-99/mo)
- Free tier: 50K req/day (generous for prototyping)
- Good for NFT-heavy use cases
- Less transaction enrichment depth than Helius

### What Competitors Use
- **Nansen**: Self-hosted Geyser streams + custom parsers + ClickHouse + entity clustering via graph
- **Arkham**: Own validator-level ingestion + proprietary ULTRA entity attribution AI
- **Bubblemaps**: RPC + token program data for holder graphs; likely combination of providers

## MVP Data Stack (Bootstrap Phase)
| Purpose | Service | Monthly Cost |
|---|---|---|
| Enriched tx history + webhooks | Helius Business | $199 |
| Price/market data + portfolio | Birdeye Premium | $200 |
| Token prices + metadata | Jupiter | $0 |
| Entity labels | Solana FM | $0 |
| **Total** | | **~$400/mo** |

## Key Architecture Decisions

### Polling vs Webhooks vs Streaming
- Polling (REST): simplest, 10+ sec latency, high cost at scale — dev only
- Webhooks (Helius): 1-5 sec latency, parsed payloads, moderate cost — MVP choice
- gRPC streaming: <50ms latency, raw data, complex — add at scale

### Historical Data Depth
- Helius paid: full paginated history
- Default: ~1000 most recent transactions
- For full archive on bootstrap budget: use Helius paginated history with caching in Postgres

### New Token Discovery
- Birdeye "new listings" endpoint
- Helius webhooks on Token Program (new mint creation events)
- Pump.fun API for pump.fun launches specifically

## Frontend Stack — Research Complete (Feb 2026)

### Framework: Next.js 15 (App Router)
- Server components for data-heavy list views, dashboards, wallet summaries
- Client components mandatory for all graph visualization (React Flow, G6, Sigma.js cannot SSR)
- Turbopack (stable in v15): faster dev server
- ISR useful for caching slow on-chain data

### Graph Visualization — CRITICAL DECISION
**DO NOT pick React Flow for large-scale graphs.** Max ~500-1000 nodes before perf degrades.

| Library | Max Nodes | Dev XP | Built-in Analytics | Notes |
|---|---|---|---|---|
| React Flow | ~500-1000 | Excellent | None | Good for small curated flows only |
| D3.js | 10k+ (Canvas) | Hard | None | Maximum control, build everything yourself |
| Cytoscape.js | 2-5k | Good | Excellent | Best built-in graph algorithms |
| Sigma.js v3 | 10-50k | Good | Via graphology | WebGL, large graph rendering |
| G6 v5 (AntV) | 50k+ (WebGL) | Medium | Good | Used in fintech/blockchain analytics |

**Recommended approach**: G6 v5 as primary (closest to Arkham-style tooling, WebGL). Sigma.js as fallback for extreme scale. Use **graphology** as canonical graph data model regardless of renderer.

### Charts
- **TradingView Lightweight Charts** — mandatory for OHLCV/price data, no real competitor
- **Tremor** — standard dashboard KPIs, bar/line/area charts
- **Nivo** — Sankey diagrams (fund flow), treemap (portfolio breakdown)
- **Recharts** — if custom control beyond Tremor needed

### UI Components
- **shadcn/ui** — primary component library (dark mode, Radix primitives, TanStack Table integration)
- **Tremor** — analytics-specific dashboard components alongside shadcn

### Data Fetching & State
- **TanStack Query v5** — server state, cache seeding from WebSocket events, infinite scroll for tx history
- **Zustand** — global client state (selected wallet, filters, time range, preferences)
- **Jotai** — add if complex derived state chains emerge

### Real-time
- **Native WebSocket / react-use-websocket** — high-frequency data (tx feeds, price updates)
- **Ably or Pusher** — managed service for wallet alert notifications
- Avoid Socket.IO for performance-critical streams

### Animation
- **Framer Motion** — standard UI transitions, page animations, component mount/exit
- **GSAP** — only if canvas-level graph animation needed (transaction flow along edges, pulsing nodes)

### Full Recommended Stack
```
Framework:        Next.js 15 (App Router)
Graph viz:        G6 v5 + graphology
Price charts:     TradingView Lightweight Charts
Dashboard charts: Tremor + Nivo
UI components:    shadcn/ui + Radix UI
Tables:           TanStack Table (via shadcn DataTable)
Server state:     TanStack Query v5
Client state:     Zustand
Real-time:        Native WebSocket / react-use-websocket
Alerts delivery:  Ably
Styling:          Tailwind CSS v4
Animations:       Framer Motion + GSAP (targeted)
Language:         TypeScript throughout
```
## Backend/AI Stack — Research Complete (Feb 2026)

### Backend Architecture: Split (NOT Next.js only)
- **Next.js API routes**: auth callbacks, Stripe webhooks, lightweight CRUD only (<3s)
- **FastAPI (Python 3.12)**: AI pipeline, LLM orchestration, graph computation, ClickHouse queries
  - Why Python: native async, ML ecosystem (NetworkX, scikit-learn), first-class Anthropic SDK
  - Vercel has 60-300s limit — kills multi-step LLM pipelines, so must be separate process
- **Deploy**: Vercel (Next.js) + Railway or Fly.io (FastAPI)

### Databases: THREE layers, not one
1. **Supabase (PostgreSQL)** — operational data: users, labels, alerts, watchlists, pgvector
2. **ClickHouse** — analytical data: all transaction history, DEX trades, wallet stats
   - Columnar storage: 100M+ row scans in milliseconds
   - MergeTree engine, partition by month, sort by (signer, block_time)
   - Materialized views for pre-aggregated stats
   - Self-host on Hetzner AX41-NVMe ($40/mo) — massive price/performance advantage
   - Start: ClickHouse Cloud free tier → migrate to self-hosted when costs justify
3. **Upstash Redis** — cache (TTL patterns), rate limiting, job queues, session state

**ORM: Drizzle** (not Prisma — Prisma binary adds 100ms cold start, kills Vercel perf)

### AI/LLM Layer
- **Primary model**: claude-sonnet-4-5 (speed/accuracy/cost balance, 200k context)
- **Classification**: claude-haiku-4-5 (cheap intent detection)
- **Fallback**: Claude Opus 4 for complex multi-hop reasoning only
- **Orchestration**: Custom tool-use (NOT LangChain — too opaque, breaks in prod)
- **Library**: `instructor` (Python) for guaranteed structured Pydantic output from LLM
- **NO LangChain in production** — debugging is painful, abstraction leaks, versions unstable

### NL Query Pipeline
```
User query → Intent classifier (Haiku) → Tool selector (claude-sonnet-4-5 with tool schemas)
→ Dispatch to: ClickHouse query builder / Supabase query / Graph engine
→ Result formatter (claude-sonnet-4-5 → natural language + viz recommendation)
```
- Tool definitions via Pydantic models → auto-generated JSON schema → Claude tool_use
- Agentic loop: Claude calls tools until stop_reason = "end_turn" (max 5 iterations)
- Cache NL query results in Redis by query hash (TTL: 5min price data, 1hr historical)

### Graph Computation
- **Phase 1**: NetworkX (Python) + PostgreSQL — no extra infra, sufficient for MVP
- **Phase 2**: Neo4j (multi-hop traversal at scale) or Apache AGE (Postgres extension, Cypher support)
- **Data model**: graphology on frontend, NetworkX or Neo4j on backend
- Entity clustering via Louvain community detection (in graphology/NetworkX)

### Vector Search
- **pgvector in Supabase** — sufficient for <2M wallet behavior embeddings
- Embed: wallet behavioral profiles (protocol usage, token preferences, activity patterns)
- Upgrade to **Qdrant** (self-hosted, Rust-based) when >2M vectors or high QPS needed
- Embedding model: Voyage AI voyage-large-2 (better for technical/code content)

### Auth
- **Clerk** — best DX, org/team support built-in, Next.js integration excellent
- **Solana Wallet Adapter** — secondary sign-in (Phantom, Backpack), link to Clerk user
- **Stripe** — subscriptions + Stripe Meters for usage-based billing per-query

### Infrastructure (full picture)
| Layer | Service | Est. Monthly |
|---|---|---|
| Frontend | Vercel Pro | $20 |
| AI Backend | Railway starter | $5-20 |
| ClickHouse | Hetzner AX41-NVMe | $40 |
| Operational DB | Supabase Pro | $25 |
| Cache | Upstash Redis | $10-30 |
| Helius (data) | Business | $199 |
| Birdeye (prices) | Premium | $200 |
| Claude API | Usage-based | $50-200 |
| **Total** | | **~$550-740/mo** |

### Build Order (Critical Path)
1. Wks 1-2: Helius webhook → ClickHouse ingestion pipeline (DATA FIRST)
2. Wks 3-4: FastAPI + tool definitions + manual SQL dispatcher
3. Wks 5-6: Claude NL pipeline + Redis caching
4. Wks 7-8: Next.js frontend + Clerk auth + Stripe
5. Mo 3: Graph computation + entity labels + pgvector semantic search
