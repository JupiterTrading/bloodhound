/**
 * BLOODHOUND — KOLscan JSON Data Extractor
 * 
 * Extracts KOL data from Next.js embedded JSON in KOLscan pages.
 * The wallet-twitter mappings are in __next_f script tags.
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const OUTPUT_FILE = 'kol-data/kolscan-extracted.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class KolscanJsonExtractor {
  constructor() {
    this.kols = new Map();
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('[KOLscan] Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  extractKolsFromHtml(html) {
    let found = 0;
    
    // Pattern to find wallet entries with twitter in Next.js data
    const patterns = [
      /"wallet_address":"([1-9A-HJ-NP-Za-km-z]{32,44})","name":"([^"]+)"[^}]*"twitter":"([^"]+)"/g,
      /"wallet_address":"([1-9A-HJ-NP-Za-km-z]{32,44})","name":"([^"]+)"[^}]*"twitter":null/g,
    ];

    // Extract entries with Twitter
    const regex1 = /"wallet_address":"([1-9A-HJ-NP-Za-km-z]{32,44})","name":"([^"]*)"[^}]*?"twitter":"(https?:\/\/[^"]+)"/g;
    let match;
    while ((match = regex1.exec(html)) !== null) {
      const [_, address, name, twitterUrl] = match;
      const twitterMatch = twitterUrl.match(/(?:twitter|x)\.com\/(@?[\w]+)/i);
      const twitter = twitterMatch ? twitterMatch[1].replace('@', '').toLowerCase() : null;
      
      if (!this.kols.has(address) || (twitter && !this.kols.get(address).twitter_handle)) {
        this.kols.set(address, {
          name: name || null,
          twitter_handle: twitter,
          source: 'json',
        });
        if (twitter) found++;
      }
    }

    // Also extract entries without Twitter (name only)
    const regex2 = /"wallet_address":"([1-9A-HJ-NP-Za-km-z]{32,44})","name":"([^"]+)"/g;
    while ((match = regex2.exec(html)) !== null) {
      const [_, address, name] = match;
      if (!this.kols.has(address)) {
        this.kols.set(address, {
          name: name || null,
          twitter_handle: null,
          source: 'json',
        });
      }
    }

    return found;
  }

  async scrapeLeaderboard(url, name) {
    console.log(`\n[${name}] Loading ${url}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(3000);

      // Scroll to load all content
      for (let i = 0; i < 15; i++) {
        await this.page.evaluate(() => {
          const main = document.querySelector('.mainContent');
          if (main) main.scrollTop = main.scrollHeight;
          window.scrollTo(0, document.body.scrollHeight);
        });
        await sleep(1000);
      }

      // Get full page HTML
      const html = await this.page.content();
      const found = this.extractKolsFromHtml(html);
      
      const withTwitter = [...this.kols.values()].filter(k => k.twitter_handle).length;
      console.log(`  [${name}] Found ${found} new Twitter handles`);
      console.log(`  Total: ${this.kols.size} wallets, ${withTwitter} with Twitter`);

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
    
    // Print samples
    console.log('\nSample KOLs with Twitter:');
    arr.filter(k => k.twitter_handle).slice(0, 15).forEach(k => {
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
      description: 'KOLscan leaderboard',
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
    console.log('║   KOLSCAN JSON EXTRACTOR                                       ║');
    console.log('║   Extracting wallet + Twitter from embedded Next.js data       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      // Scrape all leaderboards
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

new KolscanJsonExtractor().run().catch(e => { console.error(e); process.exit(1); });
