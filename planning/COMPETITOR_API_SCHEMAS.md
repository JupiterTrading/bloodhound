# Competitor API Schemas & Data Sources
**Reference for integrating external data feeds**

---

## 1. Pump.fun Data (via Bitquery)

### New Token Creation
```graphql
subscription {
  Solana {
    Instructions(
      where: {
        Instruction: {
          Program: {
            Address: { is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" }
            Method: { is: "create" }
          }
        }
      }
    ) {
      Transaction { Signature }
      Instruction {
        Accounts { Address IsWritable Token { Mint Owner } }
        Program { Method }
      }
      Block { Time }
    }
  }
}
```

### Token Price & Market Data
```graphql
query GetPumpFunTokenPrice($mint: String!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: { MintAddress: { is: $mint } }
          Dex: { ProgramAddress: { is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" } }
        }
      }
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Trade {
        Price
        PriceInUSD
      }
    }
  }
}
```

### Bonding Curve Progress
```graphql
query GetBondingCurveProgress($mint: String!) {
  Solana {
    TokenSupplyUpdates(
      where: { Currency: { MintAddress: { is: $mint } } }
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Currency { MintAddress Symbol Name }
      PostBalance   # Current supply
      PreBalance
    }
  }
}
```

### First 100 Buyers
```graphql
query GetFirst100Buyers($mint: String!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: { MintAddress: { is: $mint } }
          Side: { Type: { is: buy } }
        }
      }
      limit: { count: 100 }
      orderBy: { ascending: Block_Time }
    ) {
      Trade {
        Account { Address }
        Amount
        AmountInUSD
        Price
      }
      Block { Time }
      Transaction { Signature }
    }
  }
}
```

### Real-Time Trades Stream
```graphql
subscription {
  Solana {
    DEXTrades(
      where: {
        Trade: {
          Dex: { ProgramAddress: { is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" } }
        }
      }
    ) {
      Trade {
        Buy { Account { Address } Amount Currency { Symbol MintAddress } }
        Sell { Account { Address } Amount Currency { Symbol MintAddress } }
        Dex { ProtocolName }
        Price
        PriceInUSD
      }
      Block { Time }
      Transaction { Signature }
    }
  }
}
```

---

## 2. DexScreener API

### Base URL
```
https://api.dexscreener.com
```

### Get Token Profiles (60 req/min)
```
GET /token-profiles/latest/v1
```
Response:
```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "chainId": "solana",
      "tokenAddress": "...",
      "icon": "https://...",
      "header": "https://...",
      "description": "...",
      "links": [
        { "type": "website", "label": "Website", "url": "..." }
      ]
    }
  ]
}
```

### Get Boosted Tokens (60 req/min)
```
GET /token-boosts/latest/v1
```
Response:
```json
{
  "schemaVersion": "1.0.0",
  "tokens": [
    {
      "chainId": "solana",
      "tokenAddress": "...",
      "amount": 500,
      "totalAmount": 2500,
      "icon": "...",
      "description": "...",
      "links": []
    }
  ]
}
```

### Get Pair by Address (300 req/min)
```
GET /latest/dex/pairs/{chainId}/{pairAddress}
```
Response:
```json
{
  "schemaVersion": "1.0.0",
  "pair": {
    "chainId": "solana",
    "dexId": "raydium",
    "url": "https://dexscreener.com/...",
    "pairAddress": "...",
    "baseToken": {
      "address": "...",
      "name": "Token Name",
      "symbol": "TKN"
    },
    "quoteToken": {
      "address": "So11111111111111111111111111111111111111112",
      "name": "Wrapped SOL",
      "symbol": "SOL"
    },
    "priceNative": "0.00001234",
    "priceUsd": "0.00234",
    "txns": {
      "m5": { "buys": 12, "sells": 8 },
      "h1": { "buys": 145, "sells": 120 },
      "h6": { "buys": 890, "sells": 750 },
      "h24": { "buys": 2340, "sells": 2100 }
    },
    "volume": {
      "m5": 1234.56,
      "h1": 45678.90,
      "h6": 234567.89,
      "h24": 1234567.89
    },
    "priceChange": {
      "m5": 2.34,
      "h1": -5.67,
      "h6": 12.34,
      "h24": -23.45
    },
    "liquidity": {
      "usd": 123456.78,
      "base": 1234567890,
      "quote": 12345.67
    },
    "fdv": 12345678,
    "pairCreatedAt": 1699999999999
  }
}
```

