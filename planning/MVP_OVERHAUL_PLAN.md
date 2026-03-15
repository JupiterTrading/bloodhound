# BLOODHOUND — MVP Overhaul Implementation Plan

**Created:** Mar 13, 2026  
**Source:** Finished Product Idea Sheet + UI_OVERHAUL_PLAN.md  
**Goal:** Transform BLOODHOUND into a polished, production-ready MVP with real data, KOL tracking, AI-powered intelligence, and a distinctive neo-terminal aesthetic.

---

## Executive Summary

This plan consolidates the Finished Product Idea Sheet requirements into actionable work streams. The overhaul covers:

1. **KOL Wallet Database** — Real wallet data from scraped sources
2. **AI-Powered Search Engine** — Dynamic, context-aware intelligence
3. **KOL Rankings System** — Leaderboard with profit tracking
4. **Site Redesign** — Living neo-terminal aesthetic with sidebar nav
5. **User Profiles/Portfolio** — Personal wallet tracking
6. **Data Actualization** — Remove fake data, connect real APIs

---

## Current State Assessment

### What Exists
- **46 components, 21+ pages** including wallet profiles, token pages, graph view, AI terminal
- **Landing page** with live KOL feed (using fallback data), feature sections
- **Top nav layout** with search bar
- **Basic styling** — dark theme, accent color, some animations
- **API backend** — FastAPI with wallet polling, pump.fun monitor, new pair detection

### Key Issues from Idea Sheet
1. **Redundant/fake pages** — Explorer Intelligence, Tracked Signals pages with placeholder data
2. **Boring design** — "Little to no animations or interesting hero animations"
3. **Top nav instead of sidebar** — User prefers sidebar navigation
4. **Hero animation** — Should show real KOL wallet trading data
5. **No user profiles** — Missing sign-in, portfolio tracking
6. **No KOL database** — Need to integrate scraped wallet data
7. **No KOL rankings** — Need leaderboard with profit calculations

---

## Phase 1: KOL Wallet Database Integration

**Priority: CRITICAL** — Foundation for all other features

### 1.1 Database Schema Updates

Add to Supabase (`packages/db/schema/`):

```sql
-- KOL Profiles (aggregates multiple wallets per person)
CREATE TABLE kol_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    text NOT NULL,
  twitter_handle  text UNIQUE,
  twitter_pfp_url text,                    -- Profile picture URL
  telegram_handle text,
  description     text,
  source          text NOT NULL,           -- birdeye | dune | arkham | gmgn | axiom | kolscan | dexscreener | pumpfun | fomo | manual
  verified        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- KOL Wallets (links wallets to profiles)
CREATE TABLE kol_wallets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_profile_id  uuid REFERENCES kol_profiles(id) ON DELETE CASCADE,
  address         text NOT NULL UNIQUE,
  label           text,                    -- "Main", "Side 1", etc.
  is_primary      boolean DEFAULT false,
  discovered_via  text,                    -- 'scraped' | 'side_wallet_detection' | 'user_submission'
  confidence      float DEFAULT 1.0,
  created_at      timestamptz DEFAULT now()
);

-- User Wallet Submissions (for review)
CREATE TABLE kol_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text NOT NULL,
  twitter_handle  text,
  display_name    text,
  evidence_text   text,
  evidence_urls   text[],
  submitter_id    uuid REFERENCES users(id),
  status          text DEFAULT 'pending',  -- pending | approved | rejected
  reviewer_note   text,
  created_at      timestamptz DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_kol_wallets_address ON kol_wallets(address);
CREATE INDEX idx_kol_profiles_twitter ON kol_profiles(twitter_handle);
```

### 1.2 Data Import Pipeline

**File:** `scripts/import-kol-wallets.mjs`

