# Bloodhound Data Collection Workflow

## Strategy: Collect First, Aggregate Second, Build Third

### Phase 1: Data Collection (Current Focus)
Gather all raw data from sources with proper organization for easy upload

### Phase 2: Data Aggregation
Deduplicate, match identities, merge datasets

### Phase 3: Site Integration
Build leaderboard and KOL profile pages

---

## Data Collection Checklist

### ✅ **Already Have (Good Quality)**
- [x] Fomo App data (979 wallets, excellent quality)
- [x] GMGN KOLs (1,433 wallets with Twitter)
- [x] Aggregated verified KOLs (30 wallets, high confidence)

### ⚠️ **Have But Need Verification/Recollection**
- [ ] KOLscan data (2,876 wallets) - **Issue**: Telegram handles copied incorrectly
- [ ] Axiom data - **Issue**: Only partial addresses
- [ ] Bubblemaps data - **Issue**: Unparsed raw API response
- [ ] Dex Screener data - **Issue**: DOM snapshot, not structured data

### ❌ **Need to Collect**
- [ ] Axiom full addresses (Vision > KOLs + Global wallets)
- [ ] PumpFun KOL leaderboard
- [ ] Dex Screener KOL database (fresh API data)
- [ ] StalkHQ KOL tracking
- [ ] GMGN Smart Money section (fresh data)

---

## Data Organization Requirements

### Standard Format for All Sources

Each data source should output JSON in this format:

```json
{
  "source": "axiom_kols",
  "collected_at": "2026-03-13T23:00:00Z",
  "total_records": 129,
  "data": [
    {
      "solana_address": "FULL_ADDRESS_HERE",
      "evm_address": "0x...",
      "display_name": "Trader Name",
      "twitter_handle": "handle_only_no_at",
      "telegram_handle": "handle_only_no_at",
      "avatar_url": "https://...",
      "bio": "Bio text",
      "metrics": {
        "pnl_24h_usd": 12345.67,
        "pnl_7d_usd": 45678.90,
        "pnl_30d_usd": 123456.78,
        "win_rate": 65.5,
        "total_trades": 234,
        "total_volume_usd": 567890.12,
        "followers_count": 12000,
        "following_count": 345
      },
      "tier": "elite",
      "wallet_type": "kol",
      "is_verified": false
    }
  ]
}
```

### Identity Field Normalization

**Critical**: Ensure consistency across sources

1. **Twitter handles**: 
   - Remove `@` symbol
   - Lowercase
   - Trim whitespace
   - Example: `@BlaBoratory` → `blaboratory`

2. **Telegram handles**:
   - Remove `@` symbol
   - Lowercase
   - Trim whitespace
   - Example: `@SomeUser` → `someuser`

3. **Display names**:
   - Keep original casing
   - Trim whitespace
   - Remove emoji if needed for matching

4. **Wallet addresses**:
   - Solana: 32-44 character base58
   - EVM: 42 character hex with `0x` prefix
   - Validate format before storing

---

## Mitmproxy Collection Workflow

### Setup (Already Done)
- ✅ Mitmproxy installed on PC
- ✅ Phone configured with proxy
- ✅ SSL certificates installed

### Collection Process for Each Source

#### 1. **Axiom Vision > KOLs** 🔴 PRIORITY 1

**Target URL**: `https://axiom.xyz/vision/kols`

**Steps**:
1. Start mitmproxy: `mitmweb -p 8080`
2. Navigate to Axiom Vision > KOLs Leaderboard
3. Scroll through entire leaderboard (load all pages)
4. Click on individual KOL profiles (at least top 50)
5. Capture API responses
6. Export HAR: File > Save > `axiom-kols-[date].har`

**Expected API Endpoints**:
```
GET /api/v1/kols/leaderboard?period=24h&limit=100
GET /api/v1/kol/{id}/profile
GET /api/v1/kol/{id}/trades
```

**Data to Extract**:
- Full wallet address (not partial)
- Name, Twitter handle
- PnL (24h, 7d, 30d)
- Win rate, total trades
- Volume metrics
- Follower count

**Output File**: `scripts/kol-data/axiom-kols-complete-[date].json`

---

#### 2. **Axiom Global Wallets** 🔴 PRIORITY 2

**Target URL**: `https://axiom.xyz/global`

**Steps**:
1. Navigate to Axiom Global Wallets leaderboard
2. Scroll through top 100 wallets
3. Click on wallet profiles to get full addresses
4. Capture API responses
5. Export HAR: `axiom-global-[date].har`

**Expected API Endpoints**:
```
GET /api/v1/wallets/global?period=24h&limit=100
GET /api/v1/wallet/{address}/profile
```

**Data to Extract**:
- Full wallet address
- PnL, win rate, trades
- Volume metrics
- Any available identity info

**Output File**: `scripts/kol-data/axiom-global-complete-[date].json`

