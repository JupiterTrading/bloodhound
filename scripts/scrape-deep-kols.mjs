/**
 * BLOODHOUND — Deep KOL Scraper
 * 
 * Comprehensive scraper that digs deep into multiple sources for KOL wallet-Twitter mappings:
 *   1. KOLscan individual KOL profiles (wallet + Twitter from each profile page)
 *   2. DexScreener maker/top trader data 
 *   3. Dune Analytics curated queries
 *   4. Birdeye top traders API
 *   5. GMGN.ai smart money wallets
 * 
 * Usage:
 *   node scripts/scrape-deep-kols.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

// Load from .env.local
const DUNE_API_KEY = process.env.DUNE_API_KEY || 'KBdcfX7W3eC8lSAnFKKTY0meompPJXTi';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '62930a03-3c1a-4cfb-9f7b-d911682bddeb';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || 'a0d76ff55e9b42878753c136f44131c3';
const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const OUTPUT_DIR = 'scripts/kol-data';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class DeepKolScraper {
  constructor() {
    this.kols = new Map();
    this.browser = null;
    this.stats = { kolscan: 0, dexscreener: 0, dune: 0, birdeye: 0, gmgn: 0 };
  }

  add(address, name, twitter, source, confidence = 0.7) {
    if (!address || address.length < 32 || address.length > 44) return;
    const cleanTwitter = this.cleanTwitter(twitter);
    const existing = this.kols.get(address);
    
    if (existing) {
      this.kols.set(address, {
        name: name || existing.name,
        twitter_handle: cleanTwitter || existing.twitter_handle,
        confidence: Math.max(confidence, existing.confidence),
        sources: [...new Set([...existing.sources, source])],
      });
    } else {
      this.kols.set(address, {
        name: name || null,
        twitter_handle: cleanTwitter,
        confidence,
        sources: [source],
      });
      if (cleanTwitter) {
        console.log(`  [+] ${address.slice(0,12)}... @${cleanTwitter.padEnd(18)} ${name || ''}`);
        this.stats[source] = (this.stats[source] || 0) + 1;
      }
    }
  }

  cleanTwitter(handle) {
    if (!handle) return null;
    let clean = String(handle).trim();
    clean = clean.replace(/^@/, '');
    clean = clean.replace(/https?:\/\/(twitter|x)\.com\//, '');
    clean = clean.split('/')[0].split('?')[0];
    return clean.length > 1 && clean.length < 30 ? clean.toLowerCase() : null;
  }

  // ==========================================================================
  // SOURCE 1: KOLscan Deep Profile Scraping
  // ==========================================================================
  async scrapeKolscanDeep() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  KOLSCAN DEEP SCRAPE — Individual KOL Profile Pages          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const page = await this.browser.newPage();
    
    try {
      // Step 1: Get all KOL addresses from leaderboard
      console.log('[KOLscan] Fetching leaderboard...');
      await page.goto('https://kolscan.io/leaderboard', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);

      // Extract wallet addresses from leaderboard
      const walletAddresses = await page.evaluate(() => {
        const addresses = [];
        document.querySelectorAll('a[href*="/account/"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const match = href.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (match && !addresses.includes(match[1])) {
            addresses.push(match[1]);
          }
        });
        return addresses;
      });

      console.log(`[KOLscan] Found ${walletAddresses.length} wallets on leaderboard`);

      // Step 2: Visit each KOL's profile page to extract Twitter
      for (const address of walletAddresses.slice(0, 100)) { // Limit to 100 for now
        try {
          await page.goto(`https://kolscan.io/account/${address}`, { 
            waitUntil: 'domcontentloaded', 
            timeout: 15000 
          });
          await sleep(1500);

          // Extract profile data
          const profileData = await page.evaluate(() => {
            const result = { name: null, twitter: null };
            
            // Look for Twitter link
            const twitterLinks = document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]');
            for (const link of twitterLinks) {
              const href = link.getAttribute('href') || '';
              const match = href.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
              if (match) {
                result.twitter = match[1].replace('@', '');
                break;
              }
            }

            // Look for name/label
            const nameSelectors = ['h1', 'h2', '[class*="name"]', '[class*="label"]', '[class*="title"]'];
            for (const sel of nameSelectors) {
              const el = document.querySelector(sel);
              if (el) {
                const text = el.textContent?.trim();
                if (text && text.length > 1 && text.length < 50 && !text.includes('Account') && !text.includes('KOL')) {
                  result.name = text;
                  break;
                }
              }
            }

            // Also check for social icons/links
            document.querySelectorAll('[class*="social"], [class*="icon"]').forEach(el => {
              const parent = el.closest('a');
              if (parent) {
                const href = parent.getAttribute('href') || '';
                if (href.includes('twitter.com') || href.includes('x.com')) {
                  const match = href.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
                  if (match) result.twitter = match[1].replace('@', '');
                }
              }
            });

            return result;
          });

          if (profileData.twitter || profileData.name) {
            this.add(address, profileData.name, profileData.twitter, 'kolscan', 0.85);
          }

        } catch (err) {
          // Timeout or error, continue
        }
        
        await sleep(500 + Math.random() * 500);
      }

      // Step 3: Also check the KOL spotlight/featured section
      console.log('[KOLscan] Checking featured KOLs...');
      await page.goto('https://kolscan.io', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);

      const featuredKols = await page.evaluate(() => {
        const results = [];
        // Look for KOL cards with Twitter links
        document.querySelectorAll('[class*="kol"], [class*="spotlight"], [class*="featured"]').forEach(card => {
          const twitterLink = card.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
          const addressLink = card.querySelector('a[href*="/account/"]');
          
          if (twitterLink && addressLink) {
            const twitterHref = twitterLink.getAttribute('href') || '';
            const addressHref = addressLink.getAttribute('href') || '';
            const twitterMatch = twitterHref.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
            const addressMatch = addressHref.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
            
            if (twitterMatch && addressMatch) {
              const name = card.querySelector('h1, h2, h3, [class*="name"]')?.textContent?.trim();
              results.push({
                address: addressMatch[1],
                twitter: twitterMatch[1].replace('@', ''),
                name: name || null,
              });
            }
          }
        });
        return results;
      });

      for (const kol of featuredKols) {
        this.add(kol.address, kol.name, kol.twitter, 'kolscan', 0.9);
      }

      console.log(`[KOLscan] Total with Twitter: ${this.stats.kolscan || 0}`);

    } catch (err) {
      console.warn(`[KOLscan] Error: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  // ==========================================================================
  // SOURCE 2: DexScreener Top Traders / Makers
  // ==========================================================================
  async scrapeDexScreener() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  DEXSCREENER — Top Traders & Token Makers                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const page = await this.browser.newPage();

    try {
      // Get trending/hot tokens first
      console.log('[DexScreener] Fetching trending tokens...');
      const trendingRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
      const trending = trendingRes.ok ? await trendingRes.json() : [];
      const solTokens = (trending || []).filter(t => t.chainId === 'solana').slice(0, 30);
      
      console.log(`[DexScreener] Analyzing ${solTokens.length} trending tokens`);

      for (const token of solTokens) {
        try {
          // Visit DexScreener token page
          await page.goto(`https://dexscreener.com/solana/${token.tokenAddress}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });
          await sleep(2000);

          // Extract maker/top trader info
          const traderData = await page.evaluate(() => {
            const results = [];
            
            // Look for top traders/makers section
            const traderSections = document.querySelectorAll('[class*="trader"], [class*="maker"], [class*="holder"]');
            traderSections.forEach(section => {
              // Find wallet addresses
              const addressEls = section.querySelectorAll('[class*="address"], a[href*="/solana/"]');
              addressEls.forEach(el => {
                const text = el.textContent || el.getAttribute('href') || '';
                const match = text.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
                if (match) {
                  // Check for associated Twitter/social
                  const row = el.closest('tr, div, li');
                  if (row) {
                    const twitterLink = row.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
                    const label = row.querySelector('[class*="label"], [class*="name"]');
                    if (twitterLink || label) {
                      results.push({
                        address: match[1],
                        twitter: twitterLink?.getAttribute('href')?.match(/(?:twitter|x)\.com\/(@?[\w]+)/)?.[1],
                        name: label?.textContent?.trim(),
                      });
                    }
                  }
                }
              });
            });

            // Also check token info section for creator/deployer
            const infoSection = document.querySelector('[class*="info"], [class*="detail"]');
            if (infoSection) {
              const creatorRow = [...infoSection.querySelectorAll('*')].find(el => 
                el.textContent?.toLowerCase().includes('creator') || 
                el.textContent?.toLowerCase().includes('deployer')
              );
              if (creatorRow) {
                const addressMatch = creatorRow.textContent?.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
                if (addressMatch) {
                  results.push({ address: addressMatch[1], name: 'Token Creator', twitter: null });
                }
              }
            }

            return results;
          });

          for (const trader of traderData) {
            if (trader.address) {
              this.add(trader.address, trader.name, trader.twitter, 'dexscreener', 0.75);
            }
          }

        } catch (err) {
          // Continue on error
        }
        
        await sleep(1000);
      }

      console.log(`[DexScreener] Total with Twitter: ${this.stats.dexscreener || 0}`);

    } catch (err) {
      console.warn(`[DexScreener] Error: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  // ==========================================================================
  // SOURCE 3: Dune Analytics — All KOL Queries
  // ==========================================================================
  async scrapeDune() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  DUNE ANALYTICS — Curated KOL Queries                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (!DUNE_API_KEY) {
      console.log('[Dune] No API key — skipping');
      return;
    }

    const headers = { 'X-DUNE-API-KEY': DUNE_API_KEY };

    // Comprehensive list of Dune queries with KOL/wallet data
    const queries = [
      { id: '4838225', name: 'Curated KOL wallets with Twitter', priority: 1 },
      { id: '3614914', name: 'Crypto Twitter wallets', priority: 1 },
      { id: '2965421', name: 'Solana influencer wallets', priority: 1 },
      { id: '3832067', name: 'Top Solana DEX traders', priority: 2 },
      { id: '4868517', name: 'KOL address list', priority: 2 },
      { id: '3298632', name: 'Solana whale wallets', priority: 3 },
    ];

    for (const query of queries) {
      console.log(`[Dune] Query ${query.id}: ${query.name}`);
      
      try {
        // Try cached results first
        let res = await fetch(
          `https://api.dune.com/api/v1/query/${query.id}/results?limit=1000`,
          { headers }
        );

        // If no cache, execute
        if (res.status === 409 || !res.ok) {
          console.log(`  Executing query...`);
          const execRes = await fetch(
            `https://api.dune.com/api/v1/query/${query.id}/execute`,
            { method: 'POST', headers }
          );
          
          if (!execRes.ok) {
            console.warn(`  Failed to execute: ${execRes.status}`);
            continue;
          }

          const { execution_id } = await execRes.json();
          
          // Poll for results (max 2 min)
          for (let i = 0; i < 60; i++) {
            await sleep(2000);
            const statusRes = await fetch(
              `https://api.dune.com/api/v1/execution/${execution_id}/status`,
              { headers }
            );
            const status = await statusRes.json();
            
            if (status.state === 'QUERY_STATE_COMPLETED') {
              res = await fetch(
                `https://api.dune.com/api/v1/execution/${execution_id}/results?limit=1000`,
                { headers }
              );
              break;
            }
            if (status.state === 'QUERY_STATE_FAILED') {
              console.warn(`  Query failed`);
              break;
            }
            process.stdout.write(`  ${status.state}...\r`);
          }
        }

        if (!res.ok) continue;

        const data = await res.json();
        const rows = data.result?.rows || [];
        
        let found = 0;
        for (const row of rows) {
          // Look for address field
          const address = row.address || row.wallet || row.wallet_address || 
                          row.trader || row.user || row.pubkey || row.user_address;
          
          // Look for Twitter field
          const twitter = row.twitter || row.twitter_handle || row.handle || 
                          row.x_handle || row.social || row.twitter_username;
          
          // Look for name/label
          const name = row.name || row.label || row.display_name || row.username;

          if (address && typeof address === 'string' && address.length >= 32) {
            if (twitter || name) {
              this.add(address, name, twitter, 'dune', query.priority === 1 ? 0.9 : 0.7);
              if (twitter) found++;
            }
          }
        }

        console.log(`  Found ${rows.length} rows, ${found} with Twitter`);
        
      } catch (err) {
        console.warn(`  Error: ${err.message}`);
      }

      await sleep(1000);
    }

    console.log(`[Dune] Total with Twitter: ${this.stats.dune || 0}`);
  }

  // ==========================================================================
  // SOURCE 4: Birdeye Top Traders
  // ==========================================================================
  async scrapeBirdeye() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  BIRDEYE — Top Traders API                                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (!BIRDEYE_API_KEY) {
      console.log('[Birdeye] No API key — skipping');
      return;
    }

    try {
      // Get trending tokens to find active traders
      const headers = { 'X-API-KEY': BIRDEYE_API_KEY };
      
      // Get token list
      const tokenRes = await fetch(
        'https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&limit=20',
        { headers }
      );

      if (!tokenRes.ok) {
        console.log(`[Birdeye] API error: ${tokenRes.status}`);
        return;
      }

      const tokenData = await tokenRes.json();
      const tokens = tokenData.data?.tokens || [];
      console.log(`[Birdeye] Analyzing ${tokens.length} top tokens`);

      for (const token of tokens.slice(0, 10)) {
        try {
          // Get top traders for this token
          const traderRes = await fetch(
            `https://public-api.birdeye.so/defi/v2/tokens/${token.address}/top_traders?limit=50`,
            { headers }
          );

          if (traderRes.ok) {
            const traderData = await traderRes.json();
            const traders = traderData.data?.items || [];
            
            for (const trader of traders) {
              const address = trader.owner || trader.wallet || trader.address;
              if (address) {
                // Birdeye doesn't have Twitter directly, but we can cross-reference
                this.add(address, `Top Trader (${token.symbol})`, null, 'birdeye', 0.6);
              }
            }
          }
        } catch {}
        
        await sleep(500);
      }

      console.log(`[Birdeye] Total traders found: ${this.stats.birdeye || 0}`);

    } catch (err) {
      console.warn(`[Birdeye] Error: ${err.message}`);
    }
  }

  // ==========================================================================
  // SOURCE 5: GMGN Smart Money
  // ==========================================================================
  async scrapeGMGN() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  GMGN.AI — Smart Money Wallets                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const page = await this.browser.newPage();

    try {
      // GMGN shows smart money wallets on their homepage
      await page.goto('https://gmgn.ai/?chain=sol', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(3000);

      // Extract smart money wallets
      const smartMoney = await page.evaluate(() => {
        const results = [];
        
        // Look for wallet addresses with labels
        document.querySelectorAll('a[href*="/sol/address/"], [class*="wallet"], [class*="address"]').forEach(el => {
          const href = el.getAttribute('href') || el.textContent || '';
          const match = href.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          
          if (match) {
            // Check for associated Twitter
            const row = el.closest('tr, div, [class*="row"], [class*="item"]');
            if (row) {
              const twitterLink = row.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
              const label = row.querySelector('[class*="label"], [class*="name"], [class*="tag"]');
              
              results.push({
                address: match[1],
                twitter: twitterLink?.getAttribute('href')?.match(/(?:twitter|x)\.com\/(@?[\w]+)/)?.[1],
                name: label?.textContent?.trim() || 'GMGN Smart Money',
              });
            }
          }
        });

        return results;
      });

      for (const wallet of smartMoney) {
        this.add(wallet.address, wallet.name, wallet.twitter, 'gmgn', 0.8);
      }

      console.log(`[GMGN] Total with Twitter: ${this.stats.gmgn || 0}`);

    } catch (err) {
      console.warn(`[GMGN] Error: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  // ==========================================================================
  // Save & Sync
  // ==========================================================================
  async save() {
    const kolArray = Array.from(this.kols.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => (b.twitter_handle ? 1 : 0) - (a.twitter_handle ? 1 : 0));

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(`${OUTPUT_DIR}/deep-kols.json`, JSON.stringify(kolArray, null, 2));
    
    // Also update aggregated file
    await fs.writeFile(`${OUTPUT_DIR}/aggregated-kols.json`, JSON.stringify(kolArray, null, 2));
    
    console.log(`\n[Save] Wrote ${kolArray.length} KOLs to ${OUTPUT_DIR}/deep-kols.json`);
  }

  async syncToSupabase() {
    const withData = Array.from(this.kols.entries())
      .filter(([_, d]) => d.twitter_handle || d.name)
      .map(([address, data]) => ({
        address,
        label: data.name || `KOL ${address.slice(0, 8)}`,
        twitter_handle: data.twitter_handle,
        category: 'kol',
        description: `KOL from ${data.sources.join(', ')}`,
        confidence: data.confidence,
        status: 'approved',
        source: data.sources.join(','),
      }));

    if (!withData.length) {
      console.log('\n[Supabase] No data to sync');
      return;
    }

    console.log(`\n[Supabase] Syncing ${withData.length} KOLs...`);

    let success = 0;
    for (let i = 0; i < withData.length; i += 25) {
      const batch = withData.slice(i, i + 25);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/known_wallets?on_conflict=address`,
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
        if (res.ok) success += batch.length;
      } catch {}
    }

    console.log(`[Supabase] Synced: ${success}`);
  }

  // ==========================================================================
  // Main
  // ==========================================================================
  async run() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   BLOODHOUND DEEP KOL SCRAPER                                  ║');
    console.log('║   Extracting wallet → Twitter mappings from all sources        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      await this.scrapeKolscanDeep();
      await this.scrapeDexScreener();
      await this.scrapeDune();
      await this.scrapeBirdeye();
      await this.scrapeGMGN();

      await this.save();
      await this.syncToSupabase();

      // Print summary
      const total = this.kols.size;
      const withTwitter = [...this.kols.values()].filter(k => k.twitter_handle).length;

      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║   RESULTS                                                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log(`Total KOLs:        ${total}`);
      console.log(`With Twitter:      ${withTwitter}`);
      console.log('\nBy source:');
      console.log(`  KOLscan:         ${this.stats.kolscan || 0}`);
      console.log(`  DexScreener:     ${this.stats.dexscreener || 0}`);
      console.log(`  Dune:            ${this.stats.dune || 0}`);
      console.log(`  Birdeye:         ${this.stats.birdeye || 0}`);
      console.log(`  GMGN:            ${this.stats.gmgn || 0}`);

    } finally {
      await this.browser.close();
    }
  }
}

const scraper = new DeepKolScraper();
scraper.run().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
