# 🐕 BLOODHOUND — Complete Data Import Instructions

## ✅ What's Already Done

### UI Updates (Completed)
- ✅ Category tabs: KOL | Smart Money | Global | Tracked
- ✅ Period filters: 1D | 3D | 7D | 30D | All Time
- ✅ Sort options: PnL | ROI % | Win Rate | Volume | Hold Time
- ✅ Dynamic table headers based on sort selection
- ✅ Backend API supports all new parameters
- ✅ Frontend integrated with new filters

### Data Imported
- ✅ 159 GMGN KOL profiles (already imported)

---

## 📋 What You Need to Do

### 1. Import Additional Data Sources

Run this command to import Smart Money + additional KOL data:

```powershell
cd C:\Users\guestarino\CascadeProjects\bloodhound

# Set environment variables (if not already set)
$env:SUPABASE_URL="https://ndstmcyrgljnyqxbwgct.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"

# Import all data sources
node scripts/import-all-kol-data.mjs
```

This will import:
- **~6,800 Smart Money wallets** from GMGN
- **~4,800 KOL wallets** from KolScan  
- **~2,000 KOL wallets** from Axiom

**Total: ~13,600+ new wallets**

---

## 📊 Available Data Files

### Already Imported ✅
- `gmgn-kols-complete.json` - 159 KOLs with Twitter handles

### Ready to Import 🔄
- `gmgn-smart-money-2026-03-14.json` - 6,828 smart money wallets
- `kolscan-kols-2026-03-14.json` - 4,802 KOL wallets
- `axiom-vision-kols-2026-03-13.json` - ~2,000 KOL wallets

### Available for Future Import 📦
- `aggregated-kols.json` - 32MB (massive aggregated dataset)
- `aggregated-smart-money.json` - 1.4MB
- `aggregated-all-wallets.json` - 33MB (global wallet rankings)
- `dexscreener-wallets-2026-03-14.json` - 364KB
- `stalkchain-wallets-2026-03-14.json` - 10MB

---

## 🎯 Current Leaderboard Features

### Category Tabs
- **KOL** 👑 - Verified influencers with Twitter handles
- **Smart Money** 🧠 - High-performing traders (coming after import)
- **Global** 🌍 - All wallets ranked (requires wallet_rankings table)
- **Tracked** ⭐ - User's tracked wallets (requires user tracking feature)

### Period Filters
- **1D** - Last 24 hours
- **3D** - Last 3 days  
- **7D** - Last 7 days
- **30D** - Last 30 days
- **All** - All time

### Sort Options
- **PnL** - Total profit/loss in USD
- **ROI %** - Return on investment percentage (PnL / Volume * 100)
- **Win Rate** - Percentage of winning trades
- **Volume** - Total trading volume
- **Hold Time** - Average hold time (requires additional tracking)

---

## 🚀 Next Steps After Import

### 1. Test the Leaderboard
Navigate to http://localhost:3001/rankings and verify:
- KOL tab shows all imported profiles
- Smart Money tab shows smart money wallets (after import)
- Sort options work correctly
- Period filters update rankings

### 2. Add Global Wallet Rankings (Optional)
To enable the Global tab, you need to:
1. Apply the `012_wallet_rankings.sql` schema
2. Create an import script for the aggregated wallet data
3. Update the rankings API to query `wallet_rankings` table for Global category

### 3. Add Tracked Wallets (Optional)
To enable the Tracked tab:
1. Create a `user_tracked_wallets` table
2. Add UI for users to track wallets
3. Update rankings API to filter by user's tracked wallets

---

## 📝 Import Script Details

The `import-all-kol-data.mjs` script:
- Handles both KOL and Smart Money data formats
- Avoids duplicates by checking existing wallets
- Creates profiles with PnL, win rate, and trade count
- Links wallets to profiles
- Shows progress every 50 entries
- Reports import statistics

---

## ⚠️ Important Notes

1. **Environment Variables**: Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. **Import Time**: Importing 13,000+ wallets may take 10-20 minutes
3. **Rate Limits**: The script processes sequentially to avoid rate limits
4. **Duplicates**: Existing wallets are skipped automatically
5. **Twitter API**: Optional - only needed for follower counts on KOL profiles

---

## 🐦 Twitter Integration (Optional)

To show real follower counts and tweets on KOL profiles:

1. Get a Twitter Bearer Token from https://developer.twitter.com/en/portal/dashboard
2. Add to `.env.local`:
   ```
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   ```
3. Restart dev server

Without this, KOL profiles still work but show "—" for followers.

---

## 📊 Expected Results After Import

### KOL Tab
- ~7,000 KOL profiles (159 GMGN + 4,802 KolScan + 2,000 Axiom)
- Sorted by PnL, ROI, Win Rate, Volume, or Hold Time
- Filterable by 1D, 3D, 7D, 30D, All Time

### Smart Money Tab  
- ~6,800 smart money wallets
- Detailed PnL stats (1D, 7D, 30D)
- Win rates and trade counts
- Same sort and filter options

### Global Tab (Future)
- All wallets from aggregated dataset
- Requires wallet_rankings table implementation

### Tracked Tab (Future)
- User's personally tracked wallets
- Requires user tracking feature

---

## 🔧 Troubleshooting

**"Missing SUPABASE_URL"**
- Set environment variables in PowerShell before running

**"Error creating profile: duplicate key"**
- Normal - means profile already exists, will skip

**Import is slow**
- Expected - processing 13,000+ wallets takes time
- Check progress messages every 50 entries

**No data showing in UI**
- Make sure dev server is running: `cd apps/web && pnpm dev`
- Check browser console for API errors
- Verify data was imported in Supabase dashboard

---

## 📞 Support

If you encounter issues:
1. Check the console output for specific error messages
2. Verify database schema is applied (003_kol_profiles.sql)
3. Confirm environment variables are set correctly
4. Check Supabase dashboard for imported data
