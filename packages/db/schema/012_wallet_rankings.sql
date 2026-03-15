-- ============================================================
-- BLOODHOUND — Wallet Rankings & Categorization System
-- Similar to GMGN/Axiom: KOLs, Smart Money, Snipers, etc.
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- WALLET CATEGORIES (expanded from known_wallets)
-- ============================================================
CREATE TYPE wallet_tier AS ENUM (
  'legendary',   -- Top 1% performers
  'elite',       -- Top 5% performers  
  'pro',         -- Top 20% performers
  'rising',      -- Promising newcomers
  'standard'     -- Regular wallets
);

CREATE TYPE wallet_type AS ENUM (
  'kol',              -- Key Opinion Leader (has social following)
  'smart_money',      -- Consistently profitable, no social presence
  'sniper',           -- Early buyer, quick exits
  'fresh_wallet',     -- < 30 days old, watching behavior
  'whale',            -- Large holdings, market movers
  'insider',          -- Dev/team wallets, early access
  'copy_trader',      -- Follows other wallets
  'market_maker',     -- Provides liquidity, frequent trades
  'protocol',         -- Protocol/exchange wallets
  'suspicious'        -- Flagged for review
);

-- ============================================================
-- WALLET RANKINGS (core ranking table)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_rankings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  address         text UNIQUE NOT NULL,
  
  -- Identity
  label           text,
  twitter_handle  text,
  telegram_handle text,
  avatar_url      text,
  bio             text,
  
  -- Classification
  wallet_type     wallet_type NOT NULL DEFAULT 'smart_money',
  tier            wallet_tier NOT NULL DEFAULT 'standard',
  categories      text[] DEFAULT '{}',  -- Additional tags
  
  -- Performance Metrics (updated periodically)
  total_pnl_sol       decimal(20,8) DEFAULT 0,
  total_pnl_usd       decimal(20,2) DEFAULT 0,
  win_rate            decimal(5,2) DEFAULT 0,  -- 0-100%
  total_trades        integer DEFAULT 0,
  winning_trades      integer DEFAULT 0,
  losing_trades       integer DEFAULT 0,
  avg_hold_time_mins  integer DEFAULT 0,
  
  -- Time-based PnL (for leaderboards)
  pnl_1d_sol      decimal(20,8) DEFAULT 0,
  pnl_7d_sol      decimal(20,8) DEFAULT 0,
  pnl_30d_sol     decimal(20,8) DEFAULT 0,
  pnl_1d_usd      decimal(20,2) DEFAULT 0,
  pnl_7d_usd      decimal(20,2) DEFAULT 0,
  pnl_30d_usd     decimal(20,2) DEFAULT 0,
  
  -- Volume metrics
  volume_1d_usd   decimal(20,2) DEFAULT 0,
  volume_7d_usd   decimal(20,2) DEFAULT 0,
  volume_30d_usd  decimal(20,2) DEFAULT 0,
  
  -- Social metrics
  followers_count integer DEFAULT 0,
  copiers_count   integer DEFAULT 0,  -- Users copying this wallet
  
  -- Ranking scores (0-100)
  overall_score       decimal(5,2) DEFAULT 50,
  profitability_score decimal(5,2) DEFAULT 50,
  consistency_score   decimal(5,2) DEFAULT 50,
  timing_score        decimal(5,2) DEFAULT 50,  -- Entry/exit timing
  
  -- Tracking
  first_seen_at   timestamptz,
  last_active_at  timestamptz,
  sol_balance     decimal(20,8) DEFAULT 0,
  
  -- Metadata
  source          text DEFAULT 'manual',  -- kolscan, axiom, gmgn, manual
  confidence      decimal(3,2) DEFAULT 0.5,
  is_verified     boolean DEFAULT false,
  is_public       boolean DEFAULT true,
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_rankings_type ON wallet_rankings(wallet_type);
CREATE INDEX idx_wallet_rankings_tier ON wallet_rankings(tier);
CREATE INDEX idx_wallet_rankings_pnl_7d ON wallet_rankings(pnl_7d_sol DESC);
CREATE INDEX idx_wallet_rankings_win_rate ON wallet_rankings(win_rate DESC);
CREATE INDEX idx_wallet_rankings_score ON wallet_rankings(overall_score DESC);
CREATE INDEX idx_wallet_rankings_twitter ON wallet_rankings(twitter_handle);

