#!/usr/bin/env node
/**
 * BLOODHOUND — Complete Aggregated Data Import
 * 
 * Imports ALL collected wallet data from aggregated files:
 * - 54,770 total wallets
 * - 52,615 KOLs (Stalkchain, DexScreener, KolScan, Axiom, GMGN)
 * - 2,155 Smart Money wallets
 * 
 * Sources included:
 * - Stalkchain: 52,077 wallets
 * - DexScreener: 1,699 wallets
 * - KolScan: 480 wallets
 * - Axiom: 399 wallets
 * - GMGN: 373 wallets
 * 
 * Usage:
 *   node scripts/import-all-kol-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Use aggregated files for complete data
const AGGREGATED_FILE = './scripts/kol-data/aggregated-all-wallets.json';
const BATCH_SIZE = 100; // Process in batches for better performance

async function processBatch(batch, stats) {
  const profiles = [];
  const wallets = [];

  for (const entry of batch) {
    if (!entry.wallet) {
      stats.skipped++;
      continue;
    }

    // Determine display name
    const displayName = entry.name || entry.twitter || `Wallet ${entry.wallet.slice(0, 8)}`;
    
    // Skip completely anonymous wallets
    if (!entry.name && !entry.twitter && !entry.telegram && entry.category !== 'smart_money') {
      stats.skipped++;
      continue;
    }

    // Extract metrics from nested object
    const metrics = entry.metrics || {};
    const pnl30d = parseFloat(metrics.pnl_30d || 0);
    const winrate30d = parseFloat(metrics.winrate_30d || 0);
    
    // Create profile data
    const profile = {
      display_name: displayName,
      twitter_handle: entry.twitter || null,
      twitter_pfp_url: entry.avatar || null,
      telegram_handle: entry.telegram || null,
      source: (entry.sources && entry.sources[0]) || entry.source || 'aggregated',
      verified: false,
      total_pnl_usd: pnl30d * 100000, // Convert ROI to estimated USD (assuming $100k volume)
      win_rate: winrate30d * 100, // Convert decimal to percentage
      trade_count: parseInt(metrics.total_trades || 0),
    };

    profiles.push(profile);
    
    // Store wallet info for later
    wallets.push({
      address: entry.wallet,
      twitter: entry.twitter,
      source: entry.source,
    });
  }

  // Batch insert profiles
  if (profiles.length > 0) {
    const { data: insertedProfiles, error: profileError } = await supabase
      .from('kol_profiles')
      .upsert(profiles, {
        onConflict: 'twitter_handle',
        ignoreDuplicates: false,
      })
      .select('id, twitter_handle');

    if (profileError) {
      console.error(`  ❌ Batch profile error:`, profileError.message);
      stats.errors += profiles.length;
      return;
    }

    // Create profile map
    const profileMap = {};
    if (insertedProfiles) {
      for (const p of insertedProfiles) {
        profileMap[p.twitter_handle || p.id] = p.id;
      }
    }

    // Batch insert wallets
    const walletInserts = [];
    for (const w of wallets) {
      const profileId = profileMap[w.twitter] || profileMap[Object.keys(profileMap)[0]];
      if (profileId) {
        walletInserts.push({
          kol_profile_id: profileId,
          address: w.address,
          label: 'Main',
          is_primary: true,
          discovered_via: 'scraped',
          confidence: 1.0,
        });
      }
    }

    if (walletInserts.length > 0) {
      const { error: walletError } = await supabase
        .from('kol_wallets')
        .upsert(walletInserts, {
          onConflict: 'address',
          ignoreDuplicates: true,
        });

      if (walletError && !walletError.message.includes('duplicate')) {
        console.error(`  ❌ Batch wallet error:`, walletError.message);
        stats.errors += walletInserts.length;
      } else {
        stats.imported += walletInserts.length;
      }
    }
  }
}

async function main() {
  console.log('🐕 BLOODHOUND — Complete Aggregated Data Import\n');
  console.log('📊 Importing 54,770 wallets from all sources...\n');
  console.log('Sources: Stalkchain, DexScreener, KolScan, Axiom, GMGN, Fomo\n');

  const stats = {
    imported: 0,
    skipped: 0,
    errors: 0,
    total: 0,
  };

  try {
    console.log(`📂 Reading ${AGGREGATED_FILE}...`);
    const content = await fs.readFile(AGGREGATED_FILE, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      console.error('❌ Invalid format: expected array');
      process.exit(1);
    }

    stats.total = data.length;
    console.log(`✅ Loaded ${stats.total.toLocaleString()} wallets\n`);

    // Process in batches
    const batches = [];
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      batches.push(data.slice(i, i + BATCH_SIZE));
    }

    console.log(`🔄 Processing ${batches.length} batches of ${BATCH_SIZE} wallets...\n`);

    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], stats);
      
      if ((i + 1) % 10 === 0) {
        const progress = ((i + 1) / batches.length * 100).toFixed(1);
        console.log(`  ✅ Progress: ${progress}% (${stats.imported.toLocaleString()} imported, ${stats.skipped.toLocaleString()} skipped, ${stats.errors} errors)`);
      }
    }

    console.log('\n\n🎉 Import Complete!\n');
    console.log(`📊 Final Stats:`);
    console.log(`   Total Processed: ${stats.total.toLocaleString()}`);
    console.log(`   ✅ Imported: ${stats.imported.toLocaleString()}`);
    console.log(`   ⏭️  Skipped: ${stats.skipped.toLocaleString()}`);
    console.log(`   ❌ Errors: ${stats.errors}`);

  } catch (err) {
    console.error(`❌ Fatal error:`, err.message);
    process.exit(1);
  }
}

main().catch(console.error);
