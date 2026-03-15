# Bloodhound Data Collection & Database Plan

## Overview
Building two primary databases for the leaderboard feature:
1. **KOL Wallets Database** - Named traders with social following
2. **Smart Money Database** - High win-rate anonymous wallets

---

## Current Data Inventory

### ✅ **Fomo App Data** (EXCELLENT - Already in repo)
- **Location**: `scripts/fomo-proxy/scraped_data/`
- **Files**:
  - `fomo_twitter_wallets.json` - 19,303 lines with full profile data
  - `fomo_wallets_summary.json` - 979 wallets with metrics
- **Quality**: Excellent - Has Solana + EVM addresses, Twitter handles, PnL, tiers, followers
- **Data Fields**:
  - Solana & EVM wallet addresses
  - Twitter handle, display name, bio
  - Wallet type (kol, smart_money, market_maker)
  - Tier (legendary, elite, pro, standard)
  - Followers, trades, volume
  - PnL 24h, holdings
  - Account metadata

### ✅ **GMGN Data** (GOOD)
- **Files**: `gmgn-kols-complete.json` (~1,433 wallets)
- **Quality**: Good - Has Twitter handles + performance metrics
- **Data Fields**: Wallet, name, Twitter, PnL, win rate

### ✅ **KOLscan Data** (PARTIAL)
- **Files**: `kolscan-with-twitter.json` (~2,876 wallets)
- **Quality**: Names only, most missing Twitter handles
- **Data Fields**: Wallet address, display name, source

### ✅ **Aggregated/Verified KOLs** (EXCELLENT)
- **Files**: `aggregated-kols.json` (30 wallets)
- **Quality**: High confidence (0.85-0.95)
- **Data Fields**: Wallet, name, Twitter, confidence, verification source

### ⚠️ **Axiom Data** (INCOMPLETE - CRITICAL GAP)
- **Files**: `axiom-global-wallets.json`, `axiom-vision-full.json`
- **Quality**: Poor - Only partial addresses (e.g., "7LMC...P4rK")
- **Have**: 129 Twitter handles, 49 partial addresses with PnL/win rate
- **Need**: Full wallet addresses via mitmproxy

### ⚠️ **Bubblemaps Data** (UNPARSED)
- **Files**: `bubblemaps-api-raw.json` (45KB)
- **Quality**: Unknown - needs parsing
- **Contains**: Token ads and featured tokens data

### ⚠️ **Dex Screener Data** (UNPARSED)
- **Files**: `dexscreener-snapshot.json` (55KB)
- **Quality**: Unknown - appears to be HTML/DOM snapshot
- **Need**: Fresh API data via mitmproxy

### ❌ **Missing Data Sources**
- **PumpFun**: No data - need KOL leaderboard
- **StalkHQ**: No data - need KOL tracking data
- **Dune Analytics**: Script ready but not run (requires API key)

---

## Database Schema Design

### Database 1: KOL Wallets (`kol_wallets`)

```sql
CREATE TABLE kol_wallets (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Wallet Addresses
  solana_address    text UNIQUE NOT NULL,
  evm_address       text,
  
  -- Identity
  display_name      text NOT NULL,
  twitter_handle    text,
  telegram_handle   text,
  avatar_url        text,
  bio               text,
  
  -- Classification
  tier              wallet_tier DEFAULT 'standard',
  is_verified       boolean DEFAULT false,
  
  -- Performance Metrics
  total_pnl_sol     decimal(20,8) DEFAULT 0,
  total_pnl_usd     decimal(20,2) DEFAULT 0,
  win_rate          decimal(5,2) DEFAULT 0,
  total_trades      integer DEFAULT 0,
  total_volume_usd  decimal(20,2) DEFAULT 0,
  
  -- Time-based PnL
  pnl_1d_usd        decimal(20,2) DEFAULT 0,
  pnl_7d_usd        decimal(20,2) DEFAULT 0,
  pnl_30d_usd       decimal(20,2) DEFAULT 0,
  
  -- Social Metrics
  followers_count   integer DEFAULT 0,
  following_count   integer DEFAULT 0,
  
  -- Data Sources (array of sources)
  sources           text[] DEFAULT '{}',
  
  -- Metadata
  first_seen_at     timestamptz DEFAULT now(),
  last_updated_at   timestamptz DEFAULT now(),
  
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kol_twitter ON kol_wallets(twitter_handle);
CREATE INDEX idx_kol_pnl_1d ON kol_wallets(pnl_1d_usd DESC);
CREATE INDEX idx_kol_pnl_7d ON kol_wallets(pnl_7d_usd DESC);
CREATE INDEX idx_kol_tier ON kol_wallets(tier);
```

