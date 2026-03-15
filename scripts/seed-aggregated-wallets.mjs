import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🚀 Starting database seeding...\n');

// Load aggregated data
const dataPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\aggregated-all-wallets.json';
const wallets = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`📊 Loaded ${wallets.length} wallets`);

// Filter to high-quality wallets for initial seed
// Priority: Multi-source wallets, wallets with Twitter, wallets with metrics
const highQualityWallets = wallets.filter(w => 
  w.source_count > 1 || 
  w.twitter || 
  w.name ||
  (w.metrics.pnl_30d && w.metrics.pnl_30d > 0)
);

console.log(`📋 Filtered to ${highQualityWallets.length} high-quality wallets for seeding`);

// Prepare wallet_rankings records
const walletRankings = highQualityWallets.map(w => ({
  address: w.wallet,
  label: w.name || null,
  twitter_handle: w.twitter || null,
  telegram_handle: w.telegram || null,
  wallet_type: w.category,
  tier: determineTier(w),
  pnl_30d: w.metrics.pnl_30d || w.metrics.pnl_sol || null,
  win_rate: w.metrics.winrate_30d || w.metrics.winrate || null,
  total_trades: w.metrics.total_trades || null,
  volume_30d: w.metrics.volume_sol || null,
  followers_count: w.metrics.followers || null,
  source: w.sources.join(','),
  tags: w.tags.length > 0 ? w.tags : null,
  confidence_score: calculateConfidence(w),
  last_updated: new Date().toISOString(),
}));

function determineTier(wallet) {
  const pnl = wallet.metrics.pnl_30d || wallet.metrics.pnl_sol || 0;
  const winrate = wallet.metrics.winrate_30d || wallet.metrics.winrate || 0;
  const sourceCount = wallet.source_count;
  
  // S-tier: Multi-source + high performance
  if (sourceCount >= 3 && pnl > 1000 && winrate > 0.7) return 'S';
  if (sourceCount >= 2 && pnl > 500 && winrate > 0.65) return 'A';
  if (pnl > 100 && winrate > 0.6) return 'B';
  if (pnl > 10 || winrate > 0.5) return 'C';
  return 'D';
}

function calculateConfidence(wallet) {
  let score = 0;
  
  // Source count (max 50 points)
  score += Math.min(wallet.source_count * 15, 50);
  
  // Has identity (20 points)
  if (wallet.twitter) score += 15;
  if (wallet.name) score += 5;
  
  // Has metrics (20 points)
  if (wallet.metrics.pnl_30d || wallet.metrics.pnl_sol) score += 10;
  if (wallet.metrics.winrate) score += 10;
  
  // Has tags (10 points)
  if (wallet.tags.length > 0) score += 10;
  
  return Math.min(score, 100) / 100; // Normalize to 0-1
}

console.log('\n📤 Inserting wallets into database...');

// Insert in batches of 100
const BATCH_SIZE = 100;
let inserted = 0;
let updated = 0;
let errors = 0;

for (let i = 0; i < walletRankings.length; i += BATCH_SIZE) {
  const batch = walletRankings.slice(i, i + BATCH_SIZE);
  
  try {
    const { data, error } = await supabase
      .from('wallet_rankings')
      .upsert(batch, { 
        onConflict: 'address',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      const count = data?.length || batch.length;
      inserted += count;
      console.log(`   ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} wallets`);
    }
  } catch (err) {
    console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} exception:`, err.message);
    errors += batch.length;
  }
  
  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('\n✅ Database seeding complete!');
console.log(`   Inserted/Updated: ${inserted}`);
console.log(`   Errors: ${errors}`);

// Generate summary
const summary = {
  total_wallets: wallets.length,
  high_quality_wallets: highQualityWallets.length,
  seeded_wallets: inserted,
  errors: errors,
  by_tier: {},
  by_category: {},
  seeded_at: new Date().toISOString()
};

// Count by tier and category
for (const w of walletRankings) {
  summary.by_tier[w.tier] = (summary.by_tier[w.tier] || 0) + 1;
  summary.by_category[w.wallet_type] = (summary.by_category[w.wallet_type] || 0) + 1;
}

fs.writeFileSync(
  'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\seeding-summary.json',
  JSON.stringify(summary, null, 2)
);

console.log('\n📊 Summary saved to seeding-summary.json');
console.log('\n🎉 All done!');
