/**
 * BLOODHOUND — Axiom KOL Trade Scraper
 * 
 * Scrapes Axiom token pages for KOL buys marked on charts.
 * KOL profiles with names and X accounts are in transaction tabs.
 * 
 * Strategy: Visit trending tokens and extract KOL trade data
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const sleep = ms => new Promise(r => setTimeout(r, ms));

class AxiomKolScraper {
  constructor() {
    this.kols = new Map();
    this.browser = null;
    this.page = null;
    this.apiResponses = [];
  }

  async init() {
    console.log('[Axiom] Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    
    // Intercept API responses to capture KOL data
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('kol') || url.includes('trade') || url.includes('wallet')) {
        try {
          const json = await response.json();
          this.apiResponses.push({ url, data: json });
        } catch {}
      }
    });
  }

  async scrapeTrendingTokens() {
    console.log('\n[Axiom] Loading trending tokens page...');
    
    try {
      await this.page.goto('https://axiom.trade/', { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(5000);
      
      // Get page HTML to analyze structure
      const html = await this.page.content();
      
      // Look for token links
      const tokenLinks = await this.page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href.includes('/t/') || href.includes('/token/') || href.includes('/meme/')) {
            links.push(href);
          }
        });
        return [...new Set(links)].slice(0, 20);
      });
      
      console.log(`  Found ${tokenLinks.length} token links`);
      
      // Visit each token page to find KOL trades
      for (const link of tokenLinks.slice(0, 10)) {
        await this.scrapeTokenPage(link);
      }
      
    } catch (err) {
      console.warn(`  Error: ${err.message}`);
    }
  }

  async scrapeTokenPage(tokenPath) {
    const url = tokenPath.startsWith('http') ? tokenPath : `https://axiom.trade${tokenPath}`;
    console.log(`\n  [Token] ${url}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(3000);
      
      // Look for KOL markers, trade tabs, labeled wallets
      const kolData = await this.page.evaluate(() => {
        const kols = [];
        
        // Search for any elements with KOL indicators
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const text = el.textContent || '';
          const classes = el.className || '';
          
          // Look for KOL labels
          if (classes.toLowerCase().includes('kol') || 
              text.toLowerCase().includes('kol') ||
              classes.includes('trader') ||
              classes.includes('whale')) {
            
            // Find associated wallet addresses and Twitter links
            const container = el.closest('div, tr, [class*="row"]') || el;
            
            // Look for wallet address
            const walletMatch = container.textContent?.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
            const wallet = walletMatch ? walletMatch[0] : null;
            
            // Look for Twitter/X link
            const twitterLink = container.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
            let twitter = null;
            if (twitterLink) {
              const match = twitterLink.getAttribute('href')?.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
              if (match) twitter = match[1].replace('@', '');
            }
            
            // Look for name
            const nameEl = container.querySelector('[class*="name"], h1, h2, span');
            const name = nameEl?.textContent?.trim()?.slice(0, 50);
            
            if (wallet && (name || twitter)) {
              kols.push({ wallet, name, twitter, source: 'axiom_token' });
            }
          }
        });
        
        // Also look for Twitter links directly
        document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]').forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('/intent/')) return;
          
          const match = href.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
          if (!match) return;
          
          const twitter = match[1].replace('@', '');
          const container = link.closest('div, tr') || link.parentElement;
          const walletMatch = container?.textContent?.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
          
          if (walletMatch) {
            kols.push({ wallet: walletMatch[0], twitter, source: 'axiom_twitter' });
          }
        });
        
        return kols;
      });
      
      // Add to collection
      for (const k of kolData) {
        if (k.wallet && !this.kols.has(k.wallet)) {
          this.kols.set(k.wallet, {
            name: k.name,
            twitter_handle: k.twitter?.toLowerCase(),
            source: k.source,
          });
          if (k.twitter) {
            console.log(`    [+] @${k.twitter} - ${k.wallet.slice(0,12)}...`);
          }
        }
      }
      
    } catch (err) {
      // Continue on errors
    }
  }

  async extractFromApiResponses() {
    console.log(`\n[API] Processing ${this.apiResponses.length} captured API responses...`);
    
    let found = 0;
    for (const resp of this.apiResponses) {
      found += this.extractKolsFromJson(resp.data);
    }
    console.log(`  Found ${found} KOLs from API data`);
  }

  extractKolsFromJson(data, depth = 0) {
    if (depth > 8 || !data) return 0;
    let found = 0;
    
    if (Array.isArray(data)) {
      for (const item of data) {
        found += this.extractKolsFromJson(item, depth + 1);
      }
      return found;
    }
    
    if (typeof data !== 'object') return 0;
    
    // Look for wallet + twitter combinations
    const address = data.address || data.wallet || data.walletAddress || data.owner || data.trader;
    const twitter = data.twitter || data.twitterHandle || data.twitter_handle || data.handle || data.x;
    const name = data.name || data.label || data.displayName || data.username;
    
    if (address && typeof address === 'string' && address.length >= 32 && address.length <= 44) {
      if ((name || twitter) && !this.kols.has(address)) {
        this.kols.set(address, {
          name: name || null,
          twitter_handle: twitter?.toLowerCase()?.replace('@', '') || null,
          source: 'axiom_api',
        });
        found++;
      }
    }
    
    for (const key of Object.keys(data)) {
      found += this.extractKolsFromJson(data[key], depth + 1);
    }
    
    return found;
  }

  async save() {
    const arr = [...this.kols.entries()].map(([address, d]) => ({
      address,
      name: d.name,
      twitter_handle: d.twitter_handle,
      source: d.source,
    }));
    
    await fs.mkdir('kol-data', { recursive: true });
    await fs.writeFile('kol-data/axiom-kols.json', JSON.stringify(arr, null, 2));
    
    const withTwitter = arr.filter(k => k.twitter_handle).length;
    console.log(`\n[Save] ${arr.length} KOLs (${withTwitter} with Twitter) → kol-data/axiom-kols.json`);
    
    // Save API responses for analysis
    await fs.writeFile('kol-data/axiom-api-raw.json', JSON.stringify(this.apiResponses, null, 2));
    
    return arr;
  }

  async sync(arr) {
    if (arr.length === 0) {
      console.log('[Supabase] No new KOLs to sync');
      return;
    }
    
    const rows = arr.filter(k => k.name || k.twitter_handle).map(k => ({
      address: k.address,
      label: k.name || `Axiom Trader ${k.address.slice(0,8)}`,
      twitter_handle: k.twitter_handle || null,
      category: 'kol',
      description: `Axiom ${k.source}`,
      confidence: k.twitter_handle ? 0.85 : 0.7,
      status: 'approved',
      source: 'axiom',
    }));

    console.log(`[Supabase] Syncing ${rows.length} Axiom KOLs...`);
    
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
    console.log('║   AXIOM KOL TRADE SCRAPER                                      ║');
    console.log('║   Extracting KOL buys from token charts                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      await this.scrapeTrendingTokens();
      await this.extractFromApiResponses();
      
      const arr = await this.save();
      await this.sync(arr);

      const withTw = [...this.kols.values()].filter(k => k.twitter_handle).length;
      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`AXIOM: ${this.kols.size} wallets, ${withTw} with Twitter`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }
}

new AxiomKolScraper().run().catch(e => { console.error(e); process.exit(1); });