---

#### 3. **PumpFun KOL Leaderboard** ❌ PRIORITY 3

**Target URL**: `https://pump.fun/kols` (or similar)

**Steps**:
1. Navigate to PumpFun KOL section
2. Scroll through leaderboard
3. Click on creator profiles
4. Capture API responses
5. Export HAR: `pumpfun-kols-[date].har`

**Expected API Endpoints**:
```
GET /api/kols
GET /api/creator/{id}
```

**Data to Extract**:
- Creator wallet address
- Name, Twitter handle
- Tokens created
- Total volume
- Success rate

**Output File**: `scripts/kol-data/pumpfun-kols-[date].json`

---

#### 4. **Dex Screener KOL Database** ❌ PRIORITY 4

**Target URL**: `https://dexscreener.com/traders` or KOL section

**Steps**:
1. Navigate to Dex Screener top traders
2. Scroll through leaderboard
3. Click on trader profiles
4. Capture API responses
5. Export HAR: `dexscreener-kols-[date].har`

**Expected API Endpoints**:
```
GET /api/traders/top
GET /api/trader/{id}
```

**Data to Extract**:
- Wallet address
- Name, Twitter handle
- PnL, trades
- Volume metrics

**Output File**: `scripts/kol-data/dexscreener-kols-[date].json`

---

#### 5. **StalkHQ KOL Tracking** ❌ PRIORITY 5

**Target URL**: `https://stalkhq.com` (or similar)

**Steps**:
1. Navigate to StalkHQ KOL section
2. Browse tracked KOLs
3. Capture API responses
4. Export HAR: `stalkhq-kols-[date].har`

**Data to Extract**:
- Wallet addresses
- Identity info
- Tracking metrics

**Output File**: `scripts/kol-data/stalkhq-kols-[date].json`

---

#### 6. **GMGN Smart Money** ⚠️ PRIORITY 6

**Target URL**: `https://gmgn.ai/smart-money`

**Steps**:
1. Navigate to GMGN Smart Money section
2. Scroll through leaderboard
3. Capture API responses
4. Export HAR: `gmgn-smart-money-[date].har`

**Data to Extract**:
- Wallet addresses
- Win rate, PnL
- Trade metrics

**Output File**: `scripts/kol-data/gmgn-smart-money-[date].json`

---

## HAR Parsing Scripts

### Template Script: `scripts/parse-har-template.mjs`

```javascript
import { readFile, writeFile } from 'fs/promises';

async function parseHAR(harPath, targetApiPattern, outputPath) {
  console.log(`Parsing HAR: ${harPath}`);
  
  const har = JSON.parse(await readFile(harPath, 'utf-8'));
  const entries = har.log.entries;
  
  // Filter for target API calls
  const apiCalls = entries.filter(e => {
    const url = e.request.url;
    const isJson = e.response.content.mimeType?.includes('json');
    const matchesPattern = url.includes(targetApiPattern);
    return isJson && matchesPattern;
  });
  
  console.log(`Found ${apiCalls.length} matching API calls`);
  
  const allData = [];
  
  for (const entry of apiCalls) {
    const url = entry.request.url;
    const responseText = entry.response.content.text;
    
    if (!responseText) continue;
    
    try {
      const data = JSON.parse(responseText);
      allData.push({ url, data });
    } catch (err) {
      console.warn(`Failed to parse response from ${url}`);
    }
  }
  
  // Process and normalize data
  const normalized = normalizeData(allData);
  
  // Write output
  const output = {
    source: outputPath.split('/').pop().replace('.json', ''),
    collected_at: new Date().toISOString(),
    total_records: normalized.length,
    data: normalized
  };
  
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${normalized.length} records to ${outputPath}`);
}

function normalizeData(rawData) {
  // Implement source-specific normalization
  return rawData.map(item => ({
    // Normalize to standard format
  }));
}

