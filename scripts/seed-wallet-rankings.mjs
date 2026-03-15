#!/usr/bin/env node
/**
 * BLOODHOUND — Seed wallet_rankings from aggregated KOL/smart money data.
 * 
 * Reads aggregated-kols.json and aggregated-smart-money.json,
 * upserts into Supabase wallet_rankings table.
 * Also ensures kol_profiles + kol_wallets are populated.
 * 
 * Usage:
 *   node scripts/seed-wallet-rankings.mjs
 *   node scripts/seed-wallet-rankings.mjs --file ./scripts/kol-data/aggregated-kols.json
 *   node scripts/seed-wallet-rankings.mjs --smart-money
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
    // Strip inline comments (but not inside values)
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

// Parse CLI args
const args = process.argv.slice(2);
const fileArg = args.find((a, i) => args[i - 1] === "--file") || null;
const smartMoneyOnly = args.includes("--smart-money");

// Determine files to process
const dataDir = resolve(import.meta.dirname, "kol-data");
const files = [];

if (fileArg) {
  files.push({ path: resolve(fileArg), type: "custom" });
} else {
  const kolFile = resolve(dataDir, "aggregated-kols.json");
  const smFile = resolve(dataDir, "aggregated-smart-money.json");
  
  if (!smartMoneyOnly && existsSync(kolFile)) {
    files.push({ path: kolFile, type: "kol" });
  }
  if (existsSync(smFile)) {
    files.push({ path: smFile, type: "smart_money" });
  }
}

if (files.length === 0) {
  console.error("No data files found. Run aggregation scripts first.");
  process.exit(1);
}

let totalUpserted = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const { path: filePath, type } of files) {
  console.log(`\n📊 Processing: ${filePath} (type: ${type})`);
  
  const raw = readFileSync(filePath, "utf-8");
  const entries = JSON.parse(raw);
  console.log(`   Found ${entries.length} entries`);
  
  // Process in batches of 50
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const rankingRows = [];
    const profileRows = [];
    const walletRows = [];
    
    for (const entry of batch) {
      const wallet = entry.wallet;
      if (!wallet || wallet.length < 32) continue;
      
      const name = entry.name || entry.label || wallet.slice(0, 8) + "...";
      const twitter = entry.twitter || entry.twitter_handle || null;
      const avatar = entry.avatar || entry.avatar_url || null;
      const metrics = entry.metrics || {};
      
      // Determine wallet type
      let walletType = "smart_money";
      if (entry.is_kol || entry.category === "kol" || type === "kol") {
        walletType = "kol";
      }
      
      // Parse PnL metrics (some are strings representing ratios, some are SOL values)
      const pnl1d = parseFloat(metrics.pnl_1d) || 0;
      const pnl7d = parseFloat(metrics.pnl_7d) || 0;
      const pnl30d = parseFloat(metrics.pnl_30d) || 0;
      const winrate7d = parseFloat(metrics.winrate_7d) || 0;
      const winrate30d = parseFloat(metrics.winrate_30d) || 0;
      const winrate = winrate7d || winrate30d || parseFloat(metrics.winrate) || 0;
      const totalTrades = parseInt(metrics.total_trades) || 0;
      const volumeSol = parseFloat(metrics.volume_sol) || 0;
      
      // Convert PnL ratios to approximate SOL values (multiply by avg volume)
      // The pnl values from axiom/gmgn are often ratios (0.34 = 34% gain)
      const avgVolume = volumeSol || 100; // default assumption
      const pnl1dSol = pnl1d > 10 ? pnl1d : pnl1d * avgVolume;
      const pnl7dSol = pnl7d > 10 ? pnl7d : pnl7d * avgVolume;
      const pnl30dSol = pnl30d > 10 ? pnl30d : pnl30d * avgVolume;
      
      // SOL price approximation for USD conversion
      const SOL_PRICE = 150;
      
      // Calculate confidence from source count
      const sourceCount = entry.source_count || (entry.sources || []).length || 1;
      const confidence = Math.min(sourceCount / 5, 1.0);
      
      // Calculate overall score (0-100)
      const winrateScore = winrate * 40; // max 40 points
      const pnlScore = Math.min(Math.abs(pnl7dSol) / 10, 30); // max 30 points
      const sourceScore = sourceCount * 6; // max 30 points
      const overallScore = Math.min(winrateScore + pnlScore + sourceScore, 100);
      
      // Determine tier
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
        win_rate: Math.round(winrate * 100 * 100) / 100, // convert to percentage
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
      
      // Also ensure kol_profiles exists (for the rankings page fallback)
      if (walletType === "kol" && twitter) {
        profileRows.push({
          display_name: name,
          twitter_handle: twitter.toLowerCase().replace("@", ""),
          twitter_pfp_url: avatar,
          wallet_type: walletType,
          source: (entry.sources || [])[0] || "aggregated",
          verified: sourceCount >= 3,
          total_pnl_usd: pnl30dSol * SOL_PRICE,
          win_rate: Math.round(winrate * 100 * 100) / 100,
          trade_count: totalTrades,
        });
        
        walletRows.push({
          address: wallet,
          twitter_handle: twitter.toLowerCase().replace("@", ""),
          label: "Main",
          is_primary: true,
          discovered_via: "scraped",
          confidence: confidence,
        });
      }
    }
    
    // Upsert wallet_rankings
    if (rankingRows.length > 0) {
      const { error } = await supabase
        .from("wallet_rankings")
        .upsert(rankingRows, { onConflict: "address" });
      
      if (error) {
        console.error(`   ❌ wallet_rankings batch error: ${error.message}`);
        totalErrors += rankingRows.length;
      } else {
        totalUpserted += rankingRows.length;
      }
    }
    
    // Upsert kol_profiles (skip duplicates)
    for (const profile of profileRows) {
      const { error } = await supabase
        .from("kol_profiles")
        .upsert(profile, { onConflict: "twitter_handle", ignoreDuplicates: true });
      
      if (error && !error.message.includes("duplicate")) {
        // Ignore duplicate errors silently
      }
    }
    
    // Link wallets to profiles
    for (const walletRow of walletRows) {
      // Find the profile ID
      const { data: profile } = await supabase
        .from("kol_profiles")
        .select("id")
        .eq("twitter_handle", walletRow.twitter_handle)
        .single();
      
      if (profile) {
        const { error } = await supabase
          .from("kol_wallets")
          .upsert({
            kol_profile_id: profile.id,
            address: walletRow.address,
            label: walletRow.label,
            is_primary: walletRow.is_primary,
            discovered_via: walletRow.discovered_via,
            confidence: walletRow.confidence,
          }, { onConflict: "address", ignoreDuplicates: true });
        
        if (error && !error.message.includes("duplicate")) {
          // Ignore duplicate errors silently
        }
      }
    }
    
    // Progress
    const progress = Math.min(i + BATCH_SIZE, entries.length);
    process.stdout.write(`\r   Processed ${progress}/${entries.length} (${totalUpserted} upserted, ${totalErrors} errors)`);
  }
  
  console.log(""); // newline after progress
}

console.log(`\n✅ Seeding complete:`);
console.log(`   Upserted: ${totalUpserted}`);
console.log(`   Skipped:  ${totalSkipped}`);
console.log(`   Errors:   ${totalErrors}`);

// Verify
const { count } = await supabase
  .from("wallet_rankings")
  .select("id", { count: "exact", head: true });
console.log(`   Total wallet_rankings rows: ${count}`);

const { count: kolCount } = await supabase
  .from("kol_profiles")
  .select("id", { count: "exact", head: true });
console.log(`   Total kol_profiles rows: ${kolCount}`);
