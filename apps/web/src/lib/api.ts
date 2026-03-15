/**
 * Typed API client for the Bloodhound FastAPI backend.
 * All frontend data fetching goes through here.
 */

// All requests go through the Next.js proxy at /api/[...path]/route.ts.
// This keeps the backend URL server-side and avoids CORS issues from the client.
const API_BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API ${res.status}: ${error}`);
  }
  return res.json() as Promise<T>;
}

// --- Wallet ---

export interface EntityLabel {
  label: string;
  category: string;
  source: string;
}

export interface WalletSummary {
  address: string;
  sol_balance: number | null;
  portfolio_usd: number | null;
  total_txs: number;
  total_volume_usd: number;
  active_days: number;
  first_active: string | null;
  last_active: string | null;
  classification: string[];
  known_wallet: KnownWallet | null;
  entity_label: EntityLabel | null;
}

export interface Transfer {
  tx_signature: string;
  block_time: string;
  from_address: string;
  to_address: string;
  token_mint: string;
  amount: number;
  amount_usd: number;
  chain: string;
  from_known?: { label: string } | null;
  to_known?: { label: string } | null;
}

// --- Search ---

export interface SearchResult {
  type: "wallet" | "token" | "transaction" | "program";
  id: string;
  label: string;
  sublabel?: string;
}

export interface AutocompleteSuggestion {
  type: "wallet" | "token" | "transaction" | "program";
  id: string;
  label: string;
  sublabel?: string;
}

export const searchApi = {
  autocomplete: (q: string) =>
    apiFetch<{ suggestions: AutocompleteSuggestion[] }>(
      `/v1/search/autocomplete?q=${encodeURIComponent(q)}`
    ),
  search: (q: string, limit = 20) =>
    apiFetch<{ results: SearchResult[] }>(
      `/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
};

export interface Transaction {
  tx_signature: string;
  block_time: string;
  tx_type: "SWAP" | "TRANSFER" | "NFT_SALE" | "MINT" | "BURN" | "STAKE" | "OTHER";
  source_platform: string;
  status: "success" | "failed";
  from_address: string;
  to_address: string | null;
  token_mint: string | null;
  token_symbol: string | null;
  amount: number | null;
  amount_usd: number | null;
  direction: "in" | "out" | "self";
  counterparty: string | null;
  counterparty_label: string | null;
  realized_pnl_usd: number | null;
}

export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  logo_uri: string | null;
  amount: number;
  usd_value: number | null;
  price_usd: number | null;
}

export interface NftHolding {
  mint: string;
  name: string;
  symbol: string | null;
  image: string | null;
  collection_address: string | null;
  attributes: { trait_type: string; value: string }[];
  interface: string;
  is_compressed: boolean;
  floor_price_sol?: number | null;
  listing_price_sol?: number | null;
  is_listed?: boolean;
}

export interface SideWalletCandidate {
  address: string;
  confidence: number;
  signals: string[];
  known_label: string | null;
}

export interface IntelligenceSummary {
  summary: string;
  confidence: "CONFIRMED" | "PROBABLE" | "SUSPECTED" | "UNKNOWN";
  generated_at: string;
}

export interface KnownWallet {
  label: string;
  category: string;
  twitter_handle: string | null;
  telegram_handle: string | null;
}

export interface Counterparty {
  counterparty: string;
  interaction_count: number;
  total_volume_usd: number;
  last_interaction: string;
}

