import Link from "next/link";

export const metadata = {
  title: "API — BLOODHOUND",
  description: "BLOODHOUND public API reference for wallet intelligence, signals, and on-chain data.",
};

const BASE_URL = "https://api.bloodhound.xyz/v1";

const ENDPOINTS = [
  {
    section: "Search",
    items: [
      {
        method: "GET",
        path: "/search/autocomplete",
        params: "q: string",
        description: "Autocomplete suggestions for wallets, tokens, transactions, and programs.",
        example: `?q=binance`,
        response: `{ "suggestions": [{ "type": "wallet", "id": "...", "label": "Binance Hot", "sublabel": "exchange" }] }`,
      },
      {
        method: "GET",
        path: "/search",
        params: "q: string, limit?: number",
        description: "Full search results across all entity types.",
        example: `?q=5tzF...&limit=10`,
        response: `{ "results": [{ "type": "wallet", "id": "...", "label": "..." }] }`,
      },
    ],
  },
  {
    section: "Wallets",
    items: [
      {
        method: "GET",
        path: "/wallet/{address}/summary",
        params: "address: base58",
        description: "Core wallet stats, SOL balance, portfolio USD, classification labels, and known wallet identity.",
        response: `{ "address": "...", "sol_balance": 12.4, "portfolio_usd": 48200, "classification": ["whale_wallet", "smart_money"], "known_wallet": null }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/transfers",
        params: "page, limit, token, direction (in|out|both), date_from, date_to, tx_type",
        description: "Paginated transfer history with known-wallet enrichment.",
        response: `{ "transfers": [...], "page": 1, "limit": 50 }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/holdings",
        params: "address: base58",
        description: "Token holdings with live USD values from Birdeye.",
        response: `{ "total_usd": 48200, "holdings": [{ "mint": "...", "symbol": "SOL", "amount": 12.4, "usd_value": 1860 }] }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/nft-holdings",
        params: "address: base58",
        description: "NFT holdings with image URI, collection address, and trait attributes.",
        response: `{ "count": 3, "nfts": [{ "mint": "...", "name": "Okay Bear #1234", "image": "https://...", "collection_address": "..." }] }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/intelligence",
        params: "address: base58",
        description: "AI-generated narrative summary of wallet behavior. Confidence: CONFIRMED | PROBABLE | SUSPECTED | UNKNOWN.",
        response: `{ "summary": "This wallet exhibits smart money behavior...", "confidence": "PROBABLE" }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/relationships",
        params: "limit?: number (max 50)",
        description: "Top counterparties by interaction count and volume.",
        response: `{ "counterparties": [{ "counterparty": "...", "interaction_count": 42, "total_volume_usd": 95000 }] }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/side-wallets",
        params: "address: base58",
        description: "Suspected side wallets detected by behavioral fingerprinting. confidence ∈ [0,1].",
        response: `{ "candidates": [{ "address": "...", "confidence": 0.82, "signals": ["common_funder", "token_overlap"] }] }`,
      },
      {
        method: "GET",
        path: "/wallet/{address}/events",
        params: "address: base58",
        description: "Known historical events this wallet participated in (e.g. $TRUMP launch, FTX collapse).",
        response: `{ "events": [{ "slug": "trump-launch", "title": "$TRUMP Launch", "role": "early_buyer" }] }`,
      },
    ],
  },
  {
    section: "Tokens",
    items: [
      {
        method: "GET",
        path: "/token/{mint}/summary",
        params: "mint: base58",
        description: "Token metadata, price, market cap, 24h volume, holder count, and Birdeye security score.",
        response: `{ "mint": "...", "symbol": "BONK", "price_usd": 0.00002, "market_cap_usd": 1400000000 }`,
      },
      {
        method: "GET",
        path: "/token/{mint}/holders",
        params: "limit?: number (max 100)",
        description: "Top token holders ranked by balance.",
        response: `{ "holders": [{ "address": "...", "amount": 1e12, "pct_supply": 4.2 }] }`,
      },
      {
        method: "GET",
        path: "/token/{mint}/twitter",
        params: "mint: base58",
        description: "Tweet volume and sample tweets for a token symbol. Requires Elevated Twitter API access.",
        response: `{ "tweet_count_24h": 842, "sample_tweets": [...] }`,
      },
    ],
  },
  {
    section: "Signals",
    items: [
      {
        method: "GET",
        path: "/signals",
        params: "signal_type?, confidence?, wallet_address?, limit?, page?",
        description: "On-chain intelligence signals: kol_pre_buy, abnormal_inflow, new_token_deploy, wash_trader, sniper, and more.",
        response: `{ "signals": [{ "signal_type": "kol_pre_buy", "confidence": "CONFIRMED", "wallet_address": "...", "metadata": {...} }] }`,
      },
    ],
  },
  {
    section: "Intelligence",
    items: [
      {
        method: "GET",
        path: "/leaderboard",
        params: "timeframe: 1d|7d|30d, category: kol|trader, limit?: number",
        description: "KOL and trader leaderboard ranked by PnL (Birdeye data).",
        response: `{ "leaderboard": [{ "address": "...", "label": "Ansem", "pnl_usd": 240000 }] }`,
      },
      {
        method: "GET",
        path: "/leaderboard/trending",
        params: "limit?: number",
        description: "Trending tokens by trade count in the last 24h.",
        response: `{ "tokens": [{ "mint": "...", "symbol": "WIF", "trade_count_24h": 18200 }] }`,
      },
      {
        method: "GET",
        path: "/entity/{address}",
        params: "address: base58",
        description: "Identity cluster for a wallet — all suspected side wallets, combined holdings, combined events.",
        response: `{ "cluster": { "members": [...] }, "combined_holdings": [...], "total_usd": 82000 }`,
      },
    ],
  },
  {
    section: "Events",
    items: [
      {
        method: "GET",
        path: "/events",
        params: "category?, limit?",
        description: "Catalog of known historical on-chain events (launches, hacks, airdrops).",
        response: `{ "events": [{ "slug": "trump-launch", "title": "$TRUMP Launch", "category": "token_launch" }] }`,
      },
      {
        method: "GET",
        path: "/events/{slug}",
        params: "slug: string",
        description: "Full event detail with wallet participants, significance score, and timeline.",
        response: `{ "slug": "trump-launch", "title": "...", "wallets": [{ "address": "...", "role": "early_buyer" }] }`,
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "#22c55e",
  POST: "var(--accent)",
  DELETE: "#ef4444",
};

export default function ApiDocsPage() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "12px",
          }}
        >
          Public API Reference
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "560px" }}>
          The BLOODHOUND API provides programmatic access to wallet intelligence, signals, token data,
          and on-chain relationship graphs. Pro subscribers receive an API key with 10,000 requests/day.
        </p>

        {/* Base URL + Auth */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px 20px",
            marginTop: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              Base URL
            </span>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "13px", color: "var(--text-primary)", marginTop: "4px" }}>
              {BASE_URL}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              Authentication
            </span>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "13px", color: "var(--text-primary)", marginTop: "4px" }}>
              {"Authorization: Bearer <your-api-key>"}
            </div>
          </div>
          <div>
            <Link
              href="/pricing"
              style={{
                display: "inline-block",
                fontSize: "12px",
                color: "var(--accent)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Get an API key — Upgrade to Pro →
            </Link>
          </div>
        </div>
      </div>

      {/* Rate limits */}
      <div
        style={{
          background: "rgba(var(--accent-rgb, 160,0,0), 0.06)",
          border: "1px solid rgba(var(--accent-rgb, 160,0,0), 0.2)",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "32px",
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--text-primary)" }}>Rate limits:</strong>{" "}
        Free tier: 100 req/day (unauthenticated, IP-limited).{" "}
        Pro: 10,000 req/day. Enterprise: custom. All responses are cached — identical
        requests within cache TTL count as a single request.
      </div>

      {/* Endpoint sections */}
      {ENDPOINTS.map((section) => (
        <div key={section.section} style={{ marginBottom: "40px" }}>
          <h2
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "12px",
              paddingBottom: "8px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {section.section}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)", borderRadius: "8px", overflow: "hidden" }}>
            {section.items.map((ep, i) => (
              <EndpointRow key={i} endpoint={ep} />
            ))}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
        All responses are JSON. Timestamps are ISO 8601 UTC. Solana addresses are base58-encoded.
        For enterprise data volumes, custom SLAs, or on-prem ClickHouse access, contact{" "}
        <a href="mailto:api@bloodhound.xyz" style={{ color: "var(--accent)", textDecoration: "none" }}>
          api@bloodhound.xyz
        </a>
        .
      </p>
    </div>
  );
}

function EndpointRow({
  endpoint,
}: {
  endpoint: {
    method: string;
    path: string;
    params: string;
    description: string;
    example?: string;
    response: string;
  };
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        padding: "16px 20px",
      }}
    >
      {/* Method + path */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "6px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "JetBrains Mono, monospace",
            color: METHOD_COLORS[endpoint.method] ?? "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          {endpoint.method}
        </span>
        <code
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "13px",
            color: "var(--text-primary)",
            fontWeight: 500,
          }}
        >
          {endpoint.path}
        </code>
      </div>

      {/* Description */}
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>
        {endpoint.description}
      </p>

      {/* Params */}
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
        <span style={{ fontWeight: 600 }}>Params: </span>
        <code style={{ fontFamily: "JetBrains Mono, monospace" }}>{endpoint.params}</code>
      </div>

      {/* Example response */}
      <details style={{ marginTop: "8px" }}>
        <summary
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            cursor: "pointer",
            userSelect: "none",
            listStyle: "none",
          }}
        >
          Example response ▾
        </summary>
        <pre
          style={{
            marginTop: "8px",
            padding: "10px 12px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "11px",
            color: "var(--text-secondary)",
            fontFamily: "JetBrains Mono, monospace",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {endpoint.response}
        </pre>
      </details>
    </div>
  );
}
