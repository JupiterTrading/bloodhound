# BLOODHOUND — Project Memory
**Last updated: 2026-02-28 — QUESTIONS.md fully answered, all three agent briefs written**

## What We're Building
Solana on-chain intelligence terminal. Three products in one:
1. Block explorer (foundation / legitimacy layer)
2. Wallet intelligence layer (named wallets, relationship mapping, flow graphs) — THE differentiator
3. Bloodhound AI — agentic NL query interface (can take actions: save wallets, set alerts, open graphs)

## Product Positioning
"Intelligence layer" not a generic explorer. Beyond Solscan. Competitors: Arkham Intelligence (closest), Nansen (aesthetic), Bubblemaps (graph viz), Dune Analytics (data-forward UX). Axiom (classification granularity reference).

## Core Differentiator
Named/tracked wallet system + AI that ACTS. Users label wallets, query in plain language, and the AI executes actions on their behalf. Goal: Axiom-level granularity for wallet classification, applied to an intelligence tool, not a trading terminal.

## Branding (CONFIRMED — all QUESTIONS.md answers reviewed)
- **Background**: near-black with slight warmth (`#0d0a0a`)
- **Text**: off-white with slight warmth (`#f0eded`)
- **Accent**: BLOOD RED (`#b30000`) — single accent. CTAs, active states, alerts, seed nodes
- **Palette**: black / off-white / blood red — three colors. Amber for warnings only, green for confirmed status only.
- **Texture**: subtle scanlines + grid (hero only), constant ambient motion (live terminal feel)
- **Typography**: JetBrains Mono (addresses/data/code) + NHGrotesk (UI/headings)
- **Logo**: Bloodhound head silhouette (left-facing), blood red narrowed eye or crosshair. Icon + wordmark lockup. All caps "BLOODHOUND."
- **Layout**: Multi-page dashboard. Desktop first, responsive for mobile. No left sidebar (global nav = top nav only).
- **Vibe**: calm, confident, infra-grade. "Serious intel tool."
- **Motion**: ALIVE — constant subtle motion (live feed scrolling, pulsing badges, streaming data). Page transitions instant but animated.
- **Hero**: Real-time live data feed visible in hero (KOL txs, large wallet movements). Headline: "On-Chain Intelligence for Solana."
- **Agent notation**: PLAN decisions marked `[PLAN]` in all brief documents.

## AI Feature Name
**Bloodhound AI** — NOT "Ask the Hive" (planning placeholder, now retired). The AI IS the product.

## Product Modules (Canonical)
1. **Search / Explorer Core** — universal search (wallet, token, tx, program, block, @handle)
2. **Intelligence Layer** — wallet classification, summaries, counterparties, funding trace, side wallets
3. **Relationship + Flow Mapping** — graph (G6 v5, default 2-hop), timeline (time axis + PnL), table (exportable)
4. **Bloodhound AI** — agentic NL interface. Takes actions: save wallet, set alert, open graph, label wallet.
5. **Tracked Wallets Dashboard** — 1 group / 50 wallets (free), unlimited (pro), live feed, alerts
6. **Signals** — public feed + personal filter. Same 4-tier confidence system.
7. **Public API + Docs** — API keys for Pro tier. External docs = Mintlify. Internal docs = sprint PRDs (this folder).

## Navigation
Top nav: Explorer | Intelligence | Tracked | Signals | Bloodhound AI | API | Docs
Status bar (bottom, fixed): network health, indexer sync, API uptime

