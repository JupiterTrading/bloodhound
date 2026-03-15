/**
 * Fomo FULL Scraper
 * Scrapes all available user data including socials, following, holdings
 * 
 * Usage: node fomo_full_scraper.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API Configuration
const FOMO_API = 'https://prod-api.fomo.family';

// Auth token - UPDATE when expired
const AUTH_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkI4SXlObWU1V0lZRnJIclJRVDBLdFlPRlFIUjFKVXFnaGVTMHhSZHR1QVkifQ.eyJzaWQiOiJjbWt6ZW5oa2MwNXM4am8wY3RrbHo1cmpqIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzM0MjE3NTcsImF1ZCI6ImNtNmg0ODVvMzAwbjN6ajl5bDZ2cGVkcTciLCJzdWIiOiJkaWQ6cHJpdnk6Y21rejA2N2RkMDF5Z2puMGNhaXc5aWNrcCIsImV4cCI6MTc3MzQyNTM1N30.KSKe7Zlqq97fc4QPfjM7DRQFJn2TbIjhiI5oDtSDVmm1sYOZq8Vd2Zn-4ks9I-Iepjj6jRmPmI_rhyeOayLexA';

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'User-Agent': 'fomo/1.60.4/280/ios/iPhone 17 Pro Max/Apple',
  'x-supported-chains': '1399811149,8453,56,143',
  'Accept': '*/*',
};

// Rate limiting
const DELAY_MS = 300;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Fetch with retry
 */
