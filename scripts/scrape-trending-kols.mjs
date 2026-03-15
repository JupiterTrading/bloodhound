/**
 * BLOODHOUND — Trending Token KOL Extractor
 * 
 * Scrapes trending tokens from multiple sources to find active KOL wallets.
 * Sources: DexScreener trending, Pump.fun king of the hill, Birdeye trending
 * 
 * Usage:
 *   node scripts/scrape-trending-kols.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const OUTPUT_FILE = 'scripts/trending-kols.json';

const sleep = ms => new Promise(r => setTimeout(r, ms));

class TrendingKolExtractor {
  constructor() {
    this.kols = new Map();
    this.tokens = new Map();
    this.browser = null;
  }

  async init() {
    console.log('[Trending] Launching browser...');
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox']
    });
  }

  // ==========================================================================
  // DexScreener Trending
  // ==========================================================================
  async scrapeDexScreenerTrending() {
    console.log('\n[DexScreener] Fetching trending tokens...');
    
    try {
      // Use their public API for boosted/trending tokens
      const boostRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
      if (boostRes.ok) {
        const data = await boostRes.json();
        const solTokens = (data || [])
          .filter(t => t.chainId === 'solana')
          .slice(0, 20);
        
        console.log(`  Found ${solTokens.length} boosted Solana tokens`);
        
        for (const token of solTokens) {
          this.tokens.set(token.tokenAddress, {
            source: 'dexscreener_boost',
            name: token.description || token.tokenAddress.slice(0, 8),
          });
        }
      }

      // Also get latest profiles (tokens that paid for enhanced display)
      const profileRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
      if (profileRes.ok) {
        const data = await profileRes.json();
        const solTokens = (data || [])
          .filter(t => t.chainId === 'solana')
          .slice(0, 20);
        
        console.log(`  Found ${solTokens.length} profile-enhanced Solana tokens`);
        
        for (const token of solTokens) {
          if (!this.tokens.has(token.tokenAddress)) {
            this.tokens.set(token.tokenAddress, {
              source: 'dexscreener_profile',
              name: token.description || token.tokenAddress.slice(0, 8),
            });
          }
        }
      }
    } catch (error) {
      console.warn(`[DexScreener] Error: ${error.message}`);
    }
  }

  // ==========================================================================
  // Pump.fun King of the Hill
  // ==========================================================================
  async scrapePumpFunKing() {
    console.log('\n[Pump.fun] Fetching king of the hill tokens...');
    
    const page = await this.browser.newPage();
    
    try {
      await page.goto('https://pump.fun', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);

      // Extract token addresses from the main page
      const tokens = await page.evaluate(() => {
        const results = [];
        
        // Look for token cards/links
        const tokenLinks = document.querySelectorAll('a[href*="/coin/"], a[href*="/token/"]');
        tokenLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/(coin|token)\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (match) {
            results.push({
              address: match[2],
              name: link.textContent?.trim().slice(0, 50) || 'Unknown',
            });
          }
        });

        // Also look for creator/deployer wallets shown on page
        const creatorEls = document.querySelectorAll('[class*="creator"], [class*="deployer"], [class*="dev"]');
        creatorEls.forEach(el => {
          const text = el.textContent || '';
          const walletMatch = text.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (walletMatch) {
            results.push({
              wallet: walletMatch[1],
              type: 'creator',
            });
          }
        });

        return results;
      });

      const tokenAddresses = tokens.filter(t => t.address).map(t => t.address);
      const uniqueTokens = [...new Set(tokenAddresses)].slice(0, 20);
      
      console.log(`  Found ${uniqueTokens.length} trending tokens`);
      
      for (const addr of uniqueTokens) {
        if (!this.tokens.has(addr)) {
          this.tokens.set(addr, { source: 'pumpfun_trending', name: 'Pump.fun token' });
        }
      }

      // Extract any visible creator wallets
      const creatorWallets = tokens.filter(t => t.wallet);
      for (const c of creatorWallets) {
        this.kols.set(c.wallet, {
          name: null,
          twitter_handle: null,
          type: 'token_creator',
          source: 'pumpfun',
        });
      }

    } catch (error) {
      console.warn(`[Pump.fun] Error: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  // ==========================================================================
  // Analyze token holders for KOLs
  // ==========================================================================
  async analyzeTokenHolders(tokenMint) {
    // Use Helius to get top holders
    const HELIUS_KEY = '60d6158d-429c-4d41-b7b4-1176b54228a6';
    
    try {
      const res = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintAccounts: [tokenMint] }),
      });

      if (!res.ok) return [];

      const data = await res.json();
      // Token metadata doesn't include holders, but we can get this from DAS
      
      // Instead, get recent transactions for this token to find active traders
      const txRes = await fetch(
        `https://api.helius.xyz/v0/addresses/${tokenMint}/transactions?api-key=${HELIUS_KEY}&limit=50`
      );
      
      if (!txRes.ok) return [];
      
      const txs = await txRes.json();
      const traders = new Set();
      
      for (const tx of txs) {
        // Extract signers (these are the traders)
        if (tx.feePayer) traders.add(tx.feePayer);
        if (tx.nativeTransfers) {
          tx.nativeTransfers.forEach(t => {
            if (t.fromUserAccount) traders.add(t.fromUserAccount);
          });
        }
      }

      return [...traders].slice(0, 20);
    } catch (error) {
      return [];
    }
  }

  // ==========================================================================
  // Check if wallet is a KOL by analyzing their activity
  // ==========================================================================
  async enrichWalletAsKol(address) {
    const HELIUS_KEY = '60d6158d-429c-4d41-b7b4-1176b54228a6';
    
    try {
      // Get wallet names/identities
      const nameRes = await fetch(
        `https://api.helius.xyz/v0/addresses/${address}/names?api-key=${HELIUS_KEY}`
      );
      
      let name = null;
      if (nameRes.ok) {
        const names = await nameRes.json();
        if (names.length > 0) {
          name = names[0];
        }
      }

      // Get transaction count to gauge activity
      const txRes = await fetch(
        `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=1`
      );

      if (name) {
        this.kols.set(address, {
          name,
          twitter_handle: null,
          type: 'active_trader',
          source: 'helius_enrichment',
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async run() {
    await this.init();

    // Step 1: Gather trending tokens
    await this.scrapeDexScreenerTrending();
    await this.scrapePumpFunKing();

    console.log(`\n[Trending] Total tokens to analyze: ${this.tokens.size}`);

    // Step 2: For each trending token, find active traders
    let analyzed = 0;
    for (const [tokenMint, tokenInfo] of this.tokens) {
      if (analyzed >= 10) break; // Limit API calls
      
      console.log(`[Analyze] ${tokenInfo.name} (${tokenMint.slice(0, 8)}...)`);
      
      const traders = await this.analyzeTokenHolders(tokenMint);
      console.log(`  Found ${traders.length} active traders`);

      // Try to enrich top traders as KOLs
      for (const trader of traders.slice(0, 5)) {
        if (!this.kols.has(trader)) {
          await this.enrichWalletAsKol(trader);
        }
      }

      analyzed++;
      await sleep(500);
    }

    // Save results
    await this.save();
    await this.browser.close();
  }

  async save() {
    const kolArray = Array.from(this.kols.entries()).map(([address, data]) => ({
      address,
      ...data,
      scraped_at: new Date().toISOString(),
    }));

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(kolArray, null, 2));
    
    console.log('\n=== TRENDING KOL EXTRACTION COMPLETE ===');
    console.log(`Tokens analyzed: ${this.tokens.size}`);
    console.log(`KOLs identified: ${kolArray.length}`);
    console.log(`Output: ${OUTPUT_FILE}`);
  }
}

const extractor = new TrendingKolExtractor();
extractor.run().catch(err => {
  console.error('[Trending] Fatal error:', err);
  process.exit(1);
});
