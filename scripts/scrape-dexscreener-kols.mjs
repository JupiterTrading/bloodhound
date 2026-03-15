/**
 * BLOODHOUND — DexScreener KOL Scraper
 * 
 * Scrapes DexScreener token pages for KOL sections.
 * KOLs who bought tokens are listed with their wallets.
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const sleep = ms => new Promise(r => setTimeout(r, ms));

class DexScreenerKolScraper {
  constructor() {
    this.kols = new Map();
    this.browser = null;
    this.page = null;
    this.apiResponses = [];
  }

  async init() {
    console.log('[DexScreener] Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    
    // Intercept API responses
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('kol') || url.includes('holder') || url.includes('trader')) {
        try {
          const json = await response.json();
          this.apiResponses.push({ url, data: json });
        } catch {}
      }
    });
  }

  async scrapeTrendingTokens() {
    console.log('\n[DexScreener] Loading Solana trending tokens...');
    
    try {
      await this.page.goto('https://dexscreener.com/solana', { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(5000);
      
      // Get token links
      const tokenLinks = await this.page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href.includes('/solana/') && href.length > 20) {
            links.push(href);
          }
        });
        return [...new Set(links)].slice(0, 15);
      });
      
      console.log(`  Found ${tokenLinks.length} token links`);
      
      // Visit each token page
      for (const link of tokenLinks) {
        await this.scrapeTokenPage(link);
      }
      
    } catch (err) {
      console.warn(`  Error: ${err.message}`);
    }
  }

  async scrapeTokenPage(tokenPath) {
    const url = tokenPath.startsWith('http') ? tokenPath : `https://dexscreener.com${tokenPath}`;
    console.log(`\n  [Token] ${url.slice(0, 60)}...`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(3000);
      
      // Scroll to load more content
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);
      
      // Look for KOL section, traders, top holders
      const pageData = await this.page.evaluate(() => {
        const kols = [];
        const html = document.body.innerHTML;
        
        // Search for KOL indicators
        const kolSections = document.querySelectorAll('[class*="kol"], [class*="trader"], [class*="holder"], [class*="whale"]');
        
        kolSections.forEach(section => {
          // Find wallet addresses in section
          const walletMatches = section.textContent?.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
          
          // Find Twitter links
          const twitterLinks = section.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]');
          
          walletMatches.forEach(wallet => {
            let twitter = null;
            twitterLinks.forEach(link => {
              const match = link.getAttribute('href')?.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
              if (match) twitter = match[1].replace('@', '');
            });
            
            if (wallet) kols.push({ wallet, twitter, source: 'dexscreener_section' });
          });
        });
        
        // Also check all Twitter links with nearby wallets
        document.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]').forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('/intent/') || href.includes('/share')) return;
          
          const match = href.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
          if (!match) return;
          
          const twitter = match[1].replace('@', '');
          const container = link.closest('div, tr, [class*="row"]') || link.parentElement;
          const walletMatch = container?.textContent?.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
          
          if (walletMatch) {
            kols.push({ wallet: walletMatch[0], twitter, source: 'dexscreener_twitter' });
          }
        });
        
        // Check for labeled wallets in any format
        const allText = document.body.innerText;
        const labeledPattern = /(\w+)\s*[:\-]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/g;
        let labelMatch;
        while ((labelMatch = labeledPattern.exec(allText)) !== null) {
          const [_, label, wallet] = labelMatch;
          if (label.length > 2 && label.length < 30) {
            kols.push({ wallet, name: label, source: 'dexscreener_labeled' });
          }
        }
        
        return kols;
      });
      
      // Add to collection
      for (const k of pageData) {
        if (k.wallet && !this.kols.has(k.wallet)) {
          this.kols.set(k.wallet, {
            name: k.name || null,
            twitter_handle: k.twitter?.toLowerCase() || null,
            source: k.source,
          });
          if (k.twitter) {
            console.log(`    [+] @${k.twitter} - ${k.wallet.slice(0,12)}...`);
          }
        }
      }
      
    } catch (err) {
      // Continue
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
    
    const address = data.address || data.wallet || data.maker || data.owner;
    const twitter = data.twitter || data.twitterHandle || data.handle;
    const name = data.name || data.label || data.tag;
    
    if (address && typeof address === 'string' && address.length >= 32 && address.length <= 44) {
      if ((name || twitter) && !this.kols.has(address)) {
        this.kols.set(address, {
          name: name || null,
          twitter_handle: twitter?.toLowerCase()?.replace('@', '') || null,
          source: 'dexscreener_api',
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
    await fs.writeFile('kol-data/dexscreener-kols.json', JSON.stringify(arr, null, 2));
    await fs.writeFile('kol-data/dexscreener-api-raw.json', JSON.stringify(this.apiResponses, null, 2));
    
    const withTwitter = arr.filter(k => k.twitter_handle).length;
    console.log(`\n[Save] ${arr.length} KOLs (${withTwitter} with Twitter) → kol-data/dexscreener-kols.json`);
    
    return arr;
  }

  async sync(arr) {
    if (arr.length === 0) {
      console.log('[Supabase] No new KOLs to sync');
      return;
    }
    
    const rows = arr.filter(k => k.name || k.twitter_handle).map(k => ({
      address: k.address,
      label: k.name || `DexScreener Trader ${k.address.slice(0,8)}`,
      twitter_handle: k.twitter_handle || null,
      category: 'kol',
      description: `DexScreener ${k.source}`,
      confidence: k.twitter_handle ? 0.85 : 0.7,
      status: 'approved',
      source: 'dexscreener',
    }));

    console.log(`[Supabase] Syncing ${rows.length} DexScreener KOLs...`);
    
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
    console.log('║   DEXSCREENER KOL SCRAPER                                      ║');
    console.log('║   Extracting KOLs from token pages                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      await this.scrapeTrendingTokens();
      await this.extractFromApiResponses();
      
      const arr = await this.save();
      await this.sync(arr);

      const withTw = [...this.kols.values()].filter(k => k.twitter_handle).length;
      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`DEXSCREENER: ${this.kols.size} wallets, ${withTw} with Twitter`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }
}

new DexScreenerKolScraper().run().catch(e => { console.error(e); process.exit(1); });