### Search Pairs (300 req/min)
```
GET /latest/dex/search?q={query}
```

### Get Token Pairs (300 req/min)
```
GET /latest/dex/tokens/{tokenAddresses}
```
- Up to 30 comma-separated addresses

---

## 3. Birdeye API

### Base URL
```
https://public-api.birdeye.so
```

### Headers Required
```
X-API-KEY: your_api_key
```

### Token Overview
```
GET /defi/token_overview?address={mint}
```
Response:
```json
{
  "data": {
    "address": "...",
    "decimals": 9,
    "symbol": "TKN",
    "name": "Token Name",
    "extensions": {
      "coingeckoId": "...",
      "website": "...",
      "twitter": "..."
    },
    "logoURI": "...",
    "liquidity": 123456.78,
    "price": 0.00234,
    "priceChange24hPercent": -5.67,
    "mc": 12345678,
    "supply": 1000000000,
    "holder": 12345,
    "v24hUSD": 1234567.89,
    "v24hChangePercent": 23.45
  }
}
```

### Token Security
```
GET /defi/token_security?address={mint}
```
Response:
```json
{
  "data": {
    "creatorAddress": "...",
    "creationTx": "...",
    "creationTime": 1699999999,
    "mintAuthority": null,
    "freezeAuthority": null,
    "isToken2022": false,
    "top10HolderBalance": 45.67,
    "top10HolderPercent": 45.67,
    "totalSupply": 1000000000,
    "metaplexUpdateAuthority": "...",
    "isMutable": false,
    "isTradeAble": true,
    "preMarketHolder": []
  }
}
```

### OHLCV Data
```
GET /defi/ohlcv?address={mint}&type={timeframe}
```
Timeframes: `1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `2H`, `4H`, `6H`, `8H`, `12H`, `1D`, `3D`, `1W`, `1M`

Response:
```json
{
  "data": {
    "items": [
      {
        "unixTime": 1699999999,
        "o": 0.00234,
        "h": 0.00245,
        "l": 0.00223,
        "c": 0.00238,
        "v": 123456.78
      }
    ]
  }
}
```

### Wallet Portfolio
```
GET /v1/wallet/token_list?wallet={address}
```

### Wallet PnL
```
GET /v1/wallet/pnl?wallet={address}
```

---

## 4. Jupiter API

### Base URL
```
https://api.jup.ag
```

### Token List
```
GET /tokens/v1
```

### Price API
```
GET /price/v2?ids={mint1,mint2,...}
```
Response:
```json
{
  "data": {
    "mint_address": {
      "id": "...",
      "type": "token",
      "price": "0.00234"
    }
  }
}
```

### Quote (for swap routing)
```
GET /quote?inputMint={}&outputMint={}&amount={}&slippageBps={}
```

---

## 5. Helius API (Already Integrated)

### Enhanced Transactions
```
POST https://api.helius.xyz/v0/transactions
```

### DAS (Digital Asset Standard)
```
POST https://api.helius.xyz/v0/token-metadata
```

### Webhooks for Real-time
- Transaction webhooks
- Account change webhooks
- NFT events

---

## 6. Trending Token Logic

### Pump.fun "King of the Hill"
Tokens between $30K-$35K market cap competing for visibility.

### DexScreener Trending
Based on:
- Volume velocity (rate of increase)
- Transaction count
- Unique wallets trading
- Price momentum
- Boost purchases

### Birdeye Trending
Based on:
- 24h volume
- Price change percentage
- Holder count change
- Social mentions

### Recommended Bloodhound Trending Algorithm
```typescript
interface TrendingScore {
  volumeScore: number;      // 0-100, weighted by recency
  momentumScore: number;    // Price change velocity
  activityScore: number;    // Unique wallets * tx count
  kolScore: number;         // KOL wallet involvement
  signalScore: number;      // Bloodhound signal detections
}