Import scraped data from:
- [x] Birdeye (you're scraping in another window)
- [ ] Dune Analytics
- [ ] Arkham
- [ ] GMGN
- [ ] Axiom (and competitors)
- [ ] PumpFun
- [ ] KOLScan
- [ ] DexScreener / Gekoterminal

**Import Format:**
```json
{
  "twitter_handle": "@punk6529",
  "display_name": "punk6529",
  "wallets": ["DezX...Bt1v", "AbCd...Ef12"],
  "source": "birdeye",
  "pfp_url": "https://pbs.twimg.com/..."
}
```

### 1.3 Side Wallet Detection

**File:** `apps/api/app/services/side_wallet_detector.py`

Methodology signals:
1. **Funding chain** — Same initial funder
2. **Timing patterns** — Transactions within seconds
3. **Shared counterparties** — Same obscure wallets interacted
4. **Co-sniping** — Same tokens at similar times
5. **Jito bundle membership** — Same bundle signatures

Output to `side_wallet_candidates` table with confidence scores.

### 1.4 KOL Profile Pages

**File:** `apps/web/src/app/(app)/kol/[handle]/page.tsx`

Features:
- Twitter PFP as profile image
- All linked wallets with labels
- Aggregate stats across all wallets
- Trade history (combined)
- Top tokens traded
- Profit/loss metrics
- "Star" button to track

---

## Phase 2: AI-Powered Search Engine Overhaul

**Priority: HIGH** — Key differentiator

### 2.1 Enhanced AI Capabilities

**File:** `apps/api/app/services/ai_agent.py`

The Bloodhound AI should answer:

| Query Type | Example | Data Sources |
|------------|---------|--------------|
| Token info | "What's the current price of BONK?" | Jupiter, Birdeye |
| Token analysis | "Is this token bundled? By how much?" | PumpFun, on-chain |
| KOL info | "What tokens has punk mentioned?" | Twitter API + DB |
| KOL wallets | "Show me punk's wallets" | kol_wallets table |
| KOL relationships | "Does punk trade similar to ansem?" | Trade history analysis |
| New pairs | "Any interesting new tokens?" | new_pairs + trending analysis |
| Wallet analysis | "Summarize wallet DezX..." | All wallet data |

### 2.2 Dynamic AI Dashboard

**File:** `apps/web/src/app/(app)/ai/page.tsx`

Response types:
- **Text responses** — Markdown with inline citations
- **Charts** — TradingView embeds, Tremor charts
- **Wallet cards** — Mini profile components
- **Token cards** — Price, chart, holders
- **Graph embeds** — Relationship visualization
- **Links** — To internal pages, Twitter, Telegram

### 2.3 Agentic Actions

AI can trigger:
- Track a wallet (add to user's tracked list)
- Set an alert
- Open graph view
- Navigate to wallet/token page

---

## Phase 3: KOL Rankings Leaderboard

**Priority: HIGH** — Unique feature

### 3.1 Rankings Calculation

**File:** `apps/api/app/services/kol_rankings.py`

Calculate for each KOL profile (across all wallets):
- **Total realized PnL** (daily/weekly/monthly/all-time)
- **Win rate** (% profitable trades)
- **Avg return per trade**
- **Volume traded**
- **Sharpe ratio** (if fancy)

**ClickHouse materialized view:**
```sql
CREATE MATERIALIZED VIEW kol_stats_daily
ENGINE = SummingMergeTree()
ORDER BY (kol_profile_id, date)
AS SELECT
  kw.kol_profile_id,
  toDate(tt.block_time) AS date,
  sum(tt.realized_pnl_usd) AS daily_pnl,
  count() AS trade_count,
  countIf(tt.realized_pnl_usd > 0) AS winning_trades
FROM token_trades tt
JOIN kol_wallets kw ON tt.trader = kw.address
GROUP BY kw.kol_profile_id, date;
```

### 3.2 Rankings Page

**File:** `apps/web/src/app/(app)/rankings/page.tsx`

Features:
- **Time filter tabs:** Daily | Weekly | Monthly | All-Time
- **Sortable columns:** Rank, Name, PnL, Win Rate, Volume
- **KOL row:** PFP, name, Twitter link, top stat, sparkline
- **Click to expand:** Top tokens, recent trades
- **Exclude non-KOLs:** Filter out protocols (Jupiter, Meteora, WIF team, etc.)

---

## Phase 4: Site Redesign — Neo-Terminal Aesthetic

**Priority: HIGH** — User experience

### 4.1 Navigation Overhaul

**Convert from top nav to sidebar nav:**

```
┌────────────────────────────────────────────────┐
│ [Logo] BLOODHOUND          [Search] [Profile]  │
├──────┬─────────────────────────────────────────┤
│      │                                         │
│  📊  │  [Main content area]                    │
│  Dash│                                         │
│      │                                         │
│  🔍  │                                         │
│ Explo│                                         │
│      │                                         │
│  👤  │                                         │
│  KOLs│                                         │
│      │                                         │
│  🏆  │                                         │
│ Ranks│                                         │
│      │                                         │
│  🤖  │                                         │
│  AI  │                                         │
│      │                                         │
│  ⭐  │                                         │
│Track │                                         │
│      │                                         │
└──────┴─────────────────────────────────────────┘
```

**Sidebar items:**
1. Dashboard (home)
2. Explorer (search)
3. KOL Profiles (new)
4. Rankings (new)
5. Bloodhound AI
6. Tracked Wallets
7. Portfolio (if signed in)
8. New Pairs
9. ---
10. Settings

### 4.2 Remove Redundant Pages

**Delete/hide:**
- `/intelligence` — Placeholder data
- `/signals` — Merge into dashboard or AI alerts
- `/tracked` — Restructure into sidebar panel

### 4.3 Design System Upgrade

**Install skill for animations:**
```bash
npx skills add mager/frontend-design@frontend-design -g -y
```

**Apply to all pages:**
- Living micro-animations (pulsing badges, blinking cursors)
- Staggered load animations
- Smooth transitions between pages
- Scanline/grid overlay textures
- Terminal-inspired typography

### 4.4 Hero Animation with Real Data

**File:** `apps/web/src/components/landing/LandingHero.tsx`

Replace fallback data with real streaming KOL trades:
- WebSocket connection to API
- Live trade ticker
- PFP thumbnails next to trades
- Smooth scroll animation

---

## Phase 5: User Profiles & Portfolio

**Priority: MEDIUM** — User engagement

### 5.1 Auth Integration

Already using Clerk. Ensure:
- Sign in/up buttons visible
- User profile dropdown
- Protected routes for portfolio

### 5.2 User Portfolio Page

**File:** `apps/web/src/app/(app)/portfolio/page.tsx`

Features:
- Add own wallets (private by default)
- Track balances across wallets
- PnL tracking for user's trades
- Aggregate portfolio view
- Export trade history

### 5.3 Wallet Submission Form

**File:** `apps/web/src/app/(app)/submit/page.tsx`

Form fields:
- Wallet address (required)
- Twitter handle
- Display name
- Evidence text
- Evidence image uploads (Supabase Storage)
- Submit for review

### 5.4 Admin Review Panel

**File:** `apps/web/src/app/(app)/admin/submissions/page.tsx`

- List pending submissions
- Approve/reject with notes
- Auto-create KOL profile on approve

---

## Phase 6: Data Actualization

**Priority: CRITICAL** — Replace all fake data

### 6.1 Audit All Fallback Data

Files with `FALLBACK_` constants:
- `LandingHero.tsx` — Replace with real API data
- Remove placeholder stats
- Ensure error states instead of fake data

### 6.2 Connect Real APIs

| Feature | Current State | Target |
|---------|---------------|--------|
| KOL Feed | Fallback array | ClickHouse token_trades |
| New Pairs | Fallback array | pump.fun + raydium APIs |
| Trending | Fallback array | Birdeye trending endpoint |
| Signals | Fallback array | signals table in ClickHouse |
| Wallet data | Real ✓ | Real ✓ |
| Token prices | Real ✓ | Real ✓ |

### 6.3 Live Streaming

WebSocket endpoints for:
- KOL trades (real-time)
- New pair launches
- Signal alerts
- Price updates

---

## Execution Order

### Sprint 1: Foundation (Week 1)
1. [ ] Database schema updates for KOL profiles
2. [ ] Import pipeline for scraped wallets
3. [ ] KOL profile API endpoints
4. [ ] Remove fake data from landing page

### Sprint 2: KOL System (Week 2)
5. [ ] KOL profile pages
6. [ ] Side wallet detection service
7. [ ] KOL rankings calculation
8. [ ] Rankings leaderboard page

### Sprint 3: Navigation & Design (Week 3)
9. [ ] Sidebar navigation implementation
10. [ ] Remove redundant pages
11. [ ] Install frontend-design skill
12. [ ] Apply neo-terminal styling page-by-page

### Sprint 4: AI & User Features (Week 4)
13. [ ] Enhance AI with KOL queries
14. [ ] Dynamic AI response components
15. [ ] User portfolio page
16. [ ] Wallet submission form
17. [ ] Admin review panel

### Sprint 5: Polish (Week 5)
18. [ ] Hero animation with real KOL data
19. [ ] Live streaming WebSockets
20. [ ] Performance optimization
21. [ ] Mobile responsive pass
22. [ ] QA testing

---

## Available Design Skills

Found via `npx skills find`:

| Skill | Installs | Use Case |
|-------|----------|----------|
| `mager/frontend-design@frontend-design` | 893 | Production-grade UI design |
| `julianromli/ai-skills@frontend-ui-animator` | 139 | UI animations |
| `petbrains/mvp-builder@frontend-magic-ui` | 81 | Magic UI effects |

**Recommended:** Install `frontend-design` for systematic design improvements.

---

## Success Metrics

When complete:
- [ ] Hero shows real KOL trades streaming
- [ ] 100+ KOL profiles with Twitter PFPs
- [ ] Rankings page with accurate PnL data
- [ ] Sidebar navigation feels professional
- [ ] AI answers questions about KOLs and tokens
- [ ] Users can track wallets and submit new ones
- [ ] Zero fake/placeholder data visible
- [ ] Site feels "alive" — animations, streaming data, pulsing indicators

---

## Notes

- **Fomo App data:** Mobile app, may need reverse engineering or manual data entry
- **Twitter PFPs:** Cache in Supabase Storage to avoid rate limits
- **AI costs:** Monitor Claude API usage, use Haiku for classification
- **Side wallet detection:** Start conservative, let users dispute false positives

---

## Files to Create/Modify

### New Files
- `packages/db/schema/003_kol_profiles.sql`
- `apps/api/app/routers/kol.py`
- `apps/api/app/services/kol_rankings.py`
- `apps/api/app/services/side_wallet_detector.py`
- `apps/web/src/app/(app)/kol/[handle]/page.tsx`
- `apps/web/src/app/(app)/rankings/page.tsx`
- `apps/web/src/app/(app)/submit/page.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `scripts/import-kol-wallets.mjs`

### Major Modifications
- `apps/web/src/app/(app)/layout.tsx` — Sidebar nav
- `apps/web/src/components/landing/LandingHero.tsx` — Real data
- `apps/web/src/app/(app)/ai/page.tsx` — Dynamic responses
- `apps/web/src/app/page.tsx` — Landing redesign
- `apps/web/src/app/globals.css` — Animation tokens

### Delete/Deprecate
- `/intelligence` page (or merge functionality)
- `/signals` page (merge into dashboard)
- Redundant nav items
