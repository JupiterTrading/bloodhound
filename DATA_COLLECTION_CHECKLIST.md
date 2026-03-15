# 📋 Bloodhound Data Collection Checklist

## What We Need to Collect

### 🔴 Priority 1: Axiom (CRITICAL - Missing Full Addresses)
**What**: Full wallet addresses for KOLs and top global traders  
**Why**: We only have partial addresses (e.g., "7LMC...P4rK")  
**Target Records**: ~129 KOLs + ~49 global wallets = **~180 wallets**

### 🟠 Priority 2: PumpFun
**What**: KOL leaderboard with creator wallets  
**Why**: No data yet  
**Target Records**: **~100-200 KOLs**

### 🟠 Priority 3: Dex Screener
**What**: Top traders and KOL database  
**Why**: Only have unparsed snapshot  
**Target Records**: **~100-200 traders**

### 🟡 Priority 4: StalkHQ
**What**: KOL tracking data  
**Why**: No data yet  
**Target Records**: **~50-100 KOLs**

### 🟡 Priority 5: GMGN Smart Money
**What**: Fresh smart money section data  
**Why**: Update existing data  
**Target Records**: **~100-200 wallets**

---

## Step-by-Step Collection Process

### Setup (One-Time)

1. **Start mitmproxy**
   ```bash
   # Option 1: Web interface (recommended)
   mitmweb -p 8080
   
   # Option 2: Terminal interface
   mitmproxy -p 8080
   ```

2. **Verify phone/browser proxy settings**
   - Proxy IP: Your PC's local IP
   - Proxy Port: 8080
   - SSL Certificate: Already installed ✅

---

## 🔴 STEP 1: Collect Axiom Data

### 1A. Axiom Vision > KOLs Leaderboard

**URL**: `https://axiom.xyz/vision/kols` (or similar)

**Actions**:
1. ✅ Start mitmproxy: `mitmweb -p 8080`
2. ✅ Open Axiom Vision > KOLs section on phone/browser
3. ✅ Scroll through entire leaderboard (load all pages)
4. ✅ Click on **at least 20-30 individual KOL profiles** to get detailed data
5. ✅ Watch mitmproxy web interface - look for API calls containing:
   - `/kol` or `/kols`
   - `/leaderboard`
   - `/profile`
6. ✅ Export HAR file:
   - In mitmweb: File > Save > Export as HAR
   - Save as: `scripts/kol-data/raw/axiom-kols-[date].har`

**Expected Data**:
- Full wallet addresses (not partials!)
- Name, Twitter handle
- PnL (24h, 7d, 30d)
- Win rate, total trades
- Volume metrics

**Parse Command**:
```bash
node scripts/parsers/parse-axiom-har.mjs scripts/kol-data/raw/axiom-kols-2026-03-13.har scripts/kol-data/parsed/axiom-kols-complete.json
```

---

### 1B. Axiom Global Wallets

**URL**: `https://axiom.xyz/global` (or similar)

**Actions**:
1. ✅ Navigate to Axiom Global Wallets leaderboard
2. ✅ Scroll through top 100 wallets
3. ✅ Click on **at least 10-20 wallet profiles** to get full addresses
4. ✅ Export HAR: `scripts/kol-data/raw/axiom-global-[date].har`

**Expected Data**:
- Full wallet addresses
- PnL, win rate, trades
- Any available identity info

**Parse Command**:
```bash
node scripts/parsers/parse-axiom-har.mjs scripts/kol-data/raw/axiom-global-2026-03-13.har scripts/kol-data/parsed/axiom-global-complete.json
```

---

## 🟠 STEP 2: Collect PumpFun Data

### PumpFun KOL Leaderboard

**URL**: `https://pump.fun` (find KOL/creator section)

**Actions**:
1. ✅ Keep mitmproxy running
2. ✅ Navigate to PumpFun KOL or creator leaderboard
3. ✅ Scroll through leaderboard
4. ✅ Click on creator profiles
5. ✅ Look for API calls containing:
   - `/kol`
   - `/creator`
   - `/leaderboard`
6. ✅ Export HAR: `scripts/kol-data/raw/pumpfun-kols-[date].har`

**Expected Data**:
- Creator wallet addresses
- Name, Twitter handle
- Tokens created
- Total volume, success rate

**Parse Command**:
```bash
# Parser needs to be created first
node scripts/parsers/parse-pumpfun-har.mjs scripts/kol-data/raw/pumpfun-kols-2026-03-13.har scripts/kol-data/parsed/pumpfun-kols-complete.json
```

---

## 🟠 STEP 3: Collect Dex Screener Data

### Dex Screener Top Traders

**URL**: `https://dexscreener.com` (find traders/KOL section)

**Actions**:
1. ✅ Keep mitmproxy running
2. ✅ Navigate to top traders or KOL section
3. ✅ Scroll through leaderboard
4. ✅ Click on trader profiles
5. ✅ Look for API calls containing:
   - `/trader`
   - `/kol`
   - `/top`
6. ✅ Export HAR: `scripts/kol-data/raw/dexscreener-kols-[date].har`

**Expected Data**:
- Wallet addresses
- Name, Twitter handle
- PnL, trades, volume