## Key Confirmed Decisions (from QUESTIONS.md)
- **Whale Wallet** = $50k+ portfolio value (dynamic, real liquidity). Distinct from **Whale Holder** (≥1% of a token's supply — token-specific label)
- **Graph default depth**: 2 hops (wallet + direct connections + their connections). Click to expand further. Max 5.
- **Free tier**: 1 group, 50 wallets. Pro: unlimited.
- **Transaction source logos**: Show Axiom, Phantom, Jupiter, Raydium, Orca, Pump.fun, Coinbase, Jito logos on all tx lists.
- **Known wallets main identifier**: Twitter/X handle AND/OR Telegram handle (linked on approval)
- **Hero visual**: Real-time live data feed (KOL activity, large movements) — NOT a node network animation
- **Docs format**: Internal docs = sprint PRDs for AI agents. Public API docs = Mintlify for developers.
- **Auth**: Email + Google + X/Twitter OAuth + Solana Wallet Adapter (Phantom/Backpack). Optional, no unnecessary permissions.
- **Portfolio**: Users can add their own wallets (private unless submitted/approved)
- **Pump.fun**: Lean in explicitly — bundler detection, insider wallets tab, dev wallet trace. Keep it serious.
- **Cross-chain**: Solana only now. All DB tables include `chain` field for future expansion.
- **Mobile**: Web responsive only. No native app on roadmap.
- **NFT depth**: As deep as possible. MVP = holdings + images. Later = full provenance, rarity, analytics.
- **Signals scope**: All three (global, personalized, token-specific), filterable. Global requires higher threshold.
- **#1 thing to nail**: Wallet Tracking + Bloodhound AI that takes actions for the user.

## Performance Targets (confirmed or PLAN-set)
- Wallet profile: < 5s (owner confirmed)
- Universal search: < 5s (owner confirmed)
- Bloodhound AI response: < 8s (PLAN)
- Autocomplete: < 100ms (PLAN, Redis-cached)

## Agreed Stack (FINAL)
- **Frontend**: Next.js 15 App Router, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Zustand
- **Graph**: G6 v5 (WebGL) + graphology
- **Charts**: TradingView Lightweight Charts (price) + Tremor + Nivo (Sankey)
- **Backend**: FastAPI (Python 3.12) on Railway
- **DB**: Supabase (PostgreSQL + pgvector) + ClickHouse (analytics, Hetzner AX41) + Upstash Redis
- **ORM**: Drizzle (not Prisma)
- **AI**: claude-sonnet-4-6 (primary), claude-haiku-4-5-20251001 (intent classifier), Claude Opus 4 (complex fallback)
- **AI orchestration**: instructor library + custom tool-use. NO LangChain.
- **Auth**: Clerk + Solana Wallet Adapter
- **Payments**: Stripe + Stripe Meters
- **Real-time**: Helius webhooks + Ably
- **Email**: Resend
- **Data APIs**: Helius ($199/mo) + Birdeye ($200/mo) + Jupiter (free) + Solana FM (free) + Pump.fun (free) + Twitter/X API

## Project State (as of 2026-02-28)
- Working directory: `C:\Users\guestarino\CascadeProjects\bloodhound`
- Repo: https://github.com/JupiterTrading/bloodhound.git
- Planning phase complete — no code scaffolded yet
- QUESTIONS.md: ALL sections A–E answered by owner ✓
- Agent briefs generated ✓

## Agent Briefs Status
- `planning/DESIGN_BRIEF.md` ✓ — ready for UI/UX agent
- `planning/BUILD_SPEC.md` ✓ — ready for BUILD agent
- `planning/QA_PLAN.md` ✓ — ready for QA agent

## Next Actions
1. **Pre-build blockers** (owner to complete before agents start):
   - Confirm name "Bloodhound" — check @bloodhound on Twitter/X, bloodhound.so / .xyz / .app
   - Lock Twitter/X handle immediately
   - Register domain
   - Create GitHub org (JupiterTrading or BloodhoundHQ?)
   - Set up Helius account + API key
   - Set up Supabase project
2. **BUILD agent** starts with Week 1–2: Helius webhook → ClickHouse ingestion pipeline
3. **UI/UX agent** starts with: landing page design + wallet profile page design
4. **QA agent** starts with: test environment setup + US-010 (relationship query) test harness

## Reference Assets in Repo
- `content.png`: Nexus visual reference (dark bg, high contrast, live data, nav structure)
- `message.txt`: Authoritative product descriptor / positioning doc
- `QUESTIONS.md`: All 90 questions answered (A–E complete)
- `SETUP.md`: New machine onboarding instructions
- `planning/DESIGN_BRIEF.md`: Full design spec for UI/UX agent
- `planning/BUILD_SPEC.md`: Full technical spec for BUILD agent
- `planning/QA_PLAN.md`: Full QA plan with all user stories and test cases
- `planning/architecture.md`: Stack research notes (Feb 2026)
- `planning/roadmap.md`: Sprint breakdown

## Links to Topic Files
- [architecture.md](./architecture.md) — detailed technical architecture and API research
