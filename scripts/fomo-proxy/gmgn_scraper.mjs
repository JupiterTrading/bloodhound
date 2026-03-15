/**
 * GMGN Wallet Scraper
 * Pulls smart money wallet rankings from GMGN API
 * 
 * Usage: node gmgn_scraper.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GMGN API - extracted from proxy capture
const GMGN_API = 'https://gmgn.gracematrix.net';

// Device/client params from captured request
const DEFAULT_PARAMS = {
  device_id: '724039AA-A424-4805-8706-9F47ABC12322',
  client_id: 'memetracker_ios_2030304',
  from_app: 'memetracker',
  app_ver: '2030304',
  pkg: 'io.gracematrix.gmgn',
  app_lang: 'en',
  sys_lang: 'en-US',
  brand: 'Apple',
  model: 'iPhone',
  os: 'ios',
  os_api: '26.2.1',
  tz_name: 'America/Chicago',
  tz_offset: '300',
};

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'GMGN/2030304 CFNetwork/3860.300.31 Darwin/25.2.0',
};

// Rate limiting
const DELAY_MS = 500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Build URL with params
 */
function buildUrl(endpoint, extraParams = {}) {
  const params = new URLSearchParams({ ...DEFAULT_PARAMS, ...extraParams });
  return `${GMGN_API}${endpoint}?${params}`;
}

/**
 * Fetch with retry
 */
async function fetchAPI(endpoint, extraParams = {}) {
  const url = buildUrl(endpoint, extraParams);
  
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      
      if (response.status === 429) {
        console.log('  ⏳ Rate limited, waiting 10s...');
        await sleep(10000);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`API error: ${data.msg}`);
      }
      
      return data.data;
    } catch (error) {
      if (i === 2) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}

/**
 * Fetch wallet rankings
 * @param {string} period - '1d', '7d', '30d'
 * @param {string} orderby - 'pnl_7d', 'winrate', 'realized_profit_7d'
 * @param {string[]} tags - ['renowned', 'smart_degen', 'kol', etc.]
 */
async function fetchWalletRankings(period = '7d', orderby = 'pnl_7d', tags = ['renowned']) {
  console.log(`📊 Fetching ${period} rankings (${tags.join(', ')})...`);
  
  const params = {
    orderby,
    direction: 'desc',
    limit: '100',
  };
  
  // Add tags
  tags.forEach((tag, i) => {
    params[`tag[${i}]`] = tag;
  });
  
  const data = await fetchAPI(`/defi/quotation/v1/rank/sol/wallets/${period}`, params);
  return data?.rank || [];
}

/**
 * Fetch all tag categories
 */
async function fetchAllCategories() {
  const categories = [
    { tag: 'renowned', label: 'Renowned (KOLs)' },
    { tag: 'smart_degen', label: 'Smart Degen' },
    { tag: 'sniper', label: 'Snipers' },
    { tag: 'kol', label: 'KOL Tagged' },
    { tag: 'fresh_wallet', label: 'Fresh Wallets' },
    { tag: 'whale', label: 'Whales' },
  ];
  
  const allWallets = new Map();
  
  for (const cat of categories) {
    // Try each period - including 1d
    for (const period of ['1d', '7d']) {
      try {
        const wallets = await fetchWalletRankings(period, 'realized_profit_' + period, [cat.tag]);
        
        for (const wallet of wallets) {
          if (!allWallets.has(wallet.wallet_address)) {
            wallet._source_tag = cat.tag;
            wallet._source_period = period;
            allWallets.set(wallet.wallet_address, wallet);
          }
        }
        
        console.log(`  ✓ ${cat.label} (${period}): ${wallets.length} wallets`);
        await sleep(DELAY_MS);
      } catch (error) {
        console.error(`  ✗ ${cat.label} (${period}): ${error.message}`);
      }
    }
  }
  
  return Array.from(allWallets.values());
}

/**
 * Transform GMGN wallet to Bloodhound format
 */
