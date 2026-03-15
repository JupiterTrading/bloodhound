/**
 * Merge Fomo + GMGN Wallet Data
 * Combines and deduplicates wallets from both sources
 * 
 * Usage: node merge_wallets.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'scraped_data');

/**
 * Load JSON file safely
 */
async function loadJSON(filename) {
  try {
    const filepath = path.join(DATA_DIR, filename);
    const raw = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`⚠️  Could not load ${filename}: ${error.message}`);
    return [];
  }
}

/**
 * Normalize wallet to common schema
 */
function normalizeWallet(wallet, source) {
  return {
    // Primary key
    solana_address: wallet.solana_address || wallet.address || null,
    evm_address: wallet.evm_address || null,
    
    // Identity
    label: wallet.label || wallet.display_name || wallet.twitter_name || wallet.name || null,
    twitter_handle: wallet.twitter_handle || null,
    telegram_handle: wallet.telegram_handle || null,
    avatar_url: wallet.avatar_url || null,
    bio: wallet.bio || wallet.twitter_bio || null,
    
    // Classification
    wallet_type: wallet.wallet_type || 'smart_money',
    tier: wallet.tier || 'standard',
    tags: wallet.tags || [],
    
    // Social
    followers: wallet.followers || 0,
    following: wallet.following || 0,
    
    // Trading stats
    total_trades: wallet.total_trades || wallet.total_trades_7d || 0,
    
    // PnL (USD)
    pnl_1d_usd: wallet.pnl_1d_usd || wallet.pnl_24h || 0,
    pnl_7d_usd: wallet.pnl_7d_usd || wallet.pnl_7d || 0,
    pnl_30d_usd: wallet.pnl_30d_usd || wallet.pnl_30d || 0,
    
    // Win rate
    winrate_7d: wallet.winrate_7d || null,
    
    // Volume
    volume_7d_usd: wallet.volume_7d_usd || wallet.total_volume_usd || 0,
    
    // Balance
    sol_balance: wallet.sol_balance || 0,
    
    // Timestamps
    last_active: wallet.last_active || null,
    scraped_at: wallet.scraped_at || new Date().toISOString(),
    
    // Source tracking
    source: source,
    sources: [source],
  };
}

/**
 * Merge two wallet records (prefer richer data)
 */
function mergeWallets(existing, incoming) {
  const merged = { ...existing };
  
  // Add source
  if (!merged.sources.includes(incoming.source)) {
    merged.sources.push(incoming.source);
  }
  merged.source = merged.sources.join('+');
  
  // Prefer non-null values
  const fields = [
    'label', 'twitter_handle', 'telegram_handle', 'avatar_url', 'bio',
    'evm_address', 'last_active'
  ];
  
  for (const field of fields) {
    if (!merged[field] && incoming[field]) {
      merged[field] = incoming[field];
    }
  }
  
  // Take higher values for metrics
  const maxFields = [
    'followers', 'following', 'total_trades',
    'pnl_1d_usd', 'pnl_7d_usd', 'pnl_30d_usd',
    'volume_7d_usd', 'sol_balance'
  ];
  
  for (const field of maxFields) {
    merged[field] = Math.max(merged[field] || 0, incoming[field] || 0);
  }
  
  // Merge tags
  const allTags = new Set([...(merged.tags || []), ...(incoming.tags || [])]);
  merged.tags = Array.from(allTags);
  
  // Prefer better tier
  const tierRank = { legendary: 5, elite: 4, pro: 3, rising: 2, standard: 1 };
  if ((tierRank[incoming.tier] || 0) > (tierRank[merged.tier] || 0)) {
    merged.tier = incoming.tier;
  }
  
  // Prefer KOL type if either has it
  const typeRank = { kol: 5, whale: 4, sniper: 3, smart_money: 2, fresh_wallet: 1 };
  if ((typeRank[incoming.wallet_type] || 0) > (typeRank[merged.wallet_type] || 0)) {
    merged.wallet_type = incoming.wallet_type;
  }
  
  // Take winrate if exists
  if (!merged.winrate_7d && incoming.winrate_7d) {
    merged.winrate_7d = incoming.winrate_7d;
  }
  
  return merged;
}

/**
 * Main merge function
 */