### Database 2: Smart Money Wallets (`smart_money_wallets`)

```sql
CREATE TABLE smart_money_wallets (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Wallet Addresses
  solana_address    text UNIQUE NOT NULL,
  evm_address       text,
  
  -- Optional Identity (some may have names/handles)
  display_name      text,
  twitter_handle    text,
  
  -- Classification
  wallet_type       text DEFAULT 'smart_money', -- smart_money, sniper, whale, insider
  tier              wallet_tier DEFAULT 'standard',
  
  -- Performance Metrics
  total_pnl_sol     decimal(20,8) DEFAULT 0,
  total_pnl_usd     decimal(20,2) DEFAULT 0,
  win_rate          decimal(5,2) NOT NULL, -- Must have high win rate
  total_trades      integer DEFAULT 0,
  total_volume_usd  decimal(20,2) DEFAULT 0,
  
  -- Time-based PnL
  pnl_1d_usd        decimal(20,2) DEFAULT 0,
  pnl_7d_usd        decimal(20,2) DEFAULT 0,
  pnl_30d_usd       decimal(20,2) DEFAULT 0,
  
  -- Smart Money Specific Metrics
  avg_hold_time_mins integer DEFAULT 0,
  snipe_count       integer DEFAULT 0,
  early_entry_rate  decimal(5,2) DEFAULT 0,
  
  -- Data Sources
  sources           text[] DEFAULT '{}',
  
  -- Metadata
  first_seen_at     timestamptz DEFAULT now(),
  last_updated_at   timestamptz DEFAULT now(),
  
  created_at        timestamptz NOT NULL DEFAULT now(),
  
  -- Constraint: Must have decent win rate to be smart money
  CONSTRAINT smart_money_win_rate CHECK (win_rate >= 50.0)
);

CREATE INDEX idx_smart_money_win_rate ON smart_money_wallets(win_rate DESC);
CREATE INDEX idx_smart_money_pnl_1d ON smart_money_wallets(pnl_1d_usd DESC);
CREATE INDEX idx_smart_money_type ON smart_money_wallets(wallet_type);
```

---

## Data Source Mapping

### KOL Wallets Sources:
1. ✅ **Fomo App** - `fomo_twitter_wallets.json` (filter: `wallet_type = 'kol'`)
2. ✅ **GMGN** - Copytrade > KOLs leaderboard (`gmgn-kols-complete.json`)
3. ⚠️ **KOLscan** - KOL database (have addresses, need Twitter via scraping)
4. ❌ **Axiom** - Vision > KOLs Leaderboard (need full addresses via mitmproxy)
5. ❌ **PumpFun** - KOL leaderboard (need to scrape via mitmproxy)
6. ❌ **Dex Screener** - KOL database (need to scrape via mitmproxy)
7. ❌ **StalkHQ** - KOL tracking (need to scrape via mitmproxy)

### Smart Money Sources:
1. ✅ **Fomo App** - `fomo_wallets_summary.json` (filter: `wallet_type IN ('smart_money', 'market_maker')`)
2. ✅ **GMGN** - Smart money section (need to scrape fresh data)
3. ⚠️ **Axiom** - Global wallets leaderboard (have partials, need full addresses)
4. ❌ **Dune Analytics** - API (requires `DUNE_API_KEY` env var)

---

## Data Collection Plan

### Phase 1: Parse Existing Data ✅
**Priority**: High | **Method**: Local parsing

