import { parseHAR, createStandardRecord, validateSolanaAddress } from './parse-har-template.mjs';

/**
 * Axiom HAR Parser
 * Extracts KOL and global wallet data from Axiom API responses
 */

function normalizeAxiomData(responses) {
  const wallets = [];
  
  for (const { url, data } of responses) {
    // Handle different Axiom API response structures
    if (url.includes('/kols/leaderboard') || url.includes('/kol/')) {
      wallets.push(...extractKOLData(data));
    } else if (url.includes('/wallets/global') || url.includes('/wallet/')) {
      wallets.push(...extractGlobalWalletData(data));
    }
  }
  
  // Deduplicate by wallet address
  const seen = new Set();
  return wallets.filter(w => {
    if (!w.solana_address || seen.has(w.solana_address)) return false;
    seen.add(w.solana_address);
    return true;
  });
}

function extractKOLData(data) {
  const wallets = [];
  
  // Handle array response (leaderboard)
  const items = Array.isArray(data) ? data : 
                data.data ? (Array.isArray(data.data) ? data.data : [data.data]) :
                data.kols ? data.kols : 
                [data];
  
  for (const item of items) {
    // Skip if no valid wallet address
    const address = item.wallet_address || item.address || item.wallet || item.pubkey;
    if (!address || !validateSolanaAddress(address)) {
      console.warn(`⚠️  Skipping item with invalid/missing address:`, item.name || 'unknown');
      continue;
    }
    
    const record = createStandardRecord({
      solana_address: address,
      evm_address: item.evm_address || item.eth_address,
      display_name: item.name || item.username || item.handle,
      twitter_handle: item.twitter || item.twitter_handle || item.twitter_username,
      telegram_handle: item.telegram || item.telegram_handle,
      avatar_url: item.avatar || item.avatar_url || item.profile_image,
      bio: item.bio || item.description,
      pnl_24h_usd: item.pnl_24h || item.pnl_1d || item.pnl,
      pnl_7d_usd: item.pnl_7d || item.pnl_week,
      pnl_30d_usd: item.pnl_30d || item.pnl_month,
      win_rate: item.win_rate || item.winrate || item.win_percentage,
      total_trades: item.total_trades || item.trades || item.trade_count,
      total_volume_usd: item.volume || item.total_volume || item.volume_usd,
      followers_count: item.followers || item.follower_count,
      following_count: item.following || item.following_count,
      tier: determineTier(item),
      wallet_type: 'kol',
      is_verified: item.is_verified || item.verified || false,
      raw_data: item
    });
    
    wallets.push(record);
  }
  
  return wallets;
}

function extractGlobalWalletData(data) {
  const wallets = [];
  
  // Handle array response (global leaderboard)
  const items = Array.isArray(data) ? data : 
                data.data ? (Array.isArray(data.data) ? data.data : [data.data]) :
                data.wallets ? data.wallets : 
                [data];
  
  for (const item of items) {
    const address = item.wallet_address || item.address || item.wallet || item.pubkey;
    if (!address || !validateSolanaAddress(address)) {
      console.warn(`⚠️  Skipping global wallet with invalid/missing address`);
      continue;
    }
    
    const record = createStandardRecord({
      solana_address: address,
      evm_address: item.evm_address || item.eth_address,
      display_name: item.name || item.label || null,
      twitter_handle: item.twitter || item.twitter_handle,
      telegram_handle: item.telegram || item.telegram_handle,
      avatar_url: item.avatar || item.avatar_url,
      bio: item.bio,
      pnl_24h_usd: item.pnl_24h || item.pnl_1d || item.pnl,
      pnl_7d_usd: item.pnl_7d || item.pnl_week,
      pnl_30d_usd: item.pnl_30d || item.pnl_month,
      win_rate: item.win_rate || item.winrate,
      total_trades: item.total_trades || item.trades,
      total_volume_usd: item.volume || item.total_volume,
      followers_count: item.followers,
      following_count: item.following,
      tier: determineTier(item),
      wallet_type: item.name ? 'kol' : 'smart_money', // Named = KOL, unnamed = smart money
      is_verified: item.is_verified || false,
      raw_data: item
    });
    
    wallets.push(record);
  }
  
  return wallets;
}

function determineTier(item) {
  const pnl = item.pnl_24h || item.pnl_1d || item.pnl || 0;
  const winRate = item.win_rate || item.winrate || 0;
  
  // Tier based on performance
  if (pnl > 50000 && winRate > 70) return 'legendary';
  if (pnl > 20000 && winRate > 60) return 'elite';
  if (pnl > 5000 && winRate > 50) return 'pro';
  if (pnl > 1000 || winRate > 40) return 'rising';
  return 'standard';
}

/**
 * Main export function
 */
export async function parseAxiomHAR(harPath, outputPath) {
  const config = {
    sourceName: 'axiom',
    apiPattern: /axiom.*\/(kol|wallet|global)/i,
    normalizer: normalizeAxiomData,
    outputPath
  };
  
  return await parseHAR(harPath, config);
}

// CLI usage
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const harPath = process.argv[2];
  const outputPath = process.argv[3] || './scripts/kol-data/parsed/axiom-complete.json';
  
  if (!harPath) {
    console.error('Usage: node parse-axiom-har.mjs <har-file> [output-file]');
    process.exit(1);
  }
  
  parseAxiomHAR(harPath, outputPath)
    .then(() => console.log('\n✅ Done!'))
    .catch(err => {
      console.error('\n❌ Error:', err);
      process.exit(1);
    });
}
