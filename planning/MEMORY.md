# Bloodhound — Project Memory

## What We're Building
Solana-based AI intelligence platform. Three products in one:
1. Solana block explorer (foundation, legitimacy layer)
2. Wallet intelligence layer (named wallets, relationship mapping, flow graphs) — THE differentiator
3. AI natural language interface ("does poop send to punk?")

## Product Positioning
"Intelligence layer" not just a block explorer. Beyond Solscan. Competitor reference: Arkham Intelligence (closest product), Nansen (aesthetic), Bubblemaps (graph viz), Dune Analytics (data-forward UX).

## Core Differentiator
Named/tracked wallet system — users assign human-readable labels to addresses, then query relationships in plain language. Removes friction from on-chain analysis. Keeps users on platform vs bouncing to multiple tools.

## Key Features
- Wallet labeling (private + public tags)
- Tracked wallet dashboards
- Relationship mapping (wallet → wallet flows)
- Visual flow graphs showing fund movement
- Alerts for interactions between tracked wallets
- AI natural language query interface
- Cluster detection / smart money tagging

## Agreed Stack
- **Frontend**: Next.js 14 App Router, Tailwind CSS, Framer Motion, React Flow (graphs), Recharts or TradingView Lightweight Charts, TanStack Query
- **Data Layer (Phase 1)**: Helius API (primary Solana RPC, enriched tx data, webhooks), QuickNode (fallback), Birdeye/Jupiter (price/DEX data)
- **Backend**: Next.js API routes (light), separate Node.js or Python FastAPI (heavy: graph compute, AI queries)
- **DB**: PostgreSQL via Supabase (user data, wallet labels, alerts)
- **Cache**: Redis via Upstash
- **AI**: Claude API (function calling, structured tool use)
- **Real-time**: Helius webhooks + WebSockets via Ably or Pusher
- **Email**: Resend
- **Auth/Payments**: Supabase auth + Stripe

## Phase Roadmap
- **Phase 1 (Wks 1–6)**: Explorer UI, wallet search/history, token/NFT info, landing page, GitHub org, docs skeleton, Twitter
- **Phase 2 (Wks 7–14)**: Named wallet system, tracked dashboards, basic relationship queries, flow visualization
- **Phase 3 (Wks 14–20)**: NL query AI interface, wallet AI summaries, smart money tagging, insider cluster detection
- **Phase 4 (Mo 6+)**: API tiers, premium features, alerts, portfolio tracking, team workspaces

## Monthly Infrastructure Costs (Bootstrap)
- Helius Growth: ~$99
- Supabase Pro: ~$25
- Vercel Pro: ~$20
- Upstash Redis: ~$10–30
- Claude API: ~$50–200
- Ably/Pusher: ~$0–29
- Domain + Email: ~$20
- **Total: ~$225–425/mo**

## Funding Strategy
1. Bootstrap to first users
2. Early monetization: $15/mo Pro tier at 200 users = $3k/mo covers infra
3. Solana Foundation grants (developer tooling, $5k–$100k+)
4. Superteam DAO, Phantom ecosystem fund
5. Angel/seed round post-traction (1k+ users)

## Branding Notes (CONFIRMED from QUESTIONS.md answers)
- **Background**: near-black with slight warmth (not pure #000)
- **Text**: off-white (not pure #fff)
- **Accent**: BLOOD RED — confirmed as the single accent color. Used for CTAs, active states, alerts, graph highlights
- **Palette summary**: black / off-white / blood red — three colors only
- **Texture**: subtle scanlines + grid, hero animation. Not heavy.
- **Typography**: JetBrains Mono (addresses/data/code) + Neue Haas Grotesk / NHGrotesk (UI sans-serif). Design weight/size left to UI/UX agent.
- **Logo**: Black bloodhound head silhouette, simple red narrowed eye (possibly crosshair). Simple and brandable. Both icon + wordmark lockup.
- **Name render**: BLOODHOUND — all caps, stylized
- **Layout**: Traditional multi-page dashboard (NOT single-screen terminal). Desktop power tool first, mobile-friendly responsive in mind.
- **Density**: Visually simple but depth for the target user — not Bloomberg dense, not sparse
- **Sidebar**: Left to UI/UX agent based on final tooling structure
- **Tone**: calm, confident, minimal hype. Infra-grade language.
- **Identity language**: tracking, hunting, following trails, detection, signals
- **NOT**: meme tool, alpha call bot, clone explorer, hype-first
- **Graph viz**: animated, restrained
- **Agent design note**: UI/UX agent answers should be marked distinctly (e.g. with `> [AGENT]:` prefix) so they're distinguishable from owner answers

## Product Module Names (Canonical — from message.txt)
1. **Search / Explorer Core** — universal search bar (wallet, token, tx, program, block)
2. **Intelligence Layer** — wallet summaries, counterparties, inflows/outflows, first funding source, clustering signals
3. **Relationship + Flow Mapping** — graph view + timeline view + table view (exportable). "Arkham-lite but focused."
4. **"Ask the Hive"** — NL query terminal (NOT called a chatbot). Returns: short summary + key numbers + clickable evidence (tx links) + confidence level
5. **Tracked Wallets Dashboard** — save wallets with labels, group into lists, set alerts
6. **Signals** — monetization feature: abnormal inflows, new clusters, deployer patterns, wash trading flags. Must be infra-grade, not spammy.
7. **Public API + Docs** — legitimacy + developer layer

## Navigation Structure
Top nav: Explorer | Intelligence | Tracked | Signals | API | Docs
Status bar: network health, indexer sync, API uptime

## MVP Must-Ship (2-week v1)
- Universal search
- Wallet page with clean summary
- Transactions list
- Tracked wallets (save label + quick view)
- "Does X send to Y" relationship query
- Ask the Hive answering basic relationship + wallet summary questions
- Public landing + GitHub org + docs skeleton
MVP can simplify: graph view basic, signals minimal, clustering = basic heuristics
MVP must NOT: feel unfinished or rushed

## Project State
- Working directory: C:\Users\Miri\CascadeProjects\bloodhound (empty — fresh start)
- No GitHub org yet
- No domain secured yet
- No Twitter/X secured yet

## Reference Sites
- **content.png**: "Nexus — Dominating Digital Markets" — primary visual reference. Dark/black bg, glitchy distorted hero figure, high contrast white text, nav: Markets|Tokens|Chain Data|Terminal|Docs|Premium, CTAs: "Free Register" / "Launch Terminal". Charts in lower right. This is the aesthetic direction.
- **talk-2-solana-phi.vercel.app**: Internal test build. Called "Quorum" in UI. Next.js SPA on Vercel. NL→Solana query interface. No API keys wired (barebones test). Source files not yet in repo — get from user. Architecture and data source methodology to be reviewed when files available.

## Key Decisions Still Needed
- Final product name (Bloodhound is working name — need Twitter + domain check)
- Color palette decision (green vs purple)
- Solo build or hiring?
- Claude vs OpenAI for AI layer (currently leaning Claude)

## Links to Topic Files
- [architecture.md](./architecture.md) — detailed technical architecture notes
- [roadmap.md](./roadmap.md) — sprint-by-sprint breakdown