-- ============================================================
-- WALLET TRADES (track individual trades for analysis)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_trades (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address  text NOT NULL,
  
  -- Trade details
  token_address   text NOT NULL,
  token_symbol    text,
  token_name      text,
  
  trade_type      text NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount_tokens   decimal(30,8) NOT NULL,
  amount_sol      decimal(20,8) NOT NULL,
  amount_usd      decimal(20,2),
  price_per_token decimal(30,18),
  
  -- Transaction
  tx_signature    text UNIQUE,
  block_time      timestamptz NOT NULL,
  
  -- Analysis
  is_snipe        boolean DEFAULT false,  -- Bought in first 10 blocks
  is_early        boolean DEFAULT false,  -- Bought in first hour
  hold_time_mins  integer,                -- For sells, time held
  pnl_sol         decimal(20,8),          -- For sells, profit/loss
  pnl_percent     decimal(10,2),          -- For sells, % gain/loss
  
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_trades_address ON wallet_trades(wallet_address);
CREATE INDEX idx_wallet_trades_token ON wallet_trades(token_address);
CREATE INDEX idx_wallet_trades_time ON wallet_trades(block_time DESC);
CREATE INDEX idx_wallet_trades_snipe ON wallet_trades(is_snipe) WHERE is_snipe = true;

-- ============================================================
-- WALLET FOLLOWERS (who copies/tracks who)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_followers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address  text NOT NULL,
  
  -- Follow settings
  is_copy_trading boolean DEFAULT false,  -- Auto-copy trades
  copy_amount_sol decimal(20,8),          -- Amount to copy per trade
  copy_percentage decimal(5,2),           -- Or % of their trade
  max_per_trade   decimal(20,8),          -- Max SOL per trade
  
  -- Notifications
  notify_buys     boolean DEFAULT true,
  notify_sells    boolean DEFAULT true,
  notify_large    boolean DEFAULT true,   -- Large trades only
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(follower_id, wallet_address)
);

CREATE INDEX idx_wallet_followers_wallet ON wallet_followers(wallet_address);
CREATE INDEX idx_wallet_followers_user ON wallet_followers(follower_id);

-- ============================================================
-- LEADERBOARD SNAPSHOTS (historical rankings)
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   date NOT NULL,
  period          text NOT NULL CHECK (period IN ('1d', '7d', '30d', 'all')),
  wallet_type     wallet_type,
  
  -- Top performers (JSONB array)
  rankings        jsonb NOT NULL,  -- [{address, label, pnl, rank, ...}]
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(snapshot_date, period, wallet_type)
);

CREATE INDEX idx_leaderboard_date ON leaderboard_snapshots(snapshot_date DESC);

-- ============================================================
-- WALLET SIGNALS (detected patterns/behaviors)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_signals (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address  text NOT NULL,
  
  signal_type     text NOT NULL,  -- 'sniper', 'insider_buy', 'whale_accumulate', etc.
  signal_strength decimal(3,2) NOT NULL,  -- 0-1
  details         jsonb,
  
  detected_at     timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz  -- Signal validity
);