1. **Parse Bubblemaps data** (`bubblemaps-api-raw.json`)
   - Extract token addresses and metadata
   - Identify any wallet addresses in the data

2. **Parse Dex Screener snapshot** (`dexscreener-snapshot.json`)
   - Extract any wallet/trader data from DOM snapshot
   - Determine if useful or if fresh scrape needed

### Phase 2: Axiom Full Addresses 🔴 CRITICAL
**Priority**: HIGHEST | **Method**: mitmproxy

**Target**: Get full wallet addresses for 49 partial addresses + 129 KOL profiles

**Steps**:
1. Turn on mitmproxy on phone/PC
2. Navigate to Axiom Vision > KOLs Leaderboard
3. Capture API calls that return full wallet addresses
4. Click individual KOL profiles to get detailed data
5. Extract: `address`, `name`, `twitter`, `pnl`, `win_rate`, `trades`, `volume`

**Expected API Endpoints**:
- `/api/v1/kols/leaderboard`
- `/api/v1/kol/{id}/profile`
- `/api/v1/wallets/global`

**Script**: Update `scripts/scrape-axiom-kols.mjs` to parse mitmproxy HAR export

### Phase 3: PumpFun KOL Data ❌
**Priority**: High | **Method**: mitmproxy

**Target**: Creator wallets and KOL leaderboard

**Steps**:
1. Turn on mitmproxy
2. Navigate to PumpFun KOL leaderboard
3. Capture API responses
4. Extract: `creator_address`, `name`, `twitter`, `tokens_created`, `total_volume`

**Expected API Endpoints**:
- `/api/kols`
- `/api/creators/leaderboard`

**Script**: Update `scripts/scrape-pumpfun-profiles.mjs`

### Phase 4: Dex Screener KOL Database ❌
**Priority**: High | **Method**: mitmproxy

**Target**: Top traders and KOL database

**Steps**:
1. Turn on mitmproxy
2. Navigate to Dex Screener top traders section
3. Capture API calls
4. Extract: `wallet_address`, `name`, `twitter`, `pnl`, `trades`

**Expected API Endpoints**:
- `/api/traders/top`
- `/api/kols`

**Script**: Update `scripts/scrape-dexscreener-kols.mjs`

### Phase 5: StalkHQ Data ❌
**Priority**: Medium | **Method**: mitmproxy

**Target**: KOL tracking and smart money identification

**Steps**:
1. Turn on mitmproxy
2. Navigate to StalkHQ KOL tracking
3. Capture API responses
4. Extract: `wallet_address`, `name`, `twitter`, `metrics`

**Script**: Create `scripts/scrape-stalkhq-kols.mjs`

### Phase 6: GMGN Smart Money ⚠️
**Priority**: Medium | **Method**: mitmproxy

**Target**: Fresh smart money wallet data

**Steps**:
1. Turn on mitmproxy
2. Navigate to GMGN Smart Money section
3. Capture API calls
4. Extract: `wallet_address`, `win_rate`, `pnl`, `trades`

**Script**: Update `scripts/scrape-gmgn-smart-money.mjs`

### Phase 7: Dune Analytics (Optional) 📝
**Priority**: Low | **Method**: API

**Requirement**: Set `DUNE_API_KEY` environment variable

**Target**: Volume-ranked traders with Twitter handles

**Script**: Already integrated in `scripts/seed-known-wallets.mjs`

---

## Mitmproxy Workflow

### Setup
```bash
# Start mitmproxy on PC
mitmproxy -p 8080 --set block_global=false

# Or use mitmweb for web interface
mitmweb -p 8080
```

### Phone Setup (already configured)
- Proxy IP: [Your PC IP]
- Proxy Port: 8080
- SSL Certificate: Installed

### Capture Process
1. Start mitmproxy
2. Navigate to target site on phone/browser
3. Perform actions (scroll leaderboard, click profiles)
4. Export HAR file: `File > Save > HAR`
5. Parse HAR with scripts

