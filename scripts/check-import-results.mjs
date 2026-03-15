#!/usr/bin/env node
/**
 * Check what was imported into the database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkImport() {
  console.log('🔍 Checking import results...\n');

  // Count total profiles
  const { count: totalProfiles } = await supabase
    .from('kol_profiles')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total Profiles: ${totalProfiles || 0}`);

  // Count by wallet_type (if column exists)
  const { data: byType } = await supabase
    .from('kol_profiles')
    .select('wallet_type')
    .limit(1000);

  if (byType && byType.length > 0) {
    const typeCounts = {};
    for (const row of byType) {
      const type = row.wallet_type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    console.log('\n📊 By Wallet Type:');
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`   ${type}: ${count}`);
    }
  }

  // Count total wallets
  const { count: totalWallets } = await supabase
    .from('kol_wallets')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total Wallets: ${totalWallets || 0}`);

  // Count profiles with Twitter
  const { count: withTwitter } = await supabase
    .from('kol_profiles')
    .select('*', { count: 'exact', head: true })
    .not('twitter_handle', 'is', null);

  console.log(`📊 Profiles with Twitter: ${withTwitter || 0}`);

  // Count multi-wallet profiles
  const { data: walletCounts } = await supabase
    .from('kol_wallets')
    .select('kol_profile_id');

  if (walletCounts) {
    const profileWalletCount = {};
    for (const row of walletCounts) {
      const pid = row.kol_profile_id;
      profileWalletCount[pid] = (profileWalletCount[pid] || 0) + 1;
    }
    const multiWallet = Object.values(profileWalletCount).filter(count => count > 1).length;
    console.log(`📊 Multi-wallet Profiles: ${multiWallet}`);
  }

  // Sample profiles
  const { data: samples } = await supabase
    .from('kol_profiles')
    .select('display_name, twitter_handle, wallet_type, total_pnl_usd, win_rate')
    .limit(10);

  console.log('\n📋 Sample Profiles:');
  if (samples) {
    for (const profile of samples) {
      console.log(`   ${profile.display_name} (@${profile.twitter_handle || 'none'}) - ${profile.wallet_type || 'kol'} - PnL: $${profile.total_pnl_usd?.toFixed(0) || 0} - WR: ${profile.win_rate?.toFixed(1) || 0}%`);
    }
  }
}

checkImport().catch(console.error);