CREATE INDEX idx_wallet_signals_address ON wallet_signals(wallet_address);
CREATE INDEX idx_wallet_signals_type ON wallet_signals(signal_type);
CREATE INDEX idx_wallet_signals_recent ON wallet_signals(detected_at DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get top wallets by category and time period
CREATE OR REPLACE FUNCTION get_top_wallets(
  p_wallet_type wallet_type DEFAULT NULL,
  p_period text DEFAULT '7d',
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  rank integer,
  address text,
  label text,
  twitter_handle text,
  wallet_type wallet_type,
  tier wallet_tier,
  pnl_sol decimal,
  pnl_usd decimal,
  win_rate decimal,
  total_trades integer,
  overall_score decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY 
      CASE p_period
        WHEN '1d' THEN wr.pnl_1d_sol
        WHEN '7d' THEN wr.pnl_7d_sol
        WHEN '30d' THEN wr.pnl_30d_sol
        ELSE wr.total_pnl_sol
      END DESC
    )::integer as rank,
    wr.address,
    wr.label,
    wr.twitter_handle,
    wr.wallet_type,
    wr.tier,
    CASE p_period
      WHEN '1d' THEN wr.pnl_1d_sol
      WHEN '7d' THEN wr.pnl_7d_sol
      WHEN '30d' THEN wr.pnl_30d_sol
      ELSE wr.total_pnl_sol
    END as pnl_sol,
    CASE p_period
      WHEN '1d' THEN wr.pnl_1d_usd
      WHEN '7d' THEN wr.pnl_7d_usd
      WHEN '30d' THEN wr.pnl_30d_usd
      ELSE wr.total_pnl_usd
    END as pnl_usd,
    wr.win_rate,
    wr.total_trades,
    wr.overall_score
  FROM wallet_rankings wr
  WHERE 
    wr.is_public = true
    AND (p_wallet_type IS NULL OR wr.wallet_type = p_wallet_type)
  ORDER BY pnl_sol DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Update wallet tier based on performance
CREATE OR REPLACE FUNCTION update_wallet_tier(p_address text)
RETURNS wallet_tier AS $$
DECLARE
  v_percentile decimal;
  v_tier wallet_tier;
BEGIN
  -- Calculate percentile based on 7d PnL
  SELECT 
    percent_rank() OVER (ORDER BY pnl_7d_sol)
  INTO v_percentile
  FROM wallet_rankings
  WHERE address = p_address;
  
  -- Assign tier
  v_tier := CASE
    WHEN v_percentile >= 0.99 THEN 'legendary'
    WHEN v_percentile >= 0.95 THEN 'elite'
    WHEN v_percentile >= 0.80 THEN 'pro'
    WHEN v_percentile >= 0.50 THEN 'rising'
    ELSE 'standard'
  END;
  
  -- Update the wallet
  UPDATE wallet_rankings 
  SET tier = v_tier, updated_at = now()
  WHERE address = p_address;
  
  RETURN v_tier;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MIGRATE EXISTING DATA
-- ============================================================
-- Insert existing known_wallets into wallet_rankings
INSERT INTO wallet_rankings (
  address, label, twitter_handle, telegram_handle,
  wallet_type, confidence, source, is_verified
)
SELECT 
  address, label, twitter_handle, telegram_handle,
  CASE category
    WHEN 'kol' THEN 'kol'::wallet_type
    WHEN 'profitable_trader' THEN 'smart_money'::wallet_type
    WHEN 'protocol_team' THEN 'protocol'::wallet_type
    WHEN 'exchange' THEN 'protocol'::wallet_type
    WHEN 'suspected_bad_actor' THEN 'suspicious'::wallet_type
    ELSE 'smart_money'::wallet_type
  END,
  confidence,
  source,
  status = 'approved'
FROM known_wallets
WHERE status = 'approved'
ON CONFLICT (address) DO UPDATE SET
  label = EXCLUDED.label,
  twitter_handle = COALESCE(EXCLUDED.twitter_handle, wallet_rankings.twitter_handle),
  updated_at = now();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE wallet_rankings IS 'Core wallet ranking and categorization system - similar to GMGN/Axiom';
COMMENT ON TABLE wallet_trades IS 'Individual trade history for performance analysis';
COMMENT ON TABLE wallet_followers IS 'User follows and copy trading settings';
COMMENT ON TABLE leaderboard_snapshots IS 'Historical leaderboard data for trends';
COMMENT ON TABLE wallet_signals IS 'Detected wallet behaviors and patterns';
