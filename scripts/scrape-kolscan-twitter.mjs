/**
 * BLOODHOUND — KOLscan Twitter Scraper
 * 
 * Extracts wallet addresses AND Twitter handles from KOLscan leaderboards.
 * Twitter links are displayed as X logos next to each KOL name.
 * 
 * Scrapes: Daily, Weekly, Monthly leaderboards
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const OUTPUT_FILE = 'kol-data/kolscan-with-twitter.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class KolscanTwitterScraper {
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
  }

  async scrapeLeaderboard(url, name) {
    console.log(`\n[${name}] Loading ${url}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(3000);

      let lastCount = 0;
      let stableRounds = 0;

      // Scroll to load all content
      for (let i = 0; i < 100; i++) {
        const count = await this.page.evaluate(() => 
          document.querySelectorAll('a[href*="/account/"]').length
        );

        if (count === lastCount) {
          stableRounds++;
          if (stableRounds >= 5) {
            console.log(`  Loaded ${count} entries`);
            break;
          }
        } else {
          stableRounds = 0;
          if (i % 3 === 0) console.log(`  Scrolling... ${count} entries`);
        }
        lastCount = count;

        await this.page.evaluate(() => {
          const main = document.querySelector('.mainContent, [class*="mainContent"]');
          if (main) main.scrollTop = main.scrollHeight;
          const inf = document.querySelector('.infinite-scroll-component');
          if (inf) inf.scrollTop = inf.scrollHeight;
          window.scrollTo(0, document.body.scrollHeight);
        });
        await sleep(1200);
      }

      // Extract wallets WITH Twitter handles
      const wallets = await this.page.evaluate(() => {
        const results = [];
        const seen = new Set();
        
        // Find all user rows/entries on the leaderboard
        // Each entry has: rank, name, wallet link, and possibly a Twitter/X link
        document.querySelectorAll('a[href*="/account/"]').forEach(accountLink => {
          const href = accountLink.getAttribute('href') || '';
          const match = href.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (!match || seen.has(match[1])) return;
          seen.add(match[1]);

          const address = match[1];
          let name = null;
          let twitter = null;

          // Get the parent container (row) that holds both name and Twitter link
          // Try multiple parent levels to find the row container
          let container = accountLink.parentElement;
          for (let i = 0; i < 5; i++) {
            if (!container) break;
            
            // Look for Twitter/X links in this container
            const twitterLinks = container.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]');
            for (const twLink of twitterLinks) {
              const twHref = twLink.getAttribute('href') || '';
              // Skip share/intent links
              if (twHref.includes('/intent/') || twHref.includes('/share')) continue;
              
              const twMatch = twHref.match(/(?:twitter|x)\.com\/(@?[\w]+)/i);
              if (twMatch && twMatch[1].length > 1) {
                twitter = twMatch[1].replace('@', '').toLowerCase();
                break;
              }
            }
            
            // Also check for X logo SVGs that might be wrapped in links
            if (!twitter) {
              const svgLinks = container.querySelectorAll('a svg, a img');
              svgLinks.forEach(svg => {
                const parent = svg.closest('a');
                if (parent) {
                  const parentHref = parent.getAttribute('href') || '';
                  if (parentHref.includes('twitter.com') || parentHref.includes('x.com')) {
                    const twMatch = parentHref.match(/(?:twitter|x)\.com\/(@?[\w]+)/i);
                    if (twMatch) twitter = twMatch[1].replace('@', '').toLowerCase();
                  }
                }
              });
            }

            if (twitter) break;
            container = container.parentElement;
          }

          // Get name from the account link
          const h1 = accountLink.querySelector('h1, h2, span, [class*="name"]');
          if (h1) {
            const text = h1.textContent?.trim();
            if (text && text.length < 50 && !text.includes('$')) name = text;
          }
          if (!name) {
            const linkText = accountLink.textContent?.trim();
            if (linkText && linkText.length < 50 && !linkText.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
              name = linkText.split('\n')[0].trim();
            }
          }

          results.push({ address, name, twitter });
        });

        return results;
      });

      // Add to collection
      let newTwitter = 0;
      for (const w of wallets) {
        const existing = this.kols.get(w.address);
        if (!existing) {
          this.kols.set(w.address, {
            name: w.name,
            twitter_handle: w.twitter,
            source: name,
          });
          if (w.twitter) newTwitter++;
        } else if (w.twitter && !existing.twitter_handle) {
          existing.twitter_handle = w.twitter;
          this.kols.set(w.address, existing);
          newTwitter++;
        }
      }

      console.log(`  [${name}] ${wallets.length} wallets, ${newTwitter} new Twitter handles`);
      console.log(`  Total: ${this.kols.size} wallets, ${[...this.kols.values()].filter(k => k.twitter_handle).length} with Twitter`);

    } catch (err) {
      console.warn(`  [${name}] Error: ${err.message}`);
    }
  }

  async save() {
    const arr = [...this.kols.entries()].map(([address, d]) => ({
      address,
      name: d.name,
      twitter_handle: d.twitter_handle,
      source: d.source
    }));
    
    // Sort: those with Twitter first
    arr.sort((a, b) => {
      if (a.twitter_handle && !b.twitter_handle) return -1;
      if (!a.twitter_handle && b.twitter_handle) return 1;
      return 0;
    });

    await fs.mkdir('kol-data', { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(arr, null, 2));
    
    const withTwitter = arr.filter(k => k.twitter_handle).length;
    console.log(`\n[Save] ${arr.length} KOLs (${withTwitter} with Twitter) → ${OUTPUT_FILE}`);
    
    // Print some samples
    console.log('\nSample KOLs with Twitter:');
    arr.filter(k => k.twitter_handle).slice(0, 10).forEach(k => {
      console.log(`  @${k.twitter_handle.padEnd(20)} ${k.name || k.address.slice(0,12)}`);
    });

    return arr;
  }

  async sync(arr) {
    const rows = arr.filter(k => k.name || k.twitter_handle).map(k => ({
      address: k.address,
      label: k.name || `KOL ${k.address.slice(0,8)}`,
      twitter_handle: k.twitter_handle || null,
      category: 'kol',
      description: `KOLscan ${k.source} leaderboard`,
      confidence: k.twitter_handle ? 0.9 : 0.75,
      status: 'approved',
      source: 'kolscan',
    }));

    console.log(`\n[Supabase] Syncing ${rows.length} KOLs...`);
    
    let ok = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/known_wallets?on_conflict=address`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
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
    console.log('║   KOLSCAN TWITTER SCRAPER                                      ║');
    console.log('║   Extracting wallet + Twitter from Daily/Weekly/Monthly        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      // Scrape all three leaderboards
      await this.scrapeLeaderboard('https://kolscan.io/leaderboard', 'Main');
      await this.scrapeLeaderboard('https://kolscan.io/leaderboard?tab=daily', 'Daily');
      await this.scrapeLeaderboard('https://kolscan.io/leaderboard?tab=weekly', 'Weekly');
      await this.scrapeLeaderboard('https://kolscan.io/leaderboard?tab=monthly', 'Monthly');

      // Save and sync
      const arr = await this.save();
      await this.sync(arr);

      // Final summary
      const withTw = [...this.kols.values()].filter(k => k.twitter_handle).length;
      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`FINAL: ${this.kols.size} wallets, ${withTw} with Twitter handles`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }
}

new KolscanTwitterScraper().run().catch(e => { console.error(e); process.exit(1); });
