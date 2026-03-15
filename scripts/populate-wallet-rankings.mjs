/**
 * BLOODHOUND — Populate Wallet Rankings
 * Migrates existing known_wallets to the new ranking system
 * and calculates initial scores
 */

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

async function fetchKnownWallets() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/known_wallets?status=eq.approved&select=*`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  return res.json();
}

function mapCategoryToType(category) {
  const mapping = {
    'kol': 'kol',
    'profitable_trader': 'smart_money',
    'protocol_team': 'protocol',
    'exchange': 'protocol',
    'known_figure': 'kol',
    'suspected_bad_actor': 'suspicious',
  };
  return mapping[category] || 'smart_money';
}

function calculateInitialScore(wallet) {
  let score = 50; // Base score
  
  // Boost for having Twitter handle
  if (wallet.twitter_handle) score += 10;
  
  // Boost for high confidence
  score += (wallet.confidence || 0.5) * 20;
  
  // Category bonuses
  if (wallet.category === 'kol') score += 10;
  if (wallet.category === 'profitable_trader') score += 5;
  
  return Math.min(100, Math.max(0, score));
}

function determineTier(score) {
  if (score >= 90) return 'legendary';
  if (score >= 80) return 'elite';
  if (score >= 65) return 'pro';
  if (score >= 50) return 'rising';
  return 'standard';
}

async function populateRankings(wallets) {
  console.log(`[Rankings] Processing ${wallets.length} wallets...`);
  
  const rankings = wallets.map(w => {
    const score = calculateInitialScore(w);
    return {
      address: w.address,
      label: w.label,
      twitter_handle: w.twitter_handle,
      telegram_handle: w.telegram_handle,
      wallet_type: mapCategoryToType(w.category),
      tier: determineTier(score),
      overall_score: score,
      profitability_score: 50, // Will be updated with real data
      consistency_score: 50,
      timing_score: 50,
      confidence: w.confidence || 0.5,
      source: w.source || 'kolscan',
      is_verified: true,
      is_public: true,
      first_seen_at: w.created_at,
    };
  });
  
  // Batch upsert
  let success = 0;
  for (let i = 0; i < rankings.length; i += 50) {
    const batch = rankings.slice(i, i + 50);
    
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/wallet_rankings?on_conflict=address`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
      }
    );
    
    if (res.ok) {
      success += batch.length;
      console.log(`  Batch ${Math.floor(i/50)+1}: ${batch.length} synced`);
    } else {
      const err = await res.text();
      console.log(`  Batch ${Math.floor(i/50)+1} error: ${err.slice(0, 100)}`);
    }
  }
  
  return success;
}

async function getStats() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/wallet_rankings?select=wallet_type,tier`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  const data = await res.json();
  
  const byType = {};
  const byTier = {};
  
  for (const w of data) {
    byType[w.wallet_type] = (byType[w.wallet_type] || 0) + 1;
    byTier[w.tier] = (byTier[w.tier] || 0) + 1;
  }
  
  return { byType, byTier, total: data.length };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND WALLET RANKINGS POPULATION                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  // Fetch existing approved wallets
  console.log('\n[1/3] Fetching known wallets...');
  const wallets = await fetchKnownWallets();
  console.log(`  Found ${wallets.length} approved wallets`);
  
  // Populate rankings
  console.log('\n[2/3] Populating wallet rankings...');
  const synced = await populateRankings(wallets);
  console.log(`  Synced: ${synced}/${wallets.length}`);
  
  // Get stats
  console.log('\n[3/3] Getting stats...');
  const stats = await getStats();
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('WALLET RANKINGS SUMMARY');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`\nTotal Ranked Wallets: ${stats.total}`);
  console.log('\nBy Type:');
  for (const [type, count] of Object.entries(stats.byType).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${type.padEnd(15)} ${count}`);
  }
  console.log('\nBy Tier:');
  for (const [tier, count] of Object.entries(stats.byTier).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${tier.padEnd(15)} ${count}`);
  }
  console.log('\n══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
