/**
 * BLOODHOUND — Full KOLscan Scraper
 * 
 * Comprehensive scraper for ALL KOL data from KOLscan (479+ wallets):
 *   - Infinite scroll handling to load all wallets
 *   - Individual profile pages for Twitter handles
 * 
 * Usage: node scripts/scrape-kolscan-full.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const API_RESPONSES = [];
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const OUTPUT_FILE = 'kol-data/kolscan-full.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class KolscanScraper {
  constructor() {
    this.kols = new Map();
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('[KOLscan] Launching browser...');
    this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    // Intercept API responses to capture wallet data
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('leaderboard') || url.includes('kol') || url.includes('graphql')) {
        try {
          const json = await response.json();
          API_RESPONSES.push({ url, data: json });
        } catch {}
      }
    });
  }

  async scrapeLeaderboardWithScroll(url, name) {
    console.log(`\n[${name}] Loading ${url}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await sleep(3000);

      let lastCount = 0;
      let stableRounds = 0;

      // Keep scrolling until no new content loads
      for (let i = 0; i < 100; i++) {
        const count = await this.page.evaluate(() => 
          document.querySelectorAll('a[href*="/account/"]').length
        );

        if (count === lastCount) {
          stableRounds++;
          if (stableRounds >= 5) {
            console.log(`  Final count: ${count} wallets`);
            break;
          }
        } else {
          stableRounds = 0;
          console.log(`  Scroll ${i+1}: ${count} wallets...`);
        }
        lastCount = count;

        // Scroll within the correct containers (mainContent and infinite-scroll-component)
        await this.page.evaluate(() => {
          // Try mainContent first
          const main = document.querySelector('.mainContent, [class*="mainContent"]');
          if (main) main.scrollTop = main.scrollHeight;
          
          // Also try infinite scroll container
          const inf = document.querySelector('.infinite-scroll-component, [class*="infinite-scroll"]');
          if (inf) inf.scrollTop = inf.scrollHeight;
          
          // And window scroll as fallback
          window.scrollTo(0, document.body.scrollHeight);
        });
        await sleep(1500);
      }

      // Extract all wallets
      const wallets = await this.page.evaluate(() => {
        const results = [];
        const seen = new Set();
        
        document.querySelectorAll('a[href*="/account/"]').forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (!match || seen.has(match[1])) return;
          seen.add(match[1]);

          const address = match[1];
          let name = null;
          
          // Get name from link content
          const h1 = link.querySelector('h1');
          if (h1) {
            const text = h1.textContent?.trim();
            if (text && text.length < 40 && !text.includes('$')) name = text;
          }
          
          // Look for Twitter in parent container
          let twitter = null;
          const container = link.closest('[class*="user"], [class*="row"], div');
          if (container) {
            const tw = container.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
            if (tw) {
              const twMatch = tw.getAttribute('href')?.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
              if (twMatch) twitter = twMatch[1].replace('@', '');
            }
          }

          results.push({ address, name, twitter });
        });

        return results;
      });

      // Add to collection
      for (const w of wallets) {
        if (!this.kols.has(w.address)) {
          this.kols.set(w.address, { name: w.name, twitter_handle: w.twitter?.toLowerCase(), source: name });
          if (w.twitter) console.log(`  [+] @${w.twitter} - ${w.name || w.address.slice(0,8)}`);
        }
      }

      console.log(`  [${name}] Added ${wallets.length} wallets (total: ${this.kols.size})`);

    } catch (err) {
      console.warn(`  [${name}] Error: ${err.message}`);
    }
  }

  async scrapeProfiles() {
    console.log('\n[Profiles] Checking individual pages for Twitter handles...');
    
    const needsTwitter = [...this.kols.entries()]
      .filter(([_, d]) => !d.twitter_handle)
      .slice(0, 300); // Limit

    let found = 0;
    for (let i = 0; i < needsTwitter.length; i++) {
      const [address, data] = needsTwitter[i];
      
      try {
        await this.page.goto(`https://kolscan.io/account/${address}`, { 
          waitUntil: 'domcontentloaded', timeout: 12000 
        });
        await sleep(800);

        const twitter = await this.page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]');
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('/intent/')) continue;
            const match = href.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
            if (match && match[1].length > 1) return match[1].replace('@', '');
          }
          return null;
        });

        if (twitter) {
          data.twitter_handle = twitter.toLowerCase();
          this.kols.set(address, data);
          found++;
          console.log(`  [+] @${twitter} - ${data.name || address.slice(0,8)}`);
        }

        if ((i + 1) % 50 === 0) console.log(`  Progress: ${i+1}/${needsTwitter.length}`);

      } catch {}
      
      await sleep(400);
    }

    console.log(`[Profiles] Found ${found} Twitter handles`);
  }

  async save() {
    const arr = [...this.kols.entries()].map(([address, d]) => ({
      address, name: d.name, twitter_handle: d.twitter_handle, source: d.source
    }));
    arr.sort((a, b) => (b.twitter_handle ? 1 : 0) - (a.twitter_handle ? 1 : 0));

    await fs.mkdir('kol-data', { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(arr, null, 2));
    console.log(`\n[Save] ${arr.length} KOLs → ${OUTPUT_FILE}`);
    return arr;
  }

  async sync(arr) {
    const rows = arr.filter(k => k.name).map(k => ({
      address: k.address,
      label: k.name || `KOL ${k.address.slice(0,8)}`,
      twitter_handle: k.twitter_handle,
      category: 'kol',
      description: `KOLscan ${k.source}`,
      confidence: k.twitter_handle ? 0.85 : 0.7,
      status: 'approved',
      source: 'kolscan',
    }));

    console.log(`[Supabase] Syncing ${rows.length}...`);
    let ok = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/known_wallets?on_conflict=address`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(batch),
        });
        if (res.ok) ok += batch.length;
      } catch {}
    }
    console.log(`[Supabase] Synced: ${ok}/${rows.length}`);
  }

  async run() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   KOLSCAN FULL SCRAPER — Target: 479+ wallets                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      // Scrape main leaderboard with infinite scroll
      await this.scrapeLeaderboardWithScroll('https://kolscan.io/leaderboard', 'Main');
      
      // Also try different time periods
      await this.scrapeLeaderboardWithScroll('https://kolscan.io/leaderboard?tab=weekly', 'Weekly');
      await this.scrapeLeaderboardWithScroll('https://kolscan.io/leaderboard?tab=monthly', 'Monthly');

      // Check individual profiles for Twitter
      await this.scrapeProfiles();

      // Save and sync
      const arr = await this.save();
      await this.sync(arr);

      // Extract wallets from intercepted API responses
      console.log(`\n[API] Captured ${API_RESPONSES.length} API responses`);
      for (const resp of API_RESPONSES) {
        this.extractWalletsFromApi(resp.data);
      }
      
      // Save API data for analysis
      await fs.writeFile('kol-data/kolscan-api-raw.json', JSON.stringify(API_RESPONSES, null, 2));

      // Summary
      const withTw = [...this.kols.values()].filter(k => k.twitter_handle).length;
      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`TOTAL: ${this.kols.size} wallets, ${withTw} with Twitter`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }

  extractWalletsFromApi(data, depth = 0) {
    if (depth > 5 || !data) return;
    
    if (Array.isArray(data)) {
      for (const item of data) {
        this.extractWalletsFromApi(item, depth + 1);
      }
      return;
    }

    if (typeof data !== 'object') return;

    // Look for wallet address patterns
    const address = data.address || data.wallet || data.walletAddress || data.pubkey || data.owner;
    if (address && typeof address === 'string' && address.length >= 32 && address.length <= 44) {
      const name = data.name || data.label || data.displayName || data.username;
      const twitter = data.twitter || data.twitterHandle || data.twitter_handle || data.handle;
      
      if (!this.kols.has(address)) {
        this.kols.set(address, { 
          name: name || null, 
          twitter_handle: twitter?.toLowerCase() || null, 
          source: 'api' 
        });
        if (twitter) console.log(`  [API+] @${twitter} - ${name || address.slice(0,8)}`);
      }
    }

    // Recurse into nested objects
    for (const key of Object.keys(data)) {
      this.extractWalletsFromApi(data[key], depth + 1);
    }
  }
}

new KolscanScraper().run().catch(e => { console.error(e); process.exit(1); });
