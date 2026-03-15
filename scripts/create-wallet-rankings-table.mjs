#!/usr/bin/env node
/**
 * Creates wallet_rankings and wallet_trades tables in Supabase.
 * Uses raw SQL via the Supabase REST API since the JS client can't run DDL.
 * 
 * Usage: node scripts/create-wallet-rankings-table.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load env
const envPath = resolve(import.meta.dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0 && !trimmed.startsWith("#")) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    const hashIdx = val.indexOf("  #");
    if (hashIdx > 0) val = val.slice(0, hashIdx).trim();
    env[key] = val;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

// Execute SQL via Supabase REST RPC (postgrest doesn't support DDL,
// so we use the management API or the pg REST endpoint)
async function runSQL(sql) {
  const url = `${supabaseUrl}/rest/v1/rpc/`;
  
  // Use the Supabase SQL endpoint (available with service role key)
  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  
  return resp;
}

// Since we can't run raw DDL via PostgREST, we'll create the tables
// using the Supabase Management API or just use the JS client to verify.
// For now, let's output the SQL that needs to be run in the Supabase SQL Editor.

const SQL = `
-- ============================================================
-- BLOODHOUND — wallet_rankings table (simplified, no custom enums)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================

-- Drop custom types if they exist (avoids errors on re-run)
DO $$ BEGIN
  CREATE TYPE wallet_tier AS ENUM ('legendary', 'elite', 'pro', 'rising', 'standard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_type AS ENUM ('kol', 'smart_money', 'sniper', 'fresh_wallet', 'whale', 'insider', 'copy_trader', 'market_maker', 'protocol', 'suspicious');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- wallet_rankings table
CREATE TABLE IF NOT EXISTS wallet_rankings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  address         text UNIQUE NOT NULL,
  label           text,
  twitter_handle  text,
  telegram_handle text,
  avatar_url      text,
  bio             text,
  wallet_type     text NOT NULL DEFAULT 'smart_money',
  tier            text NOT NULL DEFAULT 'standard',
  categories      text[] DEFAULT '{}',
  total_pnl_sol       decimal(20,8) DEFAULT 0,
  total_pnl_usd       decimal(20,2) DEFAULT 0,
  win_rate            decimal(5,2) DEFAULT 0,
  total_trades        integer DEFAULT 0,
  winning_trades      integer DEFAULT 0,
  losing_trades       integer DEFAULT 0,
  avg_hold_time_mins  integer DEFAULT 0,
  pnl_1d_sol      decimal(20,8) DEFAULT 0,
  pnl_7d_sol      decimal(20,8) DEFAULT 0,
  pnl_30d_sol     decimal(20,8) DEFAULT 0,
  pnl_1d_usd      decimal(20,2) DEFAULT 0,
  pnl_7d_usd      decimal(20,2) DEFAULT 0,
  pnl_30d_usd     decimal(20,2) DEFAULT 0,
  volume_1d_usd   decimal(20,2) DEFAULT 0,
  volume_7d_usd   decimal(20,2) DEFAULT 0,
  volume_30d_usd  decimal(20,2) DEFAULT 0,
  followers_count integer DEFAULT 0,
  copiers_count   integer DEFAULT 0,
  overall_score       decimal(5,2) DEFAULT 50,
  profitability_score decimal(5,2) DEFAULT 50,
  consistency_score   decimal(5,2) DEFAULT 50,
  timing_score        decimal(5,2) DEFAULT 50,
  first_seen_at   timestamptz,
  last_active_at  timestamptz,
  sol_balance     decimal(20,8) DEFAULT 0,
  source          text DEFAULT 'manual',
  confidence      decimal(3,2) DEFAULT 0.5,
  is_verified     boolean DEFAULT false,
  is_public       boolean DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wr_type ON wallet_rankings(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wr_tier ON wallet_rankings(tier);
CREATE INDEX IF NOT EXISTS idx_wr_pnl_7d ON wallet_rankings(pnl_7d_sol DESC);
CREATE INDEX IF NOT EXISTS idx_wr_win_rate ON wallet_rankings(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_wr_score ON wallet_rankings(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_wr_twitter ON wallet_rankings(twitter_handle);

-- wallet_trades table
CREATE TABLE IF NOT EXISTS wallet_trades (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address  text NOT NULL,
  token_address   text NOT NULL,
  token_symbol    text,
  token_name      text,
  trade_type      text NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount_tokens   decimal(30,8) NOT NULL DEFAULT 0,
  amount_sol      decimal(20,8) NOT NULL DEFAULT 0,
  amount_usd      decimal(20,2) DEFAULT 0,
  price_per_token decimal(30,18),
  tx_signature    text UNIQUE,
  block_time      timestamptz NOT NULL DEFAULT now(),
  is_snipe        boolean DEFAULT false,
  is_early        boolean DEFAULT false,
  hold_time_mins  integer,
  pnl_sol         decimal(20,8),
  pnl_percent     decimal(10,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wt_address ON wallet_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wt_token ON wallet_trades(token_address);
CREATE INDEX IF NOT EXISTS idx_wt_time ON wallet_trades(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_wt_snipe ON wallet_trades(is_snipe) WHERE is_snipe = true;

-- wallet_signals table
CREATE TABLE IF NOT EXISTS wallet_signals (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address  text NOT NULL,
  signal_type     text NOT NULL,
  signal_strength decimal(3,2) NOT NULL DEFAULT 0.5,
  details         jsonb,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ws_address ON wallet_signals(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ws_type ON wallet_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_ws_recent ON wallet_signals(detected_at DESC);

-- RLS policies
ALTER TABLE wallet_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_signals ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read wallet_rankings" ON wallet_rankings FOR SELECT USING (true);
CREATE POLICY "Public read wallet_trades" ON wallet_trades FOR SELECT USING (true);
CREATE POLICY "Public read wallet_signals" ON wallet_signals FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service insert wallet_rankings" ON wallet_rankings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update wallet_rankings" ON wallet_rankings FOR UPDATE USING (true);
CREATE POLICY "Service insert wallet_trades" ON wallet_trades FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert wallet_signals" ON wallet_signals FOR INSERT WITH CHECK (true);
`;

console.log("=".repeat(60));
console.log("BLOODHOUND — Database Migration");
console.log("=".repeat(60));
console.log("");
console.log("The wallet_rankings, wallet_trades, and wallet_signals tables");
console.log("need to be created in your Supabase database.");
console.log("");
console.log("Please run the following SQL in your Supabase SQL Editor:");
console.log("  Dashboard → SQL Editor → New Query → Paste & Run");
console.log("");
console.log("─".repeat(60));
console.log(SQL);
console.log("─".repeat(60));
console.log("");
console.log("After running the SQL, re-run:");
console.log("  node scripts/seed-wallet-rankings.mjs");
