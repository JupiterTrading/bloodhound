# Bloodhound Data Sources & Integration Plan

## Current Status
| Source | Status | Data Type |
|--------|--------|-----------|
| Helius DAS | ✅ Integrated | Wallet assets, NFTs, transactions |
| DexScreener | ✅ Integrated | Token pairs, prices, volume |
| GeckoTerminal | ✅ Integrated | Token prices, OHLCV |
| Jupiter | ✅ Integrated | Token prices, metadata |
| Magic Eden | ✅ Integrated | NFT floor/listing prices |
| KOLscan | ✅ Seed script | Top traders leaderboard |
| Supabase | ✅ Integrated | Known wallets DB |
| ClickHouse | ⚠️ Optional | Historical analytics |

---

## Priority 1: Wallet-Twitter Connections

### Helius Identity API (FREE)
```
GET https://api.helius.xyz/v1/wallet/{address}/identity
```
- Returns: Exchange labels, protocol names, domain names (.sol)
- **Does NOT return Twitter handles** - only on-chain identities

### Dune Analytics (FREE with API key)
- Query 4838225: Curated KOL wallet list WITH Twitter handles
- Already in seed script, needs DUNE_API_KEY env var

### Pump.fun Profiles
- URL: `https://pump.fun/profile/{wallet}`
- Scrape: Display name, Twitter handle if linked
- Rate limit: Unknown, be gentle

### FOMO App
- **No public API** - embedded wallet architecture
- Data NOT accessible externally
- Alternative: Monitor their Twitter for wallet mentions

---

## Priority 2: DexScreener Enhanced Token Info

### Check Paid Orders (dex paid status)
```
GET https://api.dexscreener.com/orders/v1/{chainId}/{tokenAddress}
```
Returns:
- `tokenProfile` - Enhanced info purchased ($299)
- `communityTakeover` - CTO purchased
- `status`: processing | approved | cancelled

### Boosted Tokens
```
GET https://api.dexscreener.com/token-boosts/latest/v1
GET https://api.dexscreener.com/token-boosts/top/v1
```
Returns: Recently boosted tokens, boost counts

### Token Profiles (logo, links, socials)
```
GET https://api.dexscreener.com/token-profiles/latest/v1
```

---

## Priority 3: Additional Data Sources

### GMGN.ai
- **Cooperation API** - requires partnership approval
- Trading API only, no wallet intelligence data publicly available
- Contact: Need to apply for API access

### Moonshot
- Token listings on their platform
- No public API documented
- Scrape: `https://moonshot.money/`

### CEX Listings
- CoinGecko API: `GET /coins/{id}/tickers` shows exchanges
- CoinMarketCap API: Similar endpoint (needs API key)

### Birdeye (Paid)
- Full wallet analytics, PnL, top traders
- Requires paid plan for most features

---

## Implementation Priority

### Phase 1 (Immediate)
1. ✅ Add DexScreener paid orders check to token page
2. ✅ Add DexScreener boost info to token page
3. Add Helius identity enrichment to wallet labels

### Phase 2 (This Week)
1. Set up DUNE_API_KEY for Twitter handle enrichment
2. Add Pump.fun profile scraping for wallet-Twitter links
3. Improve new pairs monitor (add Moonshot, Meteora)

### Phase 3 (Next Week)
1. CEX listing detection via CoinGecko
2. Historical boost/dex-paid tracking
3. Launchpad detection system

---

## API Keys Needed
| Service | Status | How to Get |
|---------|--------|------------|
| Helius | ✅ Have | helius.dev |
| DexScreener | ✅ Free | No key needed |
| Dune | ❌ Need | dune.com/settings/api |
| CoinGecko | ❌ Optional | coingecko.com/api |
| GMGN | ❌ Apply | docs.gmgn.ai |