function transformToBloodhound(wallet) {
  // Determine wallet type from tags AND source tag
  let walletType = 'smart_money';
  const tags = wallet.tags || [];
  const sourceTag = wallet._source_tag || '';
  
  // Check source tag first (most reliable)
  if (sourceTag === 'sniper') walletType = 'sniper';
  else if (sourceTag === 'kol' || sourceTag === 'renowned') walletType = 'kol';
  else if (sourceTag === 'whale') walletType = 'whale';
  else if (sourceTag === 'fresh_wallet') walletType = 'fresh_wallet';
  // Then check tags array
  else if (tags.includes('kol')) walletType = 'kol';
  else if (tags.includes('sniper')) walletType = 'sniper';
  else if (tags.includes('whale')) walletType = 'whale';
  else if (tags.includes('fresh_wallet')) walletType = 'fresh_wallet';
  else if (tags.includes('smart_degen')) walletType = 'smart_money';
  
  // Determine tier from PnL
  let tier = 'standard';
  const pnl7d = parseFloat(wallet.realized_profit_7d) || 0;
  
  if (pnl7d > 50000) tier = 'legendary';
  else if (pnl7d > 20000) tier = 'elite';
  else if (pnl7d > 5000) tier = 'pro';
  else if (pnl7d > 0) tier = 'rising';
  
  return {
    // Wallet
    solana_address: wallet.wallet_address,
    
    // Identity (GMGN has Twitter directly!)
    twitter_handle: wallet.twitter_username || null,
    twitter_name: wallet.twitter_name || wallet.name || null,
    twitter_bio: wallet.twitter_description || null,
    avatar_url: wallet.avatar || null,
    label: wallet.name || wallet.twitter_name || wallet.twitter_username || null,
    
    // Classification
    wallet_type: walletType,
    tier: tier,
    tags: tags,
    
    // Social
    followers: wallet.follow_count || 0,
    remarks: wallet.remark_count || 0,
    
    // Trading stats
    total_trades_7d: wallet.txs_7d || 0,
    total_trades_30d: wallet.txs_30d || 0,
    buys_7d: wallet.buy_7d || 0,
    sells_7d: wallet.sell_7d || 0,
    
    // PnL
    pnl_1d_usd: parseFloat(wallet.realized_profit_1d) || 0,
    pnl_7d_usd: parseFloat(wallet.realized_profit_7d) || 0,
    pnl_30d_usd: parseFloat(wallet.realized_profit_30d) || 0,
    
    // Win rates
    winrate_1d: wallet.winrate_1d || 0,
    winrate_7d: wallet.winrate_7d || 0,
    winrate_30d: wallet.winrate_30d || 0,
    
    // Volume
    volume_1d_usd: parseFloat(wallet.volume_1d) || 0,
    volume_7d_usd: parseFloat(wallet.volume_7d) || 0,
    volume_30d_usd: parseFloat(wallet.volume_30d) || 0,
    
    // Avg cost/holding
    avg_cost_7d: parseFloat(wallet.avg_cost_7d) || 0,
    avg_holding_period_7d_mins: wallet.avg_holding_period_7d || 0,
    
    // Balance
    sol_balance: parseFloat(wallet.sol_balance) || 0,
    
    // Timestamps
    last_active: wallet.last_active ? new Date(wallet.last_active * 1000).toISOString() : null,
    
    // Metadata
    source: 'gmgn',
    source_tag: wallet._source_tag,
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Main scraper
 */
async function scrape() {
  console.log('🔍 GMGN Wallet Scraper\n');
  
  // Fetch all categories
  const rawWallets = await fetchAllCategories();
  
  console.log(`\n📦 Total unique wallets: ${rawWallets.length}`);
  
  // Transform to Bloodhound format
  const wallets = rawWallets.map(transformToBloodhound);
  
  // Sort by 7d PnL
  wallets.sort((a, b) => (b.pnl_7d_usd || 0) - (a.pnl_7d_usd || 0));
  
  // Stats
  const withTwitter = wallets.filter(w => w.twitter_handle).length;
  const kols = wallets.filter(w => w.wallet_type === 'kol').length;
  const snipers = wallets.filter(w => w.wallet_type === 'sniper').length;
  
  console.log(`\n📊 Stats:`);
  console.log(`  - With Twitter: ${withTwitter}`);
  console.log(`  - KOLs: ${kols}`);
  console.log(`  - Snipers: ${snipers}`);
  
  // Save results
  const outputDir = path.join(__dirname, 'scraped_data');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Full data
  const fullPath = path.join(outputDir, 'gmgn_wallets.json');
  await fs.writeFile(fullPath, JSON.stringify(wallets, null, 2));
  console.log(`\n💾 Full data: ${fullPath}`);
  
  // Twitter wallets only
  const twitterWallets = wallets.filter(w => w.twitter_handle);
  const twitterPath = path.join(outputDir, 'gmgn_twitter_wallets.json');
  await fs.writeFile(twitterPath, JSON.stringify(twitterWallets, null, 2));
  console.log(`💾 Twitter wallets: ${twitterPath}`);
  
  // CSV export
  const csvRows = ['wallet_address,twitter_handle,twitter_name,wallet_type,tier,pnl_7d,winrate_7d,followers,tags'];
  for (const w of wallets) {
    csvRows.push([
      w.solana_address,
      w.twitter_handle || '',
      `"${(w.twitter_name || '').replace(/"/g, '""')}"`,
      w.wallet_type,
      w.tier,
      w.pnl_7d_usd?.toFixed(2) || '0',
      ((w.winrate_7d || 0) * 100).toFixed(1) + '%',
      w.followers,
      `"${(w.tags || []).join(', ')}"`,
    ].join(','));
  }
  const csvPath = path.join(outputDir, 'gmgn_wallets.csv');
  await fs.writeFile(csvPath, csvRows.join('\n'));
  console.log(`💾 CSV export: ${csvPath}`);
  
  // Print top 15
  console.log('\n🏆 Top 15 GMGN Smart Money:\n');
  console.log('Rank | Twitter          | PnL 7d       | Winrate | Type        | Solana Address');
  console.log('-----|------------------|--------------|---------|-------------|---------------');
  
  wallets.slice(0, 15).forEach((w, i) => {
    const twitter = (w.twitter_handle || '-').substring(0, 16).padEnd(16);
    const pnl = `$${(w.pnl_7d_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(12);
    const winrate = `${((w.winrate_7d || 0) * 100).toFixed(0)}%`.padEnd(7);
    const type = w.wallet_type.padEnd(11);
    const addr = w.solana_address?.substring(0, 12) + '...';
    console.log(`${(i + 1).toString().padStart(4)} | ${twitter} | ${pnl} | ${winrate} | ${type} | ${addr}`);
  });
  
  console.log('\n✅ GMGN scrape complete!');
  
  return wallets;
}

// Run
scrape().catch(console.error);
