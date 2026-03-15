/**
 * DexScreener Top Traders Scraper
 * Uses public API endpoints to fetch wallet data
 * 
 * Usage: node dexscreener_scraper.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DexScreener API
const DEXSCREENER_API = 'https://api.dexscreener.com';

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const DELAY_MS = 500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Fetch with retry
 */
async function fetchAPI(url) {
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
      
      return await response.json();
    } catch (error) {
      if (i === 2) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}

/**
 * Fetch top token pairs on Solana
 */
async function fetchTopPairs() {
  console.log('📊 Fetching top Solana pairs...');
  const data = await fetchAPI(`${DEXSCREENER_API}/token-boosts/top/v1`);
  return data || [];
}

/**
 * Fetch token profile with holders/traders
 */
async function fetchTokenProfile(tokenAddress) {
  const data = await fetchAPI(`${DEXSCREENER_API}/tokens/v1/solana/${tokenAddress}`);
  return data;
}

/**
 * Fetch top traders for a token (from token page API)
 */
async function fetchTopTraders(pairAddress) {
  // DexScreener's top traders endpoint
  const url = `https://api.dexscreener.com/orders/v1/solana/${pairAddress}`;
  try {
    const data = await fetchAPI(url);
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Scrape trending tokens and extract wallet addresses
 */
async function scrapeTrending() {
  console.log('🔥 Fetching trending tokens...');
  
  // Get boosted/trending tokens
  const boosted = await fetchTopPairs();
  console.log(`  Found ${boosted.length} boosted tokens`);
  
  const allWallets = new Map();
  
  // For each token, try to get trader data
  for (const token of boosted.slice(0, 20)) {
    try {
      const tokenAddr = token.tokenAddress;
      if (!tokenAddr) continue;
      
      // Get token details
      const details = await fetchTokenProfile(tokenAddr);
      
      if (details && details.pairs) {
        for (const pair of details.pairs.slice(0, 2)) {
          // Try to get order/trader data
          const traders = await fetchTopTraders(pair.pairAddress);
          
          if (Array.isArray(traders)) {
            for (const trader of traders) {
              if (trader.maker && !allWallets.has(trader.maker)) {
                allWallets.set(trader.maker, {
                  solana_address: trader.maker,
                  source_token: tokenAddr,
                  source_pair: pair.pairAddress,
                });
              }
            }
          }
        }
      }
      
      process.stdout.write('.');
      await sleep(DELAY_MS);
    } catch (error) {
      // Continue on individual token errors
    }
  }
  
  console.log(`\n  Extracted ${allWallets.size} unique wallets`);
  return Array.from(allWallets.values());
}

/**
 * Search for known KOL tokens to find trader wallets
 */
async function scrapeKnownTokens() {
  console.log('\n🎯 Fetching data from known popular tokens...');
  
  // Popular Solana meme tokens that attract top traders
  const popularTokens = [
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
    'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',  // BOME
  ];
  
  const allWallets = new Map();
  
  for (const tokenAddr of popularTokens) {
    try {
      const details = await fetchTokenProfile(tokenAddr);
      
      if (details && details.pairs) {
        const pair = details.pairs[0];
        if (pair) {
          console.log(`  ${pair.baseToken?.symbol || tokenAddr.slice(0,8)}: checking traders...`);
          
          const traders = await fetchTopTraders(pair.pairAddress);
          
          if (Array.isArray(traders)) {
            for (const trader of traders) {
              if (trader.maker && !allWallets.has(trader.maker)) {
                allWallets.set(trader.maker, {
                  solana_address: trader.maker,
                  source_token: tokenAddr,
                  token_symbol: pair.baseToken?.symbol,
                });
              }
            }
            console.log(`    Found ${traders.length} traders`);
          }
        }
      }
      
      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`  ✗ ${tokenAddr.slice(0,8)}: ${error.message}`);
    }
  }
  
  return Array.from(allWallets.values());
}

/**
 * Transform to Bloodhound format
 */
function transformToBloodhound(wallet) {
  return {
    solana_address: wallet.solana_address,
    
    // DexScreener doesn't provide social data
    label: null,
    twitter_handle: null,
    
    // Classification (unknown from DexScreener alone)
    wallet_type: 'smart_money',
    tier: 'standard',
    tags: ['dexscreener_trader'],
    
    // Source
    source: 'dexscreener',
    source_token: wallet.source_token,
    token_symbol: wallet.token_symbol,
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Main scraper
 */
async function scrape() {
  console.log('🔍 DexScreener Wallet Scraper\n');
  console.log('Note: DexScreener provides limited wallet data via public API.');
  console.log('Best wallet data comes from Fomo/GMGN which have social profiles.\n');
  
  const allWallets = new Map();
  
  // Scrape trending
  try {
    const trending = await scrapeTrending();
    for (const w of trending) {
      if (!allWallets.has(w.solana_address)) {
        allWallets.set(w.solana_address, w);
      }
    }
  } catch (error) {
    console.error('Trending scrape failed:', error.message);
  }
  
  // Scrape known tokens
  try {
    const known = await scrapeKnownTokens();
    for (const w of known) {
      if (!allWallets.has(w.solana_address)) {
        allWallets.set(w.solana_address, w);
      }
    }
  } catch (error) {
    console.error('Known tokens scrape failed:', error.message);
  }
  
  // Transform
  const wallets = Array.from(allWallets.values()).map(transformToBloodhound);
  
  console.log(`\n📦 Total DexScreener wallets: ${wallets.length}`);
  
  if (wallets.length === 0) {
    console.log('\n⚠️  DexScreener public API has limited wallet data.');
    console.log('The Fomo + GMGN data (800+ wallets) is your best source.');
    return [];
  }
  
  // Save
  const outputDir = path.join(__dirname, 'scraped_data');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, 'dexscreener_wallets.json');
  await fs.writeFile(outputPath, JSON.stringify(wallets, null, 2));
  console.log(`💾 Saved: ${outputPath}`);
  
  console.log('\n✅ DexScreener scrape complete!');
  
  return wallets;
}

// Run
scrape().catch(console.error);