**Parse Command**:
```bash
# Parser needs to be created first
node scripts/parsers/parse-dexscreener-har.mjs scripts/kol-data/raw/dexscreener-kols-2026-03-13.har scripts/kol-data/parsed/dexscreener-kols-complete.json
```

---

## 🟡 STEP 4: Collect StalkHQ Data

### StalkHQ KOL Tracking

**URL**: `https://stalkhq.com` (or similar)

**Actions**:
1. ✅ Keep mitmproxy running
2. ✅ Navigate to KOL tracking section
3. ✅ Browse tracked KOLs
4. ✅ Look for API calls
5. ✅ Export HAR: `scripts/kol-data/raw/stalkhq-kols-[date].har`

**Expected Data**:
- Wallet addresses
- Identity info
- Tracking metrics

**Parse Command**:
```bash
# Parser needs to be created first
node scripts/parsers/parse-stalkhq-har.mjs scripts/kol-data/raw/stalkhq-kols-2026-03-13.har scripts/kol-data/parsed/stalkhq-kols-complete.json
```

---

## 🟡 STEP 5: Collect GMGN Smart Money

### GMGN Smart Money Section

**URL**: `https://gmgn.ai` (find smart money section)

**Actions**:
1. ✅ Keep mitmproxy running
2. ✅ Navigate to GMGN Smart Money section
3. ✅ Scroll through leaderboard
4. ✅ Look for API calls
5. ✅ Export HAR: `scripts/kol-data/raw/gmgn-smart-money-[date].har`

**Expected Data**:
- Wallet addresses
- Win rate, PnL
- Trade metrics

**Parse Command**:
```bash
# Parser needs to be created first
node scripts/parsers/parse-gmgn-har.mjs scripts/kol-data/raw/gmgn-smart-money-2026-03-13.har scripts/kol-data/parsed/gmgn-smart-money-complete.json
```

---

## After Collection: Parsing & Aggregation

### 1. Parse All HAR Files
Run each parser command listed above to convert HAR files to standardized JSON.

### 2. Aggregate All Data
```bash
node scripts/aggregate-all-data.mjs
```
This will:
- Merge all parsed JSON files
- Deduplicate by wallet address
- Match identities across sources
- Output final datasets

### 3. Seed Databases
```bash
node scripts/seed-kol-wallets.mjs
node scripts/seed-smart-money.mjs
```

---

## Quick Reference: File Locations

```
scripts/kol-data/
├── raw/                              # HAR files from mitmproxy
│   ├── axiom-kols-2026-03-13.har
│   ├── axiom-global-2026-03-13.har
│   ├── pumpfun-kols-2026-03-13.har
│   ├── dexscreener-kols-2026-03-13.har
│   ├── stalkhq-kols-2026-03-13.har
│   └── gmgn-smart-money-2026-03-13.har
│
├── parsed/                           # Standardized JSON
│   ├── axiom-kols-complete.json
│   ├── axiom-global-complete.json
│   ├── pumpfun-kols-complete.json
│   ├── dexscreener-kols-complete.json
│   ├── stalkhq-kols-complete.json
│   └── gmgn-smart-money-complete.json
│
└── aggregated/                       # Final merged data
    ├── kol-wallets-final.json
    └── smart-money-final.json
```

---

## Troubleshooting

### Can't see API calls in mitmproxy?
- Check proxy settings on phone/browser
- Verify SSL certificate is installed
- Try refreshing the page
- Look for XHR/Fetch requests in browser DevTools first

### HAR file is huge?
- That's normal! It captures everything
- Parser will filter for relevant API calls only

### API responses are encrypted/binary?
- Check if response is gzipped
- mitmproxy should auto-decompress
- If not, look for `Content-Encoding: gzip` header

### Don't know which API endpoint to look for?
- Open browser DevTools (F12)
- Go to Network tab
- Filter by XHR/Fetch
- Look for JSON responses with wallet data
- Note the URL pattern

---

## Estimated Time

- **Axiom**: 20-30 minutes (most important)
- **PumpFun**: 15-20 minutes
- **Dex Screener**: 15-20 minutes
- **StalkHQ**: 10-15 minutes
- **GMGN**: 10-15 minutes

**Total collection time**: ~1.5-2 hours

**Parsing time**: ~10 minutes (automated)

**Aggregation time**: ~5 minutes (automated)

---

## Success Criteria

- [ ] Axiom: ≥100 KOL wallets with full addresses
- [ ] Axiom: ≥30 global wallets with full addresses
- [ ] PumpFun: ≥50 creator wallets
- [ ] Dex Screener: ≥50 trader wallets
- [ ] StalkHQ: ≥30 KOL wallets
- [ ] GMGN: ≥50 smart money wallets
- [ ] All HAR files successfully parsed
- [ ] Final aggregated datasets created
- [ ] No duplicate wallet addresses in final data

---

## Ready to Start?

**Start with Axiom** - it's the most critical gap in your data.

1. Run: `mitmweb -p 8080`
2. Open Axiom on your phone/browser
3. Browse KOL leaderboard and profiles
4. Export HAR when done
5. Parse with: `node scripts/parsers/parse-axiom-har.mjs [har-file] [output-file]`

Then move on to the other sources in priority order!
