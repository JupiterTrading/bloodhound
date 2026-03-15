# HAR Collection Guide for Remaining Sources

## 🎯 Collection Order & URLs

### 1. **GMGN** (Smart Money + KOLs)
- **URL**: https://gmgn.ai/
- **Navigate to**: 
  - Smart Money: https://gmgn.ai/smartmoney/sol
  - KOL Copy Trading: https://gmgn.ai/kol/sol
- **What to look for**: Wallet addresses, PnL, win rates, Twitter handles
- **Export as**: `gmgn.ai.har`

### 2. **KOLscan**
- **URL**: https://kolscan.io/
- **Navigate to**: Browse KOL profiles, leaderboard
- **What to look for**: Wallet addresses, Twitter/Telegram handles, follower counts
- **Export as**: `kolscan.io.har`

### 3. **Dex Screener**
- **URL**: https://dexscreener.com/
- **Navigate to**: 
  - Solana pairs: https://dexscreener.com/solana
  - Top traders section (if available)
- **What to look for**: Trader wallets, volume, PnL
- **Export as**: `dexscreener.com.har`

### 4. **PumpFun**
- **URL**: https://pump.fun/
- **Navigate to**: 
  - KOL leaderboard (if exists)
  - Top creators/traders
- **What to look for**: Creator wallets, token launches, performance
- **Export as**: `pump.fun.har`

### 5. **StalkHQ**
- **URL**: https://stalk.hq/ or similar
- **Navigate to**: KOL tracking, wallet monitoring
- **What to look for**: Tracked wallets, KOL profiles, social handles
- **Export as**: `stalkhq.har`

---

## 📋 Step-by-Step Process (For Each Source)

### Before You Start
1. Open Edge/Chrome browser
2. Press **F12** to open DevTools
3. Go to **Network** tab
4. Check **Preserve log** (important!)

### Data Collection Steps

1. **Clear Network Log**
   - Click the 🚫 (clear) icon in Network tab

2. **Navigate to the Site**
   - Go to the URL listed above
   - Wait for page to fully load

3. **Interact with the Page**
   - Scroll through leaderboards
   - Click on different tabs (KOLs, Smart Money, etc.)
   - Open individual profiles
   - Load more data if pagination exists
   - **Goal**: Trigger as many API calls as possible

4. **Filter for API Calls**
   - In the Network filter box, type: `api` or `fetch`
   - Look for URLs containing:
     - `/kol`, `/trader`, `/wallet`, `/leaderboard`
     - `/user`, `/profile`, `/stats`
     - JSON responses

5. **Verify Data**
   - Click on an API request
   - Check the **Response** tab
   - Confirm it contains wallet addresses and stats
   - If yes, you found the right endpoint! ✅

6. **Export HAR**
   - Right-click anywhere in Network tab
   - Select **"Save all as HAR with content"**
   - Save to: `C:\Users\guestarino\Downloads\[sitename].har`

---

## 🔍 What to Look For in Network Tab

### Good API Endpoints (Examples)
```
✅ https://api.gmgn.ai/v1/smartmoney/wallets
✅ https://kolscan.io/api/kols
✅ https://api.dexscreener.com/traders
✅ https://pump.fun/api/creators
✅ https://backend.stalkhq.com/wallets
```

### Skip These (Not Useful)
```
❌ /health, /ping, /analytics
❌ Image/font/CSS files
❌ Translation endpoints
❌ Authentication tokens (unless needed)
```

---

## 🎯 Quick Checklist Per Source

Before exporting HAR, verify you have:
- [ ] Navigated to main leaderboard/KOL page
- [ ] Scrolled through the list
- [ ] Clicked on at least 2-3 profiles
- [ ] Loaded any "Load More" or pagination
- [ ] Filtered Network tab to show only API calls
- [ ] Confirmed at least 1 API response contains wallet data
- [ ] Exported HAR with the correct filename

---

## 💾 File Naming Convention

Save HAR files as:
- `gmgn.ai.har`
- `kolscan.io.har`
- `dexscreener.com.har`
- `pump.fun.har`
- `stalkhq.har`

All files should be saved to: `C:\Users\guestarino\Downloads\`

---

## 🚨 Troubleshooting

**Problem**: No API calls showing up
- **Solution**: Make sure you're on the right page (leaderboard, not homepage)
- Try clicking different tabs/sections
- Refresh the page with DevTools open

**Problem**: HAR file is too large (>50MB)
- **Solution**: That's okay! We'll parse it to extract only what we need

**Problem**: Can't find wallet addresses in responses
- **Solution**: Try different pages/sections on the site
- Look for "traders", "wallets", "users" endpoints
- Check individual profile pages

---

## ✅ After Collection

Once you have all 5 HAR files, I'll create parsers to extract:
- Wallet addresses (full, not truncated)
- Names/labels
- Twitter/Telegram handles
- PnL and performance metrics
- Win rates
- Volume data
- Any other relevant stats

Let me know when you're ready to start, and I'll guide you through each source one by one!
