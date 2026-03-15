/**
 * Seed Fomo Wallets into Supabase wallet_rankings table
 * 
 * Usage: node seed-fomo-wallets.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Map Fomo wallet type to Bloodhound wallet_type enum
 */
function mapWalletType(fomoType) {
  const mapping = {
    'kol': 'kol',
    'smart_money': 'smart_money',
    'market_maker': 'market_maker',
    'whale': 'whale',
  };
  return mapping[fomoType] || 'smart_money';
}

/**
 * Map Fomo tier to Bloodhound wallet_tier enum
 */
function mapTier(fomoTier) {
  const mapping = {
    'legendary': 'legendary',
    'elite': 'elite',
    'pro': 'pro',
    'rising': 'rising',
    'standard': 'standard',
  };
  return mapping[fomoTier] || 'standard';
}

/**
 * Transform Fomo wallet to Supabase wallet_rankings row
 */
function transformForSupabase(wallet) {
  return {
    address: wallet.solana_address,
    
    // Identity
    label: wallet.display_name || wallet.fomo_handle,
    twitter_handle: wallet.twitter_handle,
    telegram_handle: wallet.telegram_handle,
    avatar_url: wallet.avatar_url,
    bio: wallet.bio,
    
    // Classification
    wallet_type: mapWalletType(wallet.wallet_type),
    tier: mapTier(wallet.tier),
    categories: ['fomo_trader'],
    
    // Performance (USD values from Fomo)
    pnl_1d_usd: wallet.pnl_24h || 0,
    total_trades: wallet.total_trades || 0,
    
    // Volume
    volume_30d_usd: wallet.total_volume_usd || 0,
    
    // Social
    followers_count: wallet.followers || 0,
    
    // Scores (estimate based on available data)
    overall_score: calculateScore(wallet),
    
    // Metadata
    source: 'fomo',
    confidence: 0.85,  // High confidence - verified Fomo users
    is_verified: wallet.followers > 1000,  // Auto-verify popular traders
    is_public: !wallet.is_private,
    
    // Timestamps
    first_seen_at: wallet.account_created,
    last_active_at: new Date().toISOString(),
  };
}

/**
 * Calculate overall score (0-100)
 */
function calculateScore(wallet) {
  let score = 50; // Base score
  
  // PnL bonus (up to +30)
  const pnl = wallet.pnl_24h || 0;
  if (pnl > 50000) score += 30;
  else if (pnl > 20000) score += 25;
  else if (pnl > 10000) score += 20;
  else if (pnl > 5000) score += 15;
  else if (pnl > 1000) score += 10;
  else if (pnl > 0) score += 5;
  
  // Followers bonus (up to +15)
  const followers = wallet.followers || 0;
  if (followers > 50000) score += 15;
  else if (followers > 10000) score += 12;
  else if (followers > 5000) score += 10;
  else if (followers > 1000) score += 7;
  else if (followers > 100) score += 3;
  
  // Trade activity bonus (up to +5)
  const trades = wallet.total_trades || 0;
  if (trades > 500) score += 5;
  else if (trades > 100) score += 3;
  else if (trades > 20) score += 1;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Seed wallets in batches
 */
async function seedWallets() {
  console.log('🌱 Fomo Wallet Seeder for Supabase\n');
  
  // Load scraped data
  const dataPath = path.join(__dirname, 'scraped_data', 'fomo_full_wallets.json');
  
  let wallets;
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    wallets = JSON.parse(raw);
    console.log(`📂 Loaded ${wallets.length} wallets from ${dataPath}\n`);
  } catch (error) {
    console.error(`❌ Could not load wallet data: ${error.message}`);
    console.error('Run fomo_full_scraper.mjs first!');
    process.exit(1);
  }
  
  // Filter out wallets without valid Solana addresses
  const validWallets = wallets.filter(w => 
    w.solana_address && 
    w.solana_address.length >= 32 &&
    w.solana_address.length <= 44
  );
  
  console.log(`✓ ${validWallets.length} wallets have valid Solana addresses\n`);
  
  // Transform for Supabase
  const rows = validWallets.map(transformForSupabase);
  
  // Seed in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('wallet_rankings')
      .upsert(batch, {
        onConflict: 'address',
        ignoreDuplicates: false,
      })
      .select('address');
    
    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      const count = data?.length || 0;
      inserted += count;
      process.stdout.write(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${inserted} total)\r`);
    }
  }
  
  console.log('\n');
  console.log('=' .repeat(50));
  console.log('📊 Seed Results:');
  console.log(`  ✓ Inserted/Updated: ${inserted}`);
  console.log(`  ✗ Errors: ${errors}`);
  console.log('=' .repeat(50));
  
  // Stats query
  const { data: stats } = await supabase
    .from('wallet_rankings')
    .select('wallet_type, tier')
    .eq('source', 'fomo');
  
  if (stats) {
    const byType = {};
    const byTier = {};
    
    for (const row of stats) {
      byType[row.wallet_type] = (byType[row.wallet_type] || 0) + 1;
      byTier[row.tier] = (byTier[row.tier] || 0) + 1;
    }
    
    console.log('\n📈 Fomo Wallets in Database:');
    console.log('\nBy Type:');
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('\nBy Tier:');
    for (const [tier, count] of Object.entries(byTier)) {
      console.log(`  ${tier}: ${count}`);
    }
  }
  
  console.log('\n✅ Seed complete!');
}

// Run
seedWallets().catch(console.error);
