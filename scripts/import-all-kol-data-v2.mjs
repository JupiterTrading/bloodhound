#!/usr/bin/env node
/**
 * BLOODHOUND — Intelligent KOL & Smart Money Import (v2)
 * 
 * Features:
 * - Separates KOLs from Smart Money wallets
 * - Deduplicates profiles by Twitter handle and wallet address
 * - Groups multiple wallets under single profile
 * - Validates data consistency
 * - Imports as seed data (real calculations happen from ClickHouse)
 * 
 * Usage:
 *   node scripts/import-all-kol-data-v2.mjs
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

const AGGREGATED_FILE = './scripts/kol-data/aggregated-all-wallets.json';

// Track profiles by Twitter handle to deduplicate
const profilesByTwitter = new Map();
const profilesByWallet = new Map();
const walletAddresses = new Set();

function validateWallet(address) {
  // Basic Solana address validation (32-44 chars, base58)
  return address && address.length >= 32 && address.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

function validateMetrics(metrics) {
  const winrate = parseFloat(metrics.winrate_30d || 0);
  const pnl = parseFloat(metrics.pnl_30d || 0);
  
  // Validate win rate is between 0 and 1
  if (winrate < 0 || winrate > 1) return false;
  
  // Validate PnL is reasonable (not absurdly high)
  if (Math.abs(pnl) > 1000) return false; // ROI > 100,000% is suspicious
  
  return true;
}

function processEntry(entry, stats) {
  // Validate wallet address
  if (!validateWallet(entry.wallet)) {
    stats.invalid++;
    return null;
  }

  // Check for duplicate wallet
  if (walletAddresses.has(entry.wallet)) {
    stats.duplicateWallets++;
    return null;
  }

  // Determine wallet type
  const walletType = entry.category === 'smart_money' ? 'smart_money' : 'kol';
  
  // Skip anonymous wallets unless they're smart money
  if (!entry.name && !entry.twitter && !entry.telegram && walletType !== 'smart_money') {
    stats.anonymous++;
    return null;
  }

  // Extract and validate metrics
  const metrics = entry.metrics || {};
  if (!validateMetrics(metrics)) {
    stats.invalidMetrics++;
    return null;
  }

  const displayName = entry.name || entry.twitter || `Wallet ${entry.wallet.slice(0, 8)}`;
  const twitterHandle = entry.twitter ? entry.twitter.toLowerCase().replace('@', '') : null;
  
  // Check if profile exists by Twitter handle
  let profileKey = twitterHandle || entry.wallet;
  
  if (twitterHandle && profilesByTwitter.has(twitterHandle)) {
    // Add wallet to existing profile
    const existingProfile = profilesByTwitter.get(twitterHandle);
    existingProfile.wallets.push({
      address: entry.wallet,
      sources: entry.sources || [entry.source],
      is_primary: existingProfile.wallets.length === 0,
    });
    walletAddresses.add(entry.wallet);
    stats.walletsAddedToExisting++;
    return null;
  }

  // Create new profile
  const profile = {
    display_name: displayName,
    twitter_handle: twitterHandle,
    twitter_pfp_url: entry.avatar || null,
    telegram_handle: entry.telegram || null,
    wallet_type: walletType,
    source: (entry.sources && entry.sources[0]) || entry.source || 'aggregated',
    verified: false,
    // Seed data - will be recalculated from actual trades
    total_pnl_usd: parseFloat(metrics.pnl_30d || 0) * 100000, // Estimate based on ROI
    win_rate: parseFloat(metrics.winrate_30d || 0) * 100,
    trade_count: 0, // Will be calculated from ClickHouse
    wallets: [{
      address: entry.wallet,
      sources: entry.sources || [entry.source],
      is_primary: true,
    }],
  };

  if (twitterHandle) {
    profilesByTwitter.set(twitterHandle, profile);
  }
  profilesByWallet.set(entry.wallet, profile);
  walletAddresses.add(entry.wallet);

  return profile;
}

async function insertProfiles(profiles, stats) {
  console.log(`\n💾 Inserting ${profiles.length} profiles into database...`);
  
  const batchSize = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    
    try {
      // Insert profiles
      const profileInserts = batch.map(p => ({
        display_name: p.display_name,
        twitter_handle: p.twitter_handle,
        twitter_pfp_url: p.twitter_pfp_url,
        telegram_handle: p.telegram_handle,
        wallet_type: p.wallet_type,
        source: p.source,
        verified: p.verified,
        total_pnl_usd: p.total_pnl_usd,
        win_rate: p.win_rate,
        trade_count: p.trade_count,
      }));

      const { data: insertedProfiles, error: profileError } = await supabase
        .from('kol_profiles')
        .upsert(profileInserts, {
          onConflict: 'twitter_handle',
          ignoreDuplicates: false,
        })
        .select('id, twitter_handle, display_name');

      if (profileError) {
        console.error(`  ❌ Profile batch error:`, profileError.message);
        errors += batch.length;
        continue;
      }

      // Map profiles to IDs
      const profileIdMap = new Map();
      if (insertedProfiles) {
        for (const p of insertedProfiles) {
          profileIdMap.set(p.twitter_handle || p.display_name, p.id);
        }
      }

      // Insert wallets
      const walletInserts = [];
      for (const profile of batch) {
        const profileId = profileIdMap.get(profile.twitter_handle || profile.display_name);
        if (profileId) {
          for (const wallet of profile.wallets) {
            walletInserts.push({
              kol_profile_id: profileId,
              address: wallet.address,
              label: wallet.is_primary ? 'Main' : 'Secondary',
              is_primary: wallet.is_primary,
              discovered_via: 'scraped',
              confidence: 1.0,
            });
          }
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
          console.error(`  ❌ Wallet batch error:`, walletError.message);
          errors += walletInserts.length;
        } else {
          inserted += batch.length;
        }
      }

      if ((i + batchSize) % 500 === 0) {
        console.log(`  ✅ Inserted ${inserted} profiles...`);
      }

    } catch (err) {
      console.error(`  ❌ Batch error:`, err.message);
      errors += batch.length;
    }
  }

  stats.inserted = inserted;
  stats.errors = errors;
}

async function main() {
  console.log('🐕 BLOODHOUND — Intelligent Data Import v2\n');
  console.log('Features:');
  console.log('  ✅ KOL vs Smart Money separation');
  console.log('  ✅ Deduplication by Twitter handle');
  console.log('  ✅ Multi-wallet profile grouping');
  console.log('  ✅ Data validation\n');

  const stats = {
    total: 0,
    processed: 0,
    invalid: 0,
    duplicateWallets: 0,
    anonymous: 0,
    invalidMetrics: 0,
    walletsAddedToExisting: 0,
    inserted: 0,
    errors: 0,
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

    console.log('🔄 Processing and deduplicating...\n');

    // Process all entries
    for (const entry of data) {
      processEntry(entry, stats);
      stats.processed++;

      if (stats.processed % 5000 === 0) {
        console.log(`  📊 Processed ${stats.processed.toLocaleString()}/${stats.total.toLocaleString()} wallets...`);
      }
    }

    // Get unique profiles
    const uniqueProfiles = Array.from(new Set([
      ...profilesByTwitter.values(),
      ...profilesByWallet.values()
    ]));

    console.log(`\n📊 Deduplication Results:`);
    console.log(`   Total Wallets: ${stats.total.toLocaleString()}`);
    console.log(`   Unique Profiles: ${uniqueProfiles.length.toLocaleString()}`);
    console.log(`   Multi-wallet Profiles: ${uniqueProfiles.filter(p => p.wallets.length > 1).length.toLocaleString()}`);
    console.log(`   KOLs: ${uniqueProfiles.filter(p => p.wallet_type === 'kol').length.toLocaleString()}`);
    console.log(`   Smart Money: ${uniqueProfiles.filter(p => p.wallet_type === 'smart_money').length.toLocaleString()}`);
    console.log(`\n📊 Validation Results:`);
    console.log(`   ❌ Invalid Addresses: ${stats.invalid.toLocaleString()}`);
    console.log(`   ❌ Duplicate Wallets: ${stats.duplicateWallets.toLocaleString()}`);
    console.log(`   ⏭️  Anonymous Wallets: ${stats.anonymous.toLocaleString()}`);
    console.log(`   ❌ Invalid Metrics: ${stats.invalidMetrics.toLocaleString()}`);

    // Insert into database
    await insertProfiles(uniqueProfiles, stats);

    console.log('\n\n🎉 Import Complete!\n');
    console.log(`📊 Final Stats:`);
    console.log(`   ✅ Profiles Inserted: ${stats.inserted.toLocaleString()}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log(`\n⚠️  NOTE: PnL values are SEED DATA only.`);
    console.log(`   Real rankings will be calculated from ClickHouse wallet trades.`);

  } catch (err) {
    console.error(`❌ Fatal error:`, err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main().catch(console.error);
