#!/usr/bin/env node
/**
 * BLOODHOUND — Create wallet_rankings tables and seed data in one step.
 * Uses Supabase client to execute raw SQL, then seeds from aggregated data.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("🔧 Creating wallet_rankings tables...\n");

// Create tables using raw SQL via Supabase REST API
const createSQL = `
-- wallet_rankings table
CREATE TABLE IF NOT EXISTS wallet_rankings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- RLS policies
ALTER TABLE wallet_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read wallet_rankings" ON wallet_rankings;
DROP POLICY IF EXISTS "Public read wallet_trades" ON wallet_trades;
DROP POLICY IF EXISTS "Service insert wallet_rankings" ON wallet_rankings;
DROP POLICY IF EXISTS "Service update wallet_rankings" ON wallet_rankings;
DROP POLICY IF EXISTS "Service insert wallet_trades" ON wallet_trades;

CREATE POLICY "Public read wallet_rankings" ON wallet_rankings FOR SELECT USING (true);
CREATE POLICY "Public read wallet_trades" ON wallet_trades FOR SELECT USING (true);
CREATE POLICY "Service insert wallet_rankings" ON wallet_rankings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update wallet_rankings" ON wallet_rankings FOR UPDATE USING (true);
CREATE POLICY "Service insert wallet_trades" ON wallet_trades FOR INSERT WITH CHECK (true);
`;

// Execute SQL via fetch to Supabase's SQL endpoint
try {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: createSQL }),
  });

  if (!response.ok) {
    console.log("⚠️  Direct SQL execution not available via RPC.");
    console.log("   Attempting table creation via client...\n");
    
    // Try to verify if tables exist
    const { error: testError } = await supabase
      .from("wallet_rankings")
      .select("id")
      .limit(1);
    
    if (testError && testError.message.includes("does not exist")) {
      console.error("❌ Tables don't exist. Please run this SQL in Supabase SQL Editor:");
      console.error("   https://supabase.com/dashboard/project/_/sql\n");
      console.error(createSQL);
      process.exit(1);
    }
  } else {
    console.log("✅ Tables created successfully\n");
  }
} catch (err) {
  console.log("⚠️  Skipping table creation (may already exist)\n");
}

// Verify tables exist
const { error: verifyError } = await supabase
  .from("wallet_rankings")
  .select("id")
  .limit(1);

if (verifyError) {
  console.error("❌ wallet_rankings table not found. Please create it manually:");
  console.error("   Run the SQL above in Supabase SQL Editor\n");
  process.exit(1);
}

console.log("✅ Tables verified\n");

// Now seed the data
console.log("📊 Seeding wallet rankings from aggregated data...\n");

const dataDir = resolve(import.meta.dirname, "kol-data");
const kolFile = resolve(dataDir, "aggregated-kols.json");

if (!existsSync(kolFile)) {
  console.error("❌ aggregated-kols.json not found");
  process.exit(1);
}

const raw = readFileSync(kolFile, "utf-8");
const entries = JSON.parse(raw);
console.log(`   Found ${entries.length} KOL entries\n`);

let totalUpserted = 0;
let totalErrors = 0;
const BATCH_SIZE = 50;

for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  const rankingRows = [];
  
  for (const entry of batch) {
    const wallet = entry.wallet;
    if (!wallet || wallet.length < 32) continue;
    
    const name = entry.name || entry.label || wallet.slice(0, 8) + "...";
    const twitter = entry.twitter || entry.twitter_handle || null;
    const avatar = entry.avatar || entry.avatar_url || null;
    const metrics = entry.metrics || {};
    
    const walletType = (entry.is_kol || entry.category === "kol") ? "kol" : "smart_money";
    
    const pnl1d = parseFloat(metrics.pnl_1d) || 0;
    const pnl7d = parseFloat(metrics.pnl_7d) || 0;
    const pnl30d = parseFloat(metrics.pnl_30d) || 0;
    const winrate7d = parseFloat(metrics.winrate_7d) || 0;
    const winrate30d = parseFloat(metrics.winrate_30d) || 0;
    const winrate = winrate7d || winrate30d || parseFloat(metrics.winrate) || 0;
    const totalTrades = parseInt(metrics.total_trades) || 0;
    const volumeSol = parseFloat(metrics.volume_sol) || 0;
    
    const avgVolume = volumeSol || 100;
    const pnl1dSol = pnl1d > 10 ? pnl1d : pnl1d * avgVolume;
    const pnl7dSol = pnl7d > 10 ? pnl7d : pnl7d * avgVolume;
    const pnl30dSol = pnl30d > 10 ? pnl30d : pnl30d * avgVolume;
    
    const SOL_PRICE = 150;
    const sourceCount = entry.source_count || (entry.sources || []).length || 1;
    const confidence = Math.min(sourceCount / 5, 1.0);
    
    const winrateScore = winrate * 40;
    const pnlScore = Math.min(Math.abs(pnl7dSol) / 10, 30);
    const sourceScore = sourceCount * 6;
    const overallScore = Math.min(winrateScore + pnlScore + sourceScore, 100);
    
    let tier = "standard";
    if (overallScore >= 80) tier = "legendary";
    else if (overallScore >= 65) tier = "elite";
    else if (overallScore >= 45) tier = "pro";
    else if (overallScore >= 25) tier = "rising";
    
    rankingRows.push({
      address: wallet,
      label: name,
      twitter_handle: twitter,
      avatar_url: avatar,
      wallet_type: walletType,
      tier: tier,
      categories: entry.tags || [],
      total_pnl_sol: pnl30dSol,
      total_pnl_usd: pnl30dSol * SOL_PRICE,
      win_rate: Math.round(winrate * 100 * 100) / 100,
      total_trades: totalTrades,
      pnl_1d_sol: pnl1dSol,
      pnl_7d_sol: pnl7dSol,
      pnl_30d_sol: pnl30dSol,
      pnl_1d_usd: pnl1dSol * SOL_PRICE,
      pnl_7d_usd: pnl7dSol * SOL_PRICE,
      pnl_30d_usd: pnl30dSol * SOL_PRICE,
      volume_7d_usd: volumeSol * SOL_PRICE,
      overall_score: Math.round(overallScore * 100) / 100,
      source: (entry.sources || [])[0] || "aggregated",
      confidence: Math.round(confidence * 100) / 100,
      is_verified: sourceCount >= 3,
      is_public: true,
    });
  }
  
  if (rankingRows.length > 0) {
    const { error } = await supabase
      .from("wallet_rankings")
      .upsert(rankingRows, { onConflict: "address" });
    
    if (error) {
      console.error(`   ❌ Batch error: ${error.message}`);
      totalErrors += rankingRows.length;
    } else {
      totalUpserted += rankingRows.length;
    }
  }
  
  const progress = Math.min(i + BATCH_SIZE, entries.length);
  process.stdout.write(`\r   Progress: ${progress}/${entries.length} (${totalUpserted} upserted, ${totalErrors} errors)`);
}

console.log("\n");

const { count } = await supabase
  .from("wallet_rankings")
  .select("id", { count: "exact", head: true });

console.log("✅ Seeding complete:");
console.log(`   Upserted: ${totalUpserted}`);
console.log(`   Errors:   ${totalErrors}`);
console.log(`   Total in DB: ${count}\n`);
