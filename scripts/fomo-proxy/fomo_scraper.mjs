/**
 * Fomo API Scraper
 * Pulls leaderboard data and maps usernames to wallet addresses
 * 
 * Usage: node fomo_scraper.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API Configuration - extracted from proxy capture
const FOMO_API = 'https://prod-api.fomo.family';

// Auth token from captured request - UPDATE THIS if expired
const AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkI4SXlObWU1V0lZRnJIclJRVDBLdFlPRlFIUjFKVXFnaGVTMHhSZHR1QVkifQ.eyJzaWQiOiJjbWt6ZW5oa2MwNXM4am8wY3RrbHo1cmpqIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzM0MjE3NTcsImF1ZCI6ImNtNmg0ODVvMzAwbjN6ajl5bDZ2cGVkcTciLCJzdWIiOiJkaWQ6cHJpdnk6Y21rejA2N2RkMDF5Z2puMGNhaXc5aWNrcCIsImV4cCI6MTc3MzQyNTM1N30.KSKe7Zlqq97fc4QPfjM7DRQFJn2TbIjhiI5oDtSDVmm1sYOZq8Vd2Zn-4ks9I-Iepjj6jRmPmI_rhyeOayLexA';

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'User-Agent': 'fomo/1.60.4/280/ios/iPhone 17 Pro Max/Apple',
  'x-supported-chains': '1399811149,8453,56,143',
  'Accept': '*/*',
};

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...HEADERS, ...options.headers },
      });
      
      if (response.status === 401) {
        console.error('❌ Auth token expired! Capture a new one via proxy.');
        process.exit(1);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

/**
 * Fetch leaderboard data
 */
async function fetchLeaderboard(period = '24h', limit = 100) {
  console.log(`📊 Fetching ${period} leaderboard (limit: ${limit})...`);
  const url = `${FOMO_API}/v2/leaderboard/${period}?limit=${limit}`;
  const data = await fetchWithRetry(url);
  
  if (!data.success) {
    throw new Error(`API error: ${data.message}`);
  }
  
  return data.responseObject.leaderboard;
}

/**
 * Fetch all leaderboard periods
 */
async function fetchAllLeaderboards() {
  const periods = ['24h', '7d', '30d'];
  const results = {};
  
  for (const period of periods) {
    try {
      results[period] = await fetchLeaderboard(period, 100);
      console.log(`  ✓ ${period}: ${results[period].length} traders`);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } catch (error) {
      console.error(`  ✗ ${period}: ${error.message}`);
      results[period] = [];
    }
  }
  
  return results;
}

/**
 * Fetch user details
 */
async function fetchUser(userId) {
  const url = `${FOMO_API}/v2/users/${userId}`;
  const data = await fetchWithRetry(url);
  return data.responseObject;
}

/**
 * Fetch user balances/holdings
 */
async function fetchUserBalances(userId) {
  const url = `${FOMO_API}/v2/users/${userId}/balances`;
  const data = await fetchWithRetry(url);
  return data.responseObject?.balances || [];
}

/**
 * Transform Fomo user to Bloodhound format
 */
function transformToBloodhound(user, period = '24h') {
  // Determine wallet type based on behavior
  let walletType = 'smart_money';
  if (user.followers > 10000) walletType = 'kol';
  if (user.swapCount > 2000 && user.numTrades > 500) walletType = 'market_maker';
  
  // Determine tier based on ranking
  let tier = 'standard';
  const pnl = user.pnl24h || 0;
  if (pnl > 50000) tier = 'legendary';
  else if (pnl > 20000) tier = 'elite';
  else if (pnl > 5000) tier = 'pro';
  else if (pnl > 0) tier = 'rising';
  
  return {
    // Identity
    solana_address: user.address,
    evm_address: user.evmAddress,
    fomo_user_id: user.id,
    
    // Social
    label: user.displayName,
    twitter_handle: user.userHandle, // Fomo handle, may need to resolve
    avatar_url: user.profilePictureLink,
    bio: user.description,
    
    // Classification
    wallet_type: walletType,
    tier: tier,
    
    // Stats
    followers: user.followers,
    following: user.following,
    total_trades: user.numTrades,
    total_swaps: user.swapCount,
    total_volume_usd: user.totalVolume,
    
    // PnL
    pnl_24h: user.pnl24h,
    
    // Holdings
    top_holdings: user.topHoldings?.map(h => ({
      token_address: h.tokenAddress,
      network_id: h.networkId,
      amount: h.humanAmount,
      value_usd: h.value,
      image_url: h.imageUrl,
    })) || [],
    
    // Metadata
    source: 'fomo',
    source_period: period,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Deduplicate wallets across leaderboard periods
 */
function deduplicateWallets(leaderboards) {
  const walletMap = new Map();
  
  for (const [period, users] of Object.entries(leaderboards)) {
    for (const user of users) {
      const key = user.address; // Solana address as primary key
      
      if (!walletMap.has(key)) {
        walletMap.set(key, transformToBloodhound(user, period));
      } else {
        // Update with better data if available
        const existing = walletMap.get(key);
        if (user.pnl24h > (existing.pnl_24h || 0)) {
          walletMap.set(key, transformToBloodhound(user, period));
        }
      }
    }
  }
  
  return Array.from(walletMap.values());
}

/**
 * Main scraper function
 */
async function scrape() {
  console.log('🔍 Fomo Leaderboard Scraper\n');
  
  // Fetch all leaderboards
  const leaderboards = await fetchAllLeaderboards();
  
  // Deduplicate
  const wallets = deduplicateWallets(leaderboards);
  console.log(`\n📦 Total unique wallets: ${wallets.length}`);
  
  // Sort by PnL
  wallets.sort((a, b) => (b.pnl_24h || 0) - (a.pnl_24h || 0));
  
  // Save results
  const outputDir = path.join(__dirname, 'scraped_data');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Full data
  const fullPath = path.join(outputDir, 'fomo_wallets.json');
  await fs.writeFile(fullPath, JSON.stringify(wallets, null, 2));
  console.log(`💾 Saved full data to: ${fullPath}`);
  
  // Summary for quick reference
  const summary = wallets.map(w => ({
    solana: w.solana_address,
    evm: w.evm_address,
    name: w.label,
    handle: w.twitter_handle,
    type: w.wallet_type,
    tier: w.tier,
    pnl_24h: w.pnl_24h,
    followers: w.followers,
  }));
  
  const summaryPath = path.join(outputDir, 'fomo_wallets_summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`💾 Saved summary to: ${summaryPath}`);
  
  // Print top 10
  console.log('\n🏆 Top 10 Fomo Traders:\n');
  console.log('Rank | Name             | PnL 24h      | Followers | Solana Address');
  console.log('-----|------------------|--------------|-----------|---------------');
  
  wallets.slice(0, 10).forEach((w, i) => {
    const name = (w.label || 'Unknown').substring(0, 16).padEnd(16);
    const pnl = `$${(w.pnl_24h || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(12);
    const followers = (w.followers || 0).toLocaleString().padEnd(9);
    const addr = w.solana_address?.substring(0, 12) + '...';
    console.log(`${(i + 1).toString().padStart(4)} | ${name} | ${pnl} | ${followers} | ${addr}`);
  });
  
  console.log('\n✅ Scrape complete!');
  
  return wallets;
}

// Run
scrape().catch(console.error);