async function merge() {
  console.log('🔀 Wallet Data Merger\n');
  
  // Load all data sources
  const fomoWallets = await loadJSON('fomo_full_wallets.json');
  const gmgnWallets = await loadJSON('gmgn_wallets.json');
  
  console.log(`📂 Loaded:`);
  console.log(`  - Fomo: ${fomoWallets.length} wallets`);
  console.log(`  - GMGN: ${gmgnWallets.length} wallets`);
  
  // Create merged map keyed by Solana address
  const walletMap = new Map();
  
  // Process Fomo wallets
  for (const wallet of fomoWallets) {
    const normalized = normalizeWallet(wallet, 'fomo');
    if (normalized.solana_address) {
      walletMap.set(normalized.solana_address, normalized);
    }
  }
  
  console.log(`\n📊 After Fomo: ${walletMap.size} unique wallets`);
  
  // Process GMGN wallets (merge with existing)
  let merged = 0;
  let added = 0;
  
  for (const wallet of gmgnWallets) {
    const normalized = normalizeWallet(wallet, 'gmgn');
    if (!normalized.solana_address) continue;
    
    if (walletMap.has(normalized.solana_address)) {
      // Merge with existing
      const existing = walletMap.get(normalized.solana_address);
      walletMap.set(normalized.solana_address, mergeWallets(existing, normalized));
      merged++;
    } else {
      // Add new
      walletMap.set(normalized.solana_address, normalized);
      added++;
    }
  }
  
  console.log(`📊 GMGN: ${merged} merged, ${added} added`);
  console.log(`📦 Total unique wallets: ${walletMap.size}`);
  
  // Convert to array and sort by PnL
  const allWallets = Array.from(walletMap.values())
    .sort((a, b) => (b.pnl_7d_usd || 0) - (a.pnl_7d_usd || 0));
  
  // Stats
  const withTwitter = allWallets.filter(w => w.twitter_handle).length;
  const withEvm = allWallets.filter(w => w.evm_address).length;
  const kols = allWallets.filter(w => w.wallet_type === 'kol').length;
  const fromBoth = allWallets.filter(w => w.sources.length > 1).length;
  
  const byType = {};
  const byTier = {};
  
  for (const w of allWallets) {
    byType[w.wallet_type] = (byType[w.wallet_type] || 0) + 1;
    byTier[w.tier] = (byTier[w.tier] || 0) + 1;
  }
  
  console.log(`\n📊 Final Stats:`);
  console.log(`  - Total wallets: ${allWallets.length}`);
  console.log(`  - With Twitter: ${withTwitter}`);
  console.log(`  - With EVM address: ${withEvm}`);
  console.log(`  - KOLs: ${kols}`);
  console.log(`  - In both sources: ${fromBoth}`);
  
  console.log(`\n📊 By Type:`);
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${type}: ${count}`);
  }
  
  console.log(`\n📊 By Tier:`);
  for (const [tier, count] of Object.entries(byTier).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${tier}: ${count}`);
  }
  
  // Save merged data
  const mergedPath = path.join(DATA_DIR, 'merged_wallets.json');
  await fs.writeFile(mergedPath, JSON.stringify(allWallets, null, 2));
  console.log(`\n💾 Saved: ${mergedPath}`);
  
  // Save Twitter wallets only
  const twitterWallets = allWallets.filter(w => w.twitter_handle);
  const twitterPath = path.join(DATA_DIR, 'merged_twitter_wallets.json');
  await fs.writeFile(twitterPath, JSON.stringify(twitterWallets, null, 2));
  console.log(`💾 Twitter wallets: ${twitterPath}`);
  
  // CSV export
  const csvRows = [
    'solana_address,evm_address,label,twitter_handle,wallet_type,tier,pnl_7d_usd,winrate_7d,followers,sources'
  ];
  
  for (const w of allWallets) {
    csvRows.push([
      w.solana_address,
      w.evm_address || '',
      `"${(w.label || '').replace(/"/g, '""')}"`,
      w.twitter_handle || '',
      w.wallet_type,
      w.tier,
      (w.pnl_7d_usd || 0).toFixed(2),
      w.winrate_7d ? (w.winrate_7d * 100).toFixed(1) + '%' : '',
      w.followers || 0,
      w.sources.join('+'),
    ].join(','));
  }
  
  const csvPath = path.join(DATA_DIR, 'merged_wallets.csv');
  await fs.writeFile(csvPath, csvRows.join('\n'));
  console.log(`💾 CSV: ${csvPath}`);
  
  // Print top 20
  console.log('\n🏆 Top 20 Merged Wallets:\n');
  console.log('Rank | Label            | Twitter          | Type        | PnL 7d       | Sources');
  console.log('-----|------------------|------------------|-------------|--------------|--------');
  
  allWallets.slice(0, 20).forEach((w, i) => {
    const label = (w.label || '-').substring(0, 16).padEnd(16);
    const twitter = (w.twitter_handle || '-').substring(0, 16).padEnd(16);
    const type = w.wallet_type.padEnd(11);
    const pnl = `$${(w.pnl_7d_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(12);
    const sources = w.sources.join('+');
    console.log(`${(i + 1).toString().padStart(4)} | ${label} | ${twitter} | ${type} | ${pnl} | ${sources}`);
  });
  
  console.log('\n✅ Merge complete!');
  
  return allWallets;
}

// Run
merge().catch(console.error);