function calculateTrendingScore(token: Token): number {
  const weights = {
    volume: 0.25,
    momentum: 0.20,
    activity: 0.20,
    kol: 0.25,
    signal: 0.10
  };
  
  return (
    token.volumeScore * weights.volume +
    token.momentumScore * weights.momentum +
    token.activityScore * weights.activity +
    token.kolScore * weights.kol +
    token.signalScore * weights.signal
  );
}
```

---

## 7. New Pair Detection Schema

### Pump.fun New Token Event
```typescript
interface PumpFunNewToken {
  mint: string;
  symbol: string;
  name: string;
  uri: string;              // Metadata URI
  creator: string;          // Dev wallet
  bondingCurve: string;     // Bonding curve account
  associatedBondingCurve: string;
  createdAt: number;        // Unix timestamp
  initialBuyAmount?: number;
  signature: string;        // Creation tx
}
```

### Raydium New Pool Event
```typescript
interface RaydiumNewPool {
  poolId: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseVault: string;
  quoteVault: string;
  openTime: number;
  creator: string;
  initialBaseLiquidity: number;
  initialQuoteLiquidity: number;
  signature: string;
}
```

### Unified New Pair Schema
```typescript
interface NewPair {
  // Identity
  id: string;               // Unique ID
  mint: string;             // Token mint address
  pairAddress?: string;     // LP/pool address if applicable
  
  // Token Info
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  
  // Source
  source: 'pump_fun' | 'raydium' | 'orca' | 'meteora' | 'jupiter';
  sourceUrl?: string;       // Link to source platform
  
  // Creator/Dev
  creator: string;
  creatorLabel?: string;    // If known wallet
  creatorHistory?: {
    tokensCreated: number;
    rugCount: number;
    successRate: number;
  };
  
  // Market Data
  initialPrice?: number;
  currentPrice?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  marketCap?: number;
  liquidity?: number;
  volume5m?: number;
  volume1h?: number;
  
  // Activity
  txCount5m?: number;
  txCount1h?: number;
  buyCount?: number;
  sellCount?: number;
  uniqueWallets?: number;
  
  // Pump.fun Specific
  bondingCurveProgress?: number;  // 0-100%
  isGraduated?: boolean;
  graduationTime?: number;
  
  // Analysis
  bundleDetected?: boolean;
  insiderBuyers?: string[];
  kolBuyers?: string[];
  riskScore?: number;       // 0-100
  
  // Timestamps
  createdAt: number;
  detectedAt: number;
  lastUpdated: number;
}
```

---

## 8. Live Feed WebSocket Schema

### Feed Event Types
```typescript
type FeedEventType = 
  | 'kol_trade'
  | 'whale_trade'
  | 'new_pair'
  | 'signal'
  | 'price_alert'
  | 'tracked_wallet';

interface FeedEvent {
  type: FeedEventType;
  timestamp: number;
  data: KolTradeEvent | WhaleTradeEvent | NewPairEvent | SignalEvent;
}

interface KolTradeEvent {
  trader: string;
  traderLabel?: string;
  traderTwitter?: string;
  direction: 'buy' | 'sell';
  tokenMint: string;
  tokenSymbol: string;
  amountUsd: number;
  price: number;
  dex: string;
  signature: string;
}

interface WhaleTradeEvent {
  wallet: string;
  walletLabel?: string;
  classification: string[];
  direction: 'buy' | 'sell';
  tokenMint: string;
  tokenSymbol: string;
  amountUsd: number;
  portfolioImpact?: number;  // % of portfolio
  signature: string;
}

interface NewPairEvent {
  mint: string;
  symbol: string;
  name: string;
  source: string;
  creator: string;
  initialLiquidity?: number;
  riskFlags?: string[];
}

interface SignalEvent {
  signalType: string;
  confidence: 'CONFIRMED' | 'PROBABLE' | 'SUSPECTED';
  wallet: string;
  walletLabel?: string;
  description: string;
  metadata: Record<string, unknown>;
}
```

---

## 9. Logo/Asset URLs

### DEX Logos
| Platform | Logo URL |
|----------|----------|
| Jupiter | `https://jup.ag/favicon.ico` |
| Raydium | `https://raydium.io/logo/logo-only-icon.svg` |
| Orca | `https://www.orca.so/favicon.ico` |
| Pump.fun | `https://pump.fun/icon.png` |
| Meteora | `https://meteora.ag/favicon.ico` |

### Chain/Token Logos
| Asset | Logo URL |
|-------|----------|
| Solana | `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png` |
| USDC | `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png` |

### Token Logo Resolution
1. Check Jupiter token list
2. Check Birdeye metadata
3. Check DexScreener profile
4. Fallback to generated avatar

---

*This document serves as a reference for API integration. Update as APIs change.*