async function fetchAPI(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${FOMO_API}${endpoint}`;
  
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...HEADERS, ...options.headers },
      });
      
      if (response.status === 401) {
        console.error('\n❌ Auth token expired! Re-run proxy capture to get fresh token.');
        process.exit(1);
      }
      
      if (response.status === 429) {
        console.log('  ⏳ Rate limited, waiting 5s...');
        await sleep(5000);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.responseObject || data;
    } catch (error) {
      if (i === 2) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}

/**
 * Fetch leaderboard with pagination
 */
async function fetchLeaderboard(period = '24h', limit = 100, offset = 0) {
  const data = await fetchAPI(`/v2/leaderboard/${period}?limit=${limit}&offset=${offset}`);
  return data?.leaderboard || [];
}

/**
 * Fetch ALL leaderboard entries (paginated)
 */
async function fetchFullLeaderboard(period = '24h') {
  console.log(`\n📊 Fetching FULL ${period} leaderboard...`);
  
  const allUsers = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const batch = await fetchLeaderboard(period, limit, offset);
    if (batch.length === 0) break;
    
    allUsers.push(...batch);
    console.log(`  Fetched ${allUsers.length} users...`);
    
    if (batch.length < limit) break; // Last page
    offset += limit;
    await sleep(DELAY_MS);
  }
  
  console.log(`  ✓ ${period}: ${allUsers.length} total users`);
  return allUsers;
}

/**
 * Fetch detailed user profile
 */
async function fetchUserProfile(userId) {
  return await fetchAPI(`/v2/users/${userId}`);
}

/**
 * Fetch user's following list (reveals more wallets)
 */
async function fetchUserFollowing(userId, limit = 100) {
  const data = await fetchAPI(`/v2/users/${userId}/following?limit=${limit}`);
  return data?.users || [];
}

/**
 * Fetch user's followers
 */
async function fetchUserFollowers(userId, limit = 100) {
  const data = await fetchAPI(`/v2/users/${userId}/followers?limit=${limit}`);
  return data?.users || [];
}

/**
 * Fetch recommended users (discovers more wallets)
 */
async function fetchRecommendedUsers(userId) {
  const data = await fetchAPI(`/v2/users/${userId}/recommendedUsers`);
  return data?.following || [];
}

/**
 * Fetch top trades
 */
async function fetchTopTrades() {
  console.log('\n💰 Fetching top trades...');
  const data = await fetchAPI('/trades/top-combined');
  return data || [];
}

/**
 * Fetch trending tokens with friend holders (reveals more wallets)
 */
async function fetchTrendingWithHolders() {
  console.log('\n🔥 Fetching trending tokens with holders...');
  const data = await fetchAPI('/proxy/trendingTokens/friends', {
    method: 'POST',
    body: JSON.stringify({ limit: 20 }),
  });
  return data?.tokenHoldersMap || {};
}

/**
 * Extract social handles from description/bio
 */
function extractSocials(user) {
  const socials = {
    twitter: null,
    telegram: null,
    discord: null,
    website: null,
  };
  
  // The userHandle might be their Twitter
  if (user.userHandle) {
    // Check if it looks like a Twitter handle
    const handle = user.userHandle;
    if (!handle.includes(' ') && handle.length <= 15) {
      socials.twitter = handle;
    }
  }
  
  // Parse bio/description for socials
  const bio = user.description || '';
  
  // Twitter patterns
  const twitterPatterns = [
    /@(\w{1,15})/,
    /twitter\.com\/(\w+)/i,
    /x\.com\/(\w+)/i,
    /(?:^|\s)(\w+)(?:\s|$).*twitter/i,
  ];
  
  for (const pattern of twitterPatterns) {
    const match = bio.match(pattern);
    if (match && match[1] && !socials.twitter) {
      socials.twitter = match[1].replace('@', '');
    }
  }
  
  // Telegram
  const tgMatch = bio.match(/t\.me\/(\w+)/i) || bio.match(/telegram[:\s]*@?(\w+)/i);
  if (tgMatch) socials.telegram = tgMatch[1];
  
  // Discord
  const discordMatch = bio.match(/discord[:\s]*(\S+)/i);
  if (discordMatch) socials.discord = discordMatch[1];
  
  // Website
  const urlMatch = bio.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) socials.website = urlMatch[0];
  
  return socials;
}

/**
 * Transform user to full Bloodhound format
 */
function transformUser(user, source = 'leaderboard') {
  const socials = extractSocials(user);
  
  // Determine wallet type
  let walletType = 'smart_money';
  if (user.followers > 10000) walletType = 'kol';
  else if (user.swapCount > 2000) walletType = 'market_maker';
  else if (user.numTrades < 20 && user.totalVolume > 100000) walletType = 'whale';
  
  // Determine tier
  let tier = 'standard';
  const pnl = user.pnl24h || user.pnl7d || user.pnl30d || 0;
  if (pnl > 50000) tier = 'legendary';
  else if (pnl > 20000) tier = 'elite';
  else if (pnl > 5000) tier = 'pro';
  else if (pnl > 0) tier = 'rising';
  
  return {
    // Wallet addresses
    solana_address: user.address,
    evm_address: user.evmAddress,
    
    // Fomo identity
    fomo_user_id: user.id,
    fomo_handle: user.userHandle,
    display_name: user.displayName,
    avatar_url: user.profilePictureLink,
    bio: user.description,
    
    // Social links
    twitter_handle: socials.twitter,
    telegram_handle: socials.telegram,
    discord: socials.discord,
    website: socials.website,
    
    // Classification
    wallet_type: walletType,
    tier: tier,
    
    // Social stats
    followers: user.followers || 0,
    following: user.following || 0,
    
    // Trading stats
    total_trades: user.numTrades || 0,
    total_swaps: user.swapCount || 0,
    total_volume_usd: user.totalVolume || 0,
    
    // PnL data
    pnl_24h: user.pnl24h || null,
    pnl_7d: user.pnl7d || null,
    pnl_30d: user.pnl30d || null,
    
    // Holdings summary
    total_holdings: user.totalHoldings || 0,
    top_holdings: user.topHoldings?.slice(0, 5).map(h => ({
      token: h.tokenAddress,
      network: h.networkId === 1399811149 ? 'solana' : h.networkId === 8453 ? 'base' : h.networkId === 56 ? 'bnb' : 'unknown',
      value_usd: h.value,
    })) || [],
    
    // Account info
    account_created: user.createdAt,
    is_activated: user.activated || false,
    is_private: user.private || false,
    
    // Metadata
    source: `fomo_${source}`,
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Main scraper
 */
async function scrapeAll() {
  console.log('🔍 Fomo FULL Scraper\n');
  console.log('This will scrape all available user data from Fomo.');
  console.log('Estimated time: 2-5 minutes depending on data size.\n');
  
  const allUsers = new Map(); // key: solana_address
  
  // 1. Fetch all leaderboards
  for (const period of ['24h', '7d', '30d']) {
    try {
      const users = await fetchFullLeaderboard(period);
      for (const user of users) {
        if (user.address && !allUsers.has(user.address)) {
          allUsers.set(user.address, transformUser(user, `leaderboard_${period}`));
        }
      }
    } catch (error) {
      console.error(`  ✗ ${period} leaderboard failed:`, error.message);
    }
    await sleep(DELAY_MS);
  }
  
  console.log(`\n📦 Leaderboard wallets: ${allUsers.size}`);
  
  // 2. Fetch following lists of top users to discover more wallets
  console.log('\n👥 Discovering wallets from social graph...');
  const topUsers = Array.from(allUsers.values())
    .sort((a, b) => (b.followers || 0) - (a.followers || 0))
    .slice(0, 20); // Top 20 by followers
  
  for (const user of topUsers) {
    try {
      const following = await fetchUserFollowing(user.fomo_user_id, 50);
      for (const f of following) {
        if (f.address && !allUsers.has(f.address)) {
          allUsers.set(f.address, transformUser(f, 'social_graph'));
        }
      }
      process.stdout.write('.');
      await sleep(DELAY_MS);
    } catch (error) {
      // Silent fail for individual user fetches
    }
  }
  console.log(`\n  Added ${allUsers.size - topUsers.length} from social graph`);
  
  // 3. Fetch recommended users
  console.log('\n🎯 Fetching recommended traders...');
  try {
    const firstUser = topUsers[0];
    if (firstUser) {
      const recommended = await fetchRecommendedUsers(firstUser.fomo_user_id);
      for (const r of recommended) {
        if (r.address && !allUsers.has(r.address)) {
          allUsers.set(r.address, transformUser(r, 'recommended'));
        }
      }
      console.log(`  Added ${recommended.length} recommended users`);
    }
  } catch (error) {
    console.error('  ✗ Recommended users failed:', error.message);
  }
  
  // Convert to array and sort
  const wallets = Array.from(allUsers.values())
    .sort((a, b) => (b.pnl_24h || 0) - (a.pnl_24h || 0));
  
  console.log(`\n📦 Total unique wallets: ${wallets.length}`);
  
  // Stats
  const withTwitter = wallets.filter(w => w.twitter_handle).length;
  const withTelegram = wallets.filter(w => w.telegram_handle).length;
  const kols = wallets.filter(w => w.wallet_type === 'kol').length;
  
  console.log(`\n📊 Stats:`);
  console.log(`  - Twitter handles found: ${withTwitter}`);
  console.log(`  - Telegram handles found: ${withTelegram}`);
  console.log(`  - KOLs (>10k followers): ${kols}`);
  
  // Save results
  const outputDir = path.join(__dirname, 'scraped_data');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Full data
  const fullPath = path.join(outputDir, 'fomo_full_wallets.json');
  await fs.writeFile(fullPath, JSON.stringify(wallets, null, 2));
  console.log(`\n💾 Full data: ${fullPath}`);
  
  // Wallets with Twitter (for KOL tracking)
  const twitterWallets = wallets.filter(w => w.twitter_handle);
  const twitterPath = path.join(outputDir, 'fomo_twitter_wallets.json');
  await fs.writeFile(twitterPath, JSON.stringify(twitterWallets, null, 2));
  console.log(`💾 Twitter wallets: ${twitterPath}`);
  
  // CSV export for easy viewing
  const csvRows = ['solana_address,evm_address,display_name,fomo_handle,twitter,telegram,followers,pnl_24h,wallet_type,tier'];
  for (const w of wallets) {
    csvRows.push([
      w.solana_address,
      w.evm_address,
      `"${(w.display_name || '').replace(/"/g, '""')}"`,
      w.fomo_handle,
      w.twitter_handle || '',
      w.telegram_handle || '',
      w.followers,
      w.pnl_24h || 0,
      w.wallet_type,
      w.tier,
    ].join(','));
  }
  const csvPath = path.join(outputDir, 'fomo_wallets.csv');
  await fs.writeFile(csvPath, csvRows.join('\n'));
  console.log(`💾 CSV export: ${csvPath}`);
  
  // Print top 15 with socials
  console.log('\n🏆 Top 15 Fomo Traders with Socials:\n');
  console.log('Rank | Name             | Twitter          | PnL 24h      | Followers');
  console.log('-----|------------------|------------------|--------------|----------');
  
  wallets.slice(0, 15).forEach((w, i) => {
    const name = (w.display_name || 'Unknown').substring(0, 16).padEnd(16);
    const twitter = (w.twitter_handle || '-').substring(0, 16).padEnd(16);
    const pnl = `$${((w.pnl_24h || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(12);
    const followers = (w.followers || 0).toLocaleString();
    console.log(`${(i + 1).toString().padStart(4)} | ${name} | ${twitter} | ${pnl} | ${followers}`);
  });
  
  console.log('\n✅ Full scrape complete!');
  
  return wallets;
}

// Run
scrapeAll().catch(console.error);