export const walletApi = {
  summary: (address: string) =>
    apiFetch<WalletSummary>(`/v1/wallet/${address}/summary`),

  transfers: (
    address: string,
    params: {
      page?: number;
      limit?: number;
      token?: string;
      direction?: "in" | "out" | "both";
      date_from?: string;
      date_to?: string;
    } = {}
  ) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ transfers: Transfer[] }>(
      `/v1/wallet/${address}/transfers${qs ? `?${qs}` : ""}`
    );
  },

  relationships: (address: string) =>
    apiFetch<{ counterparties: Counterparty[] }>(
      `/v1/wallet/${address}/relationships`
    ),

  sideWallets: (address: string) =>
    apiFetch<{ candidates: unknown[] }>(`/v1/wallet/${address}/side-wallets`),

  classification: (address: string) =>
    apiFetch<{ labels: string[]; confidence: Record<string, number> }>(
      `/v1/wallet/${address}/classification`
    ),

  twitter: (address: string) =>
    apiFetch<{ address: string; twitter: unknown | null }>(
      `/v1/wallet/${address}/twitter`
    ),

  trackerCount: (address: string) =>
    apiFetch<{ tracker_count: number }>(
      `/v1/wallet/${address}/tracker-count`
    ),

  transactions: async (
    address: string,
    params: {
      page?: number;
      limit?: number;
      token?: string;
      direction?: "in" | "out" | "both";
      tx_type?: string;
      date_from?: string;
      date_to?: string;
    } = {}
  ): Promise<{ transactions: Transaction[]; total: number; has_more: boolean }> => {
    const limit = params.limit ?? 25;
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    const data = await apiFetch<{ transfers: Transfer[]; page: number; limit: number }>(
      `/v1/wallet/${address}/transfers${qs ? `?${qs}` : ""}`
    );
    // Map Transfer → Transaction (enrich with direction + counterparty)
    const transactions: Transaction[] = data.transfers.map((t) => {
      const direction: "in" | "out" | "self" =
        t.from_address === address && t.to_address === address
          ? "self"
          : t.to_address === address
          ? "in"
          : "out";
      const counterparty =
        direction === "in" ? t.from_address : direction === "out" ? t.to_address : null;
      const counterpartyKnown =
        direction === "in" ? t.from_known : direction === "out" ? t.to_known : null;
      return {
        tx_signature: t.tx_signature,
        block_time: t.block_time,
        tx_type: "TRANSFER",
        source_platform: "unknown",
        status: "success",
        from_address: t.from_address,
        to_address: t.to_address,
        token_mint: t.token_mint,
        token_symbol: t.token_mint === "SOL" ? "SOL" : null,
        amount: t.amount,
        amount_usd: t.amount_usd > 0 ? t.amount_usd : null,
        direction,
        counterparty,
        counterparty_label: counterpartyKnown?.label ?? null,
        realized_pnl_usd: null,
      };
    });
    // If we received a full page, assume there are more pages
    const has_more = data.transfers.length === limit;
    return { transactions, total: transactions.length, has_more };
  },

  holdings: (address: string) =>
    apiFetch<{ holdings: TokenHolding[] }>(`/v1/wallet/${address}/holdings`),

  nftHoldings: (address: string) =>
    apiFetch<{ nfts: NftHolding[]; count: number }>(`/v1/wallet/${address}/nft-holdings`),

  intelligence: (address: string) =>
    apiFetch<IntelligenceSummary>(`/v1/wallet/${address}/intelligence`),

  sideWalletsTyped: (address: string) =>
    apiFetch<{ candidates: SideWalletCandidate[] }>(
      `/v1/wallet/${address}/side-wallets`
    ),
};

// --- Token ---

export interface TokenSummary {
  mint: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  supply: number | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  volume_24h_usd: number | null;
  price_change_24h_pct: number | null;
  liquidity_usd: number | null;
  holder_count: number | null;
  logo_uri: string | null;
  security_score: number | null;
  is_pump_fun: boolean | null;
  pair_address: string | null;
  dex: string | null;
  fdv: number | null;
}

export interface TokenHolder {
  owner: string;
  amount: number;
  percentage: number;
  value_usd: number;
  known_wallet: { label: string; category: string } | null;
}

export interface TokenHoldersResponse {
  mint: string;
  total: number;
  holder_count: number;
  top10_pct: number;
  price_usd: number;
  holders: TokenHolder[];
}