### HAR Parsing Template
```javascript
import { readFile } from 'fs/promises';

async function parseHAR(harPath) {
  const har = JSON.parse(await readFile(harPath, 'utf-8'));
  const entries = har.log.entries;
  
  const apiCalls = entries.filter(e => 
    e.request.url.includes('/api/') && 
    e.response.content.mimeType?.includes('json')
  );
  
  for (const entry of apiCalls) {
    const url = entry.request.url;
    const responseText = entry.response.content.text;
    const data = JSON.parse(responseText);
    
    // Process data...
  }
}
```

---

## Data Aggregation Pipeline

### Deduplication Strategy
1. **Primary Key**: `solana_address` (unique)
2. **Merge Logic**: When same address found in multiple sources:
   - Keep most complete Twitter handle
   - Sum/average PnL metrics
   - Combine sources array
   - Use highest confidence tier

### Classification Logic
```javascript
function classifyWallet(data) {
  // KOL if has Twitter handle + followers > 1000
  if (data.twitter_handle && data.followers > 1000) {
    return 'kol_wallets';
  }
  
  // Smart Money if high win rate (>50%) regardless of identity
  if (data.win_rate >= 50) {
    return 'smart_money_wallets';
  }
  
  // Default to smart money if profitable
  return 'smart_money_wallets';
}
```

---

## Seeder Scripts

### 1. `scripts/seed-kol-wallets.mjs`
Aggregates and seeds KOL wallets from:
- Fomo App data (filter KOLs)
- GMGN KOLs
- KOLscan data
- Axiom KOLs (once scraped)
- PumpFun KOLs (once scraped)
- Dex Screener KOLs (once scraped)
- StalkHQ KOLs (once scraped)

### 2. `scripts/seed-smart-money.mjs`
Aggregates and seeds smart money from:
- Fomo App data (filter smart_money)
- GMGN smart money
- Axiom global wallets (once scraped)
- Dune Analytics (if API key set)

---

## Leaderboard Page Requirements

### Default View: KOL Daily Rankings
- Sort by: `pnl_1d_usd DESC`
- Display: Name, Twitter, PnL 24h, Win Rate, Trades
- Filters: Tier, Time Period (1d/7d/30d/all)

### Design Inspiration: Axiom Leaderboard
- Clean table layout
- Avatar images
- Color-coded PnL (green/red)
- Sortable columns
- Search by name/Twitter

### Additional Views
- Smart Money Rankings (high win rate)
- Volume Leaders
- Sniper Leaderboard (early entries)
- Rising Stars (new high performers)

---

## Next Steps

1. ✅ Parse Bubblemaps and Dex Screener existing data
2. 🔴 **PRIORITY**: Scrape Axiom full addresses via mitmproxy
3. Scrape PumpFun KOL data via mitmproxy
4. Scrape Dex Screener KOL data via mitmproxy
5. Scrape StalkHQ data via mitmproxy
6. Build aggregation pipeline
7. Create seeder scripts
8. Test database population
9. Build leaderboard API endpoints
10. Implement leaderboard UI

---

## Estimated Data Volume

### KOL Wallets Database
- Fomo: ~200-300 KOLs
- GMGN: ~1,433 KOLs
- KOLscan: ~2,876 (need Twitter enrichment)
- Axiom: ~129 KOLs
- PumpFun: TBD
- Dex Screener: TBD
- StalkHQ: TBD

**Estimated Total**: 3,000-5,000 unique KOL wallets

### Smart Money Database
- Fomo: ~600-700 smart money
- GMGN: TBD
- Axiom: ~49+ global wallets
- Dune: TBD

**Estimated Total**: 1,000-2,000 unique smart money wallets

---

## Success Criteria

- [ ] All data sources scraped and parsed
- [ ] Both databases populated with deduplicated data
- [ ] >3,000 KOL wallets with Twitter handles
- [ ] >1,000 smart money wallets with >50% win rate
- [ ] Leaderboard API endpoints functional
- [ ] Leaderboard UI matches Axiom quality
- [ ] Data refresh pipeline automated
