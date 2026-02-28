-- ============================================================
-- BLOODHOUND — ClickHouse Analytical Schema
-- Run against your ClickHouse instance
-- Start with ClickHouse Cloud free tier: clickhouse.cloud
-- ============================================================

CREATE DATABASE IF NOT EXISTS bloodhound;

USE bloodhound;

-- ============================================================
-- TRANSACTIONS (primary analytical table)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  signature       String,
  block_time      DateTime,
  slot            UInt64,
  chain           String DEFAULT 'solana',
  signers         Array(String),
  fee             UInt64,
  tx_type         String,        -- SWAP | TRANSFER | NFT_SALE | MINT | BURN | STAKE | etc.
  source_platform String,        -- axiom | phantom | jupiter | raydium | pump_fun | coinbase | orca | jito | unknown
  source_program  String,
  status          String,        -- success | failed
  raw_events      String         -- JSON blob of Helius parsed events
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(block_time)
ORDER BY (block_time, signature)
SETTINGS index_granularity = 8192;

-- ============================================================
-- TRANSFERS (extracted from transactions)
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
  tx_signature    String,
  block_time      DateTime,
  from_address    String,
  to_address      String,
  token_mint      String,        -- 'SOL' for native SOL
  amount          Float64,
  amount_usd      Float64,       -- at time of tx; 0 if unknown
  chain           String DEFAULT 'solana'
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(block_time)
ORDER BY (from_address, block_time)
SETTINGS index_granularity = 8192;

CREATE INDEX idx_transfers_to ON transfers (to_address) TYPE bloom_filter GRANULARITY 4;

-- ============================================================
-- TOKEN TRADES (DEX swap events)
-- ============================================================
CREATE TABLE IF NOT EXISTS token_trades (
  tx_signature     String,
  block_time       DateTime,
  trader           String,
  dex              String,        -- raydium | orca | pump_fun | meteora | jupiter_agg
  token_in_mint    String,
  token_out_mint   String,
  amount_in        Float64,
  amount_out       Float64,
  amount_usd       Float64,
  realized_pnl_usd Float64,      -- calculated where possible; 0 if unknown
  chain            String DEFAULT 'solana'
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(block_time)
ORDER BY (trader, block_time)
SETTINGS index_granularity = 8192;

CREATE INDEX idx_trades_token_in ON token_trades (token_in_mint) TYPE bloom_filter GRANULARITY 4;
CREATE INDEX idx_trades_token_out ON token_trades (token_out_mint) TYPE bloom_filter GRANULARITY 4;

-- ============================================================
-- WALLET STATS DAILY (materialized view — fast aggregates)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS wallet_stats_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (address, date)
AS SELECT
  from_address       AS address,
  toDate(block_time) AS date,
  count()            AS tx_count,
  sum(amount_usd)    AS volume_usd
FROM transfers
GROUP BY address, date;

-- ============================================================
-- SIGNALS (detected on-chain anomalies)
-- ============================================================
CREATE TABLE IF NOT EXISTS signals (
  id              String DEFAULT generateUUIDv4(),
  detected_at     DateTime DEFAULT now(),
  signal_type     String,        -- abnormal_inflow | cluster_forming | deployer_funding | wash_trading | lp_removal | dormant_wake | insider_identified | pump_fun_bundler
  confidence      String,        -- CONFIRMED | PROBABLE | SUSPECTED
  scope           String,        -- global | personalized | token
  wallet_address  String,
  token_mint      String DEFAULT '',
  tx_signature    String DEFAULT '',
  description     String,
  metadata        String         -- JSON blob with signal-specific data
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(detected_at)
ORDER BY (detected_at, signal_type)
SETTINGS index_granularity = 8192;