export interface TopTrader {
  address: string;
  holding_amount: number;
  holding_pct: number;
  value_usd: number;
  volume?: number;
  pnl?: number | null;
  trade_count?: number | null;
  known_wallet: { label: string } | null;
}

export interface OHLCVItem {
  unixTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const tokenApi = {
  summary: (mint: string) =>
    apiFetch<TokenSummary>(`/v1/token/${mint}/summary`),

  holders: (mint: string, limit = 100, offset = 0) =>
    apiFetch<TokenHoldersResponse>(
      `/v1/token/${mint}/holders?limit=${limit}&offset=${offset}`
    ),

  topTraders: (mint: string, limit = 20) =>
    apiFetch<{ mint: string; traders: TopTrader[] }>(
      `/v1/token/${mint}/top-traders?limit=${limit}`
    ),

  security: (mint: string) =>
    apiFetch<Record<string, unknown>>(`/v1/token/${mint}/security`),

  largeTrades: (mint: string, limit = 20) =>
    apiFetch<{ mint: string; trades: unknown[] }>(
      `/v1/token/${mint}/large-trades?limit=${limit}`
    ),

  launchIntel: (mint: string) =>
    apiFetch<{ mint: string; early_buyers: unknown[]; is_pump_fun: boolean | null }>(
      `/v1/token/${mint}/launch-intel`
    ),

  ohlcv: (mint: string, resolution = "1D", timeFrom?: number, timeTo?: number) => {
    const params = new URLSearchParams({ resolution });
    if (timeFrom) params.set("time_from", String(timeFrom));
    if (timeTo) params.set("time_to", String(timeTo));
    return apiFetch<{ mint: string; resolution: string; items: OHLCVItem[] }>(
      `/v1/token/${mint}/ohlcv?${params.toString()}`
    );
  },

  dexInfo: (mint: string) =>
    apiFetch<DexInfo>(`/v1/token/${mint}/dex-info`),
};

export interface DexInfo {
  mint: string;
  dex_paid: {
    has_paid: boolean;
    orders: { type: string; status: string }[];
    has_token_profile: boolean;
    has_community_takeover: boolean;
    has_token_ad: boolean;
  };
  boosts: {
    is_boosted: boolean;
    boost_count: number;
    url?: string;
    description?: string;
    icon?: string;
  };
  profile: {
    image_url?: string;
    header_url?: string;
    description?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

// --- Transaction ---

export interface TxDetail {
  signature: string;
  timestamp: number;
  slot: number;
  fee: number;
  feePayer: string;
  type: string;
  source: string;
  description: string;
  nativeTransfers: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
  }[];
  accountData: { account: string; nativeBalanceChange: number }[];
}

export const txApi = {
  get: (sig: string) => apiFetch<TxDetail>(`/v1/tx/${sig}`),
};

// --- Tracked Wallets ---

export interface TrackedWallet {
  address: string;
  label: string;
  group_id: string | null;
  is_own: boolean;
  tags: string[];
  created_at: string;
}

export interface WalletGroup {
  id: string;
  name: string;
  created_at: string;
}

export const trackedApi = {
  list: () => apiFetch<{ tracked: TrackedWallet[]; count: number }>("/v1/me/tracked"),

  add: (body: { address: string; label: string; group_id?: string; is_own?: boolean; tags?: string[] }) =>
    apiFetch<{ wallet: TrackedWallet }>("/v1/me/tracked", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (address: string, body: { label?: string; group_id?: string; tags?: string[] }) =>
    apiFetch<{ wallet: TrackedWallet }>(`/v1/me/tracked/${address}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  remove: (address: string) =>
    apiFetch<void>(`/v1/me/tracked/${address}`, { method: "DELETE" }),

  groups: () => apiFetch<{ groups: WalletGroup[] }>("/v1/me/groups"),

  feed: (limit = 50, offset = 0) =>
    apiFetch<{ feed: Transfer[]; count: number; total_wallets: number }>(
      `/v1/me/feed?limit=${limit}&offset=${offset}`
    ),
};

// --- Signals ---

export interface Signal {
  signal_type: string;
  confidence: "CONFIRMED" | "PROBABLE" | "SUSPECTED";
  wallet_address: string;
  metadata: Record<string, unknown>;
  detected_at: string;
}

export const signalsApi = {
  feed: (params: { types?: string; confidence?: string; wallet?: string; wallets?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ signals: Signal[]; page: number; limit: number; count: number }>(
      `/v1/signals${qs ? `?${qs}` : ""}`
    );
  },
};

// --- Bloodhound AI ---

export interface AIQueryResponse {
  answer: string;
  numbers: Record<string, string | number>[];
  evidence: { tx_signature: string; block_time: string; amount: number }[];
  confidence: "CONFIRMED" | "PROBABLE" | "SUSPECTED" | "UNKNOWN";
  viz_type: "graph" | "table" | "none";
  actions: { type: string; parameters: Record<string, unknown> }[];
}

export const aiApi = {
  query: (
    query: string,
    sessionId: string,
    context: {
      tracked_wallets: { label: string; address: string }[];
      prior_messages?: { role: string; content: string }[];
    }
  ) =>
    apiFetch<AIQueryResponse>("/v1/ai/query", {
      method: "POST",
      body: JSON.stringify({ query, session_id: sessionId, context }),
    }),
};

// --- Leaderboard ---

export interface LeaderboardEntry {
  rank: number;
  address: string;
  label: string | null;
  category: string | null;
  twitter_handle: string | null;
  confidence: number | null;
  portfolio_usd: number | null;
  holdings_count: number;
  realized_pnl_usd: number | null;
  trade_count: number | null;
  win_rate: number | null;
  best_token: string | null;
  pnl_available: boolean;
}

export interface LeaderboardResponse {
  category: string;
  timeframe: string;
  entries: LeaderboardEntry[];
  count: number;
  metric: "portfolio_usd" | "realized_pnl_usd";
  metric_note: string;
}

export interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  price_usd: number;
  price_change_pct: number;
  volume_24h_usd: number;
  trade_count_24h?: number;
  market_cap_usd?: number;
  logo_uri: string | null;
}

export const leaderboardApi = {
  get: (params: { category?: string; timeframe?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<LeaderboardResponse>(`/v1/leaderboard${qs ? `?${qs}` : ""}`);
  },
};

export const trendingApi = {
  tokens: (limit = 10) =>
    apiFetch<{ tokens: TrendingToken[]; sort_type: string }>(
      `/v1/leaderboard/trending?limit=${limit}`
    ),
  gainers: (timeframe = "24h", limit = 10, sortType: "gainers" | "losers" = "gainers") =>
    apiFetch<{ tokens: TrendingToken[]; sort_type: string }>(
      `/v1/leaderboard/gainers?timeframe=${timeframe}&limit=${limit}&sort_type=${sortType}`
    ),
};

// --- KOL Feed ---

export interface KolTrade {
  tx_signature: string;
  block_time: string;
  trader: string;
  dex: string;
  token_in_mint: string;
  token_out_mint: string;
  amount_in: number;
  amount_out: number;
  amount_usd: number;
  realized_pnl_usd: number;
  direction: "buy" | "sell";
  kol_label: string | null;
  kol_twitter: string | null;
}

export interface SmartMoneyKol {
  address: string;
  label: string | null;
  twitter_handle: string | null;
  bought_usd: number;
  sold_usd: number;
  net_usd: number;
  direction: "buying" | "selling" | "neutral";
}

export const kolFeedApi = {
  feed: (params: { limit?: number; min_usd?: number; kol_address?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ trades: KolTrade[]; count: number }>(
      `/v1/leaderboard/kol-feed${qs ? `?${qs}` : ""}`
    );
  },

  smartMoney: (mint: string, hours = 48) =>
    apiFetch<{
      mint: string;
      hours: number;
      buyers: number;
      sellers: number;
      net_score: number;
      kol_count: number;
      kols: SmartMoneyKol[];
    }>(`/v1/leaderboard/smart-money?mint=${mint}&hours=${hours}`),
};

// --- Events ---

export interface KnownEvent {
  slug: string;
  title: string;
  category: string;
  significance: string;
  occurred_at: string;
  token_symbol: string | null;
  token_mint: string | null;
  description?: string;
  wallets?: EventWallet[];
}

export interface EventWallet {
  address: string;
  role: string;
  description: string | null;
  amount_usd: number | null;
  known_wallet?: { label: string; category: string } | null;
}

export const eventsApi = {
  list: (params: { category?: string; significance?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ events: KnownEvent[]; count: number }>(
      `/v1/events${qs ? `?${qs}` : ""}`
    );
  },

  get: (slug: string) =>
    apiFetch<KnownEvent>(`/v1/events/${slug}`),

  walletEvents: (address: string) =>
    apiFetch<{ address: string; events: KnownEvent[]; count: number }>(
      `/v1/wallet/${address}/events`
    ),
};

// --- Portfolio ---

export interface PortfolioWallet {
  address: string;
  label: string;
}

export interface PortfolioHolding extends TokenHolding {
  kol_count: number;
  kol_traders: string[];
}

export interface PortfolioResponse {
  wallets: PortfolioWallet[];
  holdings: PortfolioHolding[];
  total_usd: number;
  kol_overlap: Record<string, { kol_count: number; kol_traders: string[] }>;
}

export interface PortfolioReport {
  report: string;
  total_usd: number;
  wallet_count: number;
  holding_count: number;
}

export const portfolioApi = {
  get: () => apiFetch<PortfolioResponse>("/v1/me/portfolio"),
  report: () => apiFetch<PortfolioReport>("/v1/me/portfolio/report", { method: "POST" }),
};

// --- Entity / Identity Clustering ---

export interface ClusterMember {
  address: string;
  confidence: number;
  signals: string[];
  signal_weights: Record<string, number>;
  explanation: string | null;
}

export interface EntityCluster {
  root: string;
  members: ClusterMember[];
  cluster_confidence: number;
}

export interface EntityProfile {
  address: string;
  known_wallet: KnownWallet | null;
  cluster: EntityCluster;
  total_usd: number;
  combined_holdings: TokenHolding[];
  combined_events: KnownEvent[];
  wallet_count: number;
}

export const entityApi = {
  get: (address: string) =>
    apiFetch<EntityProfile>(`/v1/entity/${address}`),
};

// --- Alerts ---

// --- API Keys (Next.js routes, not FastAPI proxy) ---

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;   // First 12 chars — safe to display
  created_at: string;
  last_used_at: string | null;
}

async function keysFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const keysApi = {
  list: () => keysFetch<{ keys: ApiKey[] }>("/api/keys"),

  create: (name?: string) =>
    keysFetch<ApiKey & { key: string }>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name: name ?? "Default" }),
    }),

  revoke: (id: string) =>
    keysFetch<{ revoked: boolean }>(`/api/keys/${id}`, { method: "DELETE" }),
};

// --- New Pairs ---

export interface NewPairMetadata {
  mint?: string;
  symbol?: string;
  name?: string;
  dex?: string;
  icon?: string;
  dexscreener_url?: string;
  initial_price_sol?: number;
  creator?: string;
  market_cap?: number;
  description?: string;
}

export interface NewPairMarket {
  price_usd: number;
  price_change_5m?: number;
  price_change_1h?: number;
  price_change_24h?: number;
  volume_5m?: number;
  volume_1h?: number;
  volume_24h?: number;
  liquidity_usd?: number;
  market_cap?: number;
  txns_5m_buys?: number;
  txns_5m_sells?: number;
  txns_1h_buys?: number;
  txns_1h_sells?: number;
  pair_address?: string;
  dex_id?: string;
  pair_created_at?: number;
}

export interface NewPair {
  token_mint: string;
  signal_type: string;
  source: string;
  detected_at: string;
  description: string;
  metadata: NewPairMetadata;
  market?: NewPairMarket;
}

export const newPairsApi = {
  list: (params: { limit?: number; source?: string; enrich?: boolean } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ pairs: NewPair[]; count: number }>(
      `/v1/signals/new-pairs${qs ? `?${qs}` : ""}`
    );
  },
};

// --- KOL Profiles ---

export interface KolProfile {
  id: string;
  display_name: string;
  twitter_handle: string | null;
  twitter_pfp_url: string | null;
  telegram_handle: string | null;
  description: string | null;
  source: string;
  verified: boolean;
  total_pnl_usd: number;
  win_rate: number;
  trade_count: number;
  wallet_count?: number;
  kol_wallets?: KolWallet[];
  created_at: string;
}

export interface KolWallet {
  id: string;
  address: string;
  label: string | null;
  is_primary: boolean;
  discovered_via: string;
  confidence: number;
}

export interface KolRankingProfile {
  id: string;
  display_name: string;
  twitter_handle: string | null;
  twitter_pfp_url: string | null;
  verified: boolean;
  tier?: string;
  source?: string;
  followers_count?: number;
}

export interface KolRanking {
  rank: number;
  profile: KolRankingProfile;
  pnl_usd: number;
  pnl_sol: number;
  volume_usd: number;
  volume_sol: number;
  trade_count: number;
  winning_trades: number;
  losing_trades: number;
  positions: number;
  positions_win: number;
  positions_loss: number;
  win_rate: number;
  roi?: number;
  avg_hold_time_mins?: number;
  sol_balance?: number;
}

export const kolApi = {
  profiles: (params: { limit?: number; offset?: number; search?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ profiles: KolProfile[]; count: number }>(
      `/v1/kol/profiles${qs ? `?${qs}` : ""}`
    );
  },

  profile: (handle: string) =>
    apiFetch<KolProfile>(`/v1/kol/profiles/${handle}`),

  trades: (handle: string, limit = 50) =>
    apiFetch<{ trades: KolTrade[]; count: number }>(
      `/v1/kol/profiles/${handle}/trades?limit=${limit}`
    ),

  rankings: (params: { wallet_type?: string; period?: string; sort_by?: string; sort_dir?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiFetch<{ rankings: KolRanking[]; period: string; sort_by: string; sort_dir: string; wallet_type: string; count: number }>(
      `/v1/kol/rankings${qs ? `?${qs}` : ""}`
    );
  },

  byWallet: (address: string) =>
    apiFetch<{ kol_profile: KolProfile | null }>(`/v1/kol/wallet/${address}`),

  submit: (body: {
    wallet_address: string;
    twitter_handle?: string;
    display_name?: string;
    evidence_text?: string;
  }) =>
    apiFetch<{ success: boolean; submission_id: string }>("/v1/kol/submit", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  social: (handle: string) =>
    apiFetch<{
      profile: {
        id: string;
        username: string;
        name: string;
        description: string | null;
        profile_image_url: string | null;
        followers_count: number;
        following_count: number;
        tweet_count: number;
        verified: boolean;
      } | null;
      recent_tweets: {
        id: string;
        text: string;
        created_at: string;
        like_count: number;
        retweet_count: number;
        token_mentions: string[];
      }[];
      top_token_mentions: [string, number][];
      total_engagement: number;
    }>(`/v1/kol/profiles/${handle}/social`),
};

export const alertsApi = {
  list: () => apiFetch<{ alerts: unknown[] }>("/v1/me/alerts"),

  create: (body: {
    wallet_address: string;
    alert_type: string;
    conditions: Record<string, unknown>;
    delivery?: string[];
    is_active?: boolean;
  }) =>
    apiFetch<{ alert: unknown }>("/v1/me/alerts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  remove: (alertId: string) =>
    apiFetch<void>(`/v1/me/alerts/${alertId}`, { method: "DELETE" }),
};