export { parseHAR };
```

### Create Specific Parsers

1. `scripts/parse-axiom-har.mjs`
2. `scripts/parse-pumpfun-har.mjs`
3. `scripts/parse-dexscreener-har.mjs`
4. `scripts/parse-stalkhq-har.mjs`
5. `scripts/parse-gmgn-har.mjs`

---

## Data Aggregation Strategy

### Phase 2: After All Data Collected

#### Step 1: Identity Matching

**Matching Logic** (in priority order):

1. **Exact wallet address match** (primary key)
2. **Twitter handle match** (strong signal)
3. **Telegram handle match** (medium signal)
4. **Display name similarity** (weak signal, use fuzzy matching)

**Issues to Handle**:
- KOLscan telegram duplication issue
- Name variations (emojis, casing)
- Multiple wallets per person

#### Step 2: Data Merging

When same identity found across sources:

```javascript
function mergeWalletData(records) {
  const merged = {
    solana_address: records[0].solana_address, // Primary
    evm_address: records.find(r => r.evm_address)?.evm_address,
    
    // Take most complete identity
    display_name: getMostComplete(records, 'display_name'),
    twitter_handle: getMostComplete(records, 'twitter_handle'),
    telegram_handle: getMostTrusted(records, 'telegram_handle'), // Avoid KOLscan
    avatar_url: getMostComplete(records, 'avatar_url'),
    bio: getMostComplete(records, 'bio'),
    
    // Aggregate metrics (take most recent or average)
    metrics: {
      pnl_24h_usd: getLatest(records, 'metrics.pnl_24h_usd'),
      win_rate: average(records, 'metrics.win_rate'),
      total_trades: sum(records, 'metrics.total_trades'),
      // ...
    },
    
    // Track all sources
    sources: records.map(r => r.source),
    confidence: calculateConfidence(records)
  };
  
  return merged;
}
```

#### Step 3: Connected Wallet Detection

**System Requirements**:
- Analyze on-chain transaction patterns
- Identify wallets that frequently interact
- Group wallets by common ownership patterns
- Display all connected wallets on KOL profile

**Detection Methods**:
1. Same funding source
2. Frequent transfers between wallets
3. Simultaneous trading patterns
4. Shared token holdings
5. Same withdrawal destinations

**Note**: Check if this system already exists in codebase, build if needed

---

## KOL Profile Page Design

### Profile Structure

```
┌─────────────────────────────────────────┐
│  [Avatar]  KOL Name (@twitter)          │
│            @telegram                     │
│            Bio text here...              │
│                                          │
│  🐦 12,000 Twitter Followers             │
│  💬 5,400 Telegram Members               │
│  ⭐ Elite Tier                           │
├─────────────────────────────────────────┤
│  Performance Metrics                     │
│  24h PnL: $12,345  Win Rate: 65.5%      │
│  7d PnL: $45,678   Trades: 234          │
│  30d PnL: $123,456 Volume: $567K        │
├─────────────────────────────────────────┤
│  Connected Wallets (3)                   │
│  🔗 Main: ABC...XYZ (Solana)            │
│  🔗 Trading: 0x123...789 (EVM)          │
│  🔗 Detected: DEF...UVW (Solana)        │
├─────────────────────────────────────────┤
│  Recent Trades                           │
│  [Trade history table]                   │
└─────────────────────────────────────────┘
```

### Key Differences from Anonymous Wallet Pages

**KOL Profiles**:
- Prominent social identity (name, avatar, bio)
- Social metrics (followers, members)
- Multiple connected wallets displayed
- More personal/branded presentation

**Anonymous Wallet Pages**:
- Address-first presentation
- Performance metrics focus
- Minimal identity info
- Technical/analytical presentation

---

## Leaderboard Design

### Default View: KOL Daily Rankings

**Columns**:
1. Rank
2. Avatar + Name + Twitter
3. 24h PnL (color-coded)
4. Win Rate
5. Total Trades
6. Volume
7. Tier Badge

**Filters**:
- Time Period: 1d / 7d / 30d / All-time
- Tier: All / Legendary / Elite / Pro / Standard
- Min Followers: 0 / 1K / 5K / 10K+
- Search: Name or Twitter handle

**Sort Options**:
- PnL (default)
- Win Rate
- Volume
- Followers

---

## MVP Scope

### Must Have
- [x] Collect all data sources
- [ ] Aggregate and deduplicate
- [ ] KOL profiles with social metrics
- [ ] Leaderboard with daily rankings
- [ ] Connected wallet detection (verify/build)

### Nice to Have
- [ ] Historical PnL charts
- [ ] Trade alerts for KOLs
- [ ] Copy trading integration
- [ ] KOL comparison tool

---

## Next Actions

1. **Start mitmproxy collection** for Axiom (highest priority)
2. **Create HAR parser scripts** for each source
3. **Verify connected wallet detection** system exists
4. **Build aggregation pipeline** after data collected
5. **Design KOL profile pages** in UI
6. **Build leaderboard** with filters

---

## File Organization

```
scripts/
├── kol-data/
│   ├── raw/                    # Raw HAR files
│   │   ├── axiom-kols-2026-03-13.har
│   │   ├── pumpfun-kols-2026-03-13.har
│   │   └── ...
│   ├── parsed/                 # Parsed JSON
│   │   ├── axiom-kols-complete.json
│   │   ├── pumpfun-kols-complete.json
│   │   └── ...
│   └── aggregated/             # Final merged data
│       ├── kol-wallets-final.json
│       └── smart-money-final.json
├── parsers/
│   ├── parse-axiom-har.mjs
│   ├── parse-pumpfun-har.mjs
│   └── ...
└── aggregate-all-data.mjs      # Main aggregation script
```

This keeps raw data separate from processed data for easy re-processing if needed.
