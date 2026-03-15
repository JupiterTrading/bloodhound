/**
 * BLOODHOUND — Bubblemaps Data Extractor
 * 
 * Extracts labeled wallets and connection data from Bubblemaps.
 * Bubblemaps shows: exchange wallets, token holder clusters, connections.
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const sleep = ms => new Promise(r => setTimeout(r, ms));

class BubblemapsScraper {
  constructor() {
    this.wallets = new Map();
    this.browser = null;
    this.page = null;
    this.apiResponses = [];
  }

  async init() {
    console.log('[Bubblemaps] Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    
    // Intercept API responses for wallet data
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('wallet') || url.includes('holder') || url.includes('label')) {
        try {
          const json = await response.json();
          this.apiResponses.push({ url, data: json });
        } catch {}
      }
    });
  }

  async scrapeSolanaPage() {
    console.log('\n[Bubblemaps] Loading Solana tokens page...');
    
    try {
      // Try the main Solana page
      await this.page.goto('https://app.bubblemaps.io/sol', { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(5000);
      
      // Get token links
      const tokenLinks = await this.page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href.includes('/sol/') || href.includes('token')) {
            links.push(href);
          }
        });
        return [...new Set(links)].slice(0, 10);
      });
      
      console.log(`  Found ${tokenLinks.length} token links`);
      
      // Also try trending/popular tokens
      const trendingTokens = [
        'https://app.bubblemaps.io/sol/token/So11111111111111111111111111111111111111112', // SOL
        'https://app.bubblemaps.io/sol/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      ];
      
      for (const url of [...tokenLinks.slice(0, 5), ...trendingTokens]) {
        await this.scrapeTokenPage(url);
      }
      
    } catch (err) {
      console.warn(`  Error: ${err.message}`);
    }
  }

  async scrapeTokenPage(tokenUrl) {
    const url = tokenUrl.startsWith('http') ? tokenUrl : `https://app.bubblemaps.io${tokenUrl}`;
    console.log(`\n  [Token] ${url.slice(0, 60)}...`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await sleep(5000);
      
      // Extract labeled wallets from the visualization
      const walletData = await this.page.evaluate(() => {
        const wallets = [];
        
        // Look for labeled elements (exchanges, known wallets)
        document.querySelectorAll('[class*="label"], [class*="wallet"], [class*="holder"], [class*="entity"]').forEach(el => {
          const text = el.textContent || '';
          const walletMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
          
          // Common exchange/entity names
          const labels = ['Binance', 'Coinbase', 'Kraken', 'FTX', 'Raydium', 'Jupiter', 'Orca', 'Marinade', 'DEX', 'CEX'];
          let foundLabel = null;
          
          for (const label of labels) {
            if (text.toLowerCase().includes(label.toLowerCase())) {
              foundLabel = label;
              break;
            }
          }
          
          if (walletMatch && foundLabel) {
            wallets.push({ 
              address: walletMatch[0], 
              label: foundLabel,
              category: foundLabel.includes('DEX') || foundLabel.includes('Raydium') || foundLabel.includes('Jupiter') 
                ? 'protocol_team' : 'exchange'
            });
          }
        });
        
        // Also check tooltips and info panels
        document.querySelectorAll('[class*="tooltip"], [class*="info"], [class*="panel"]').forEach(el => {
          const text = el.textContent || '';
          const walletMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
          const labelMatch = text.match(/([\w\s]+):\s*[1-9A-HJ-NP-Za-km-z]{32,44}/);
          
          if (walletMatch && labelMatch) {
            wallets.push({
              address: walletMatch[0],
              label: labelMatch[1].trim(),
              category: 'known_figure'
            });
          }
        });
        
        return wallets;
      });
      
      // Add to collection
      for (const w of walletData) {
        if (w.address && !this.wallets.has(w.address)) {
          this.wallets.set(w.address, {
            label: w.label,
            category: w.category,
            source: 'bubblemaps',
          });
          console.log(`    [+] ${w.label} - ${w.address.slice(0,12)}...`);
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
      found += this.extractWalletsFromJson(resp.data);
    }
    console.log(`  Found ${found} labeled wallets from API data`);
  }

  extractWalletsFromJson(data, depth = 0) {
    if (depth > 8 || !data) return 0;
    let found = 0;
    
    if (Array.isArray(data)) {
      for (const item of data) {
        found += this.extractWalletsFromJson(item, depth + 1);
      }
      return found;
    }
    
    if (typeof data !== 'object') return 0;
    
    const address = data.address || data.wallet || data.owner || data.holder;
    const label = data.label || data.name || data.tag || data.entity;
    const category = data.type || data.category;
    
    if (address && typeof address === 'string' && address.length >= 32 && address.length <= 44 && label) {
      if (!this.wallets.has(address)) {
        let walletCategory = 'known_figure';
        const labelLower = label.toLowerCase();
        if (labelLower.includes('exchange') || labelLower.includes('binance') || labelLower.includes('coinbase')) {
          walletCategory = 'exchange';
        } else if (labelLower.includes('dex') || labelLower.includes('protocol')) {
          walletCategory = 'protocol_team';
        }
        
        this.wallets.set(address, {
          label,
          category: walletCategory,
          source: 'bubblemaps_api',
        });
        found++;
      }
    }
    
    for (const key of Object.keys(data)) {
      found += this.extractWalletsFromJson(data[key], depth + 1);
    }
    
    return found;
  }

  async save() {
    const arr = [...this.wallets.entries()].map(([address, d]) => ({
      address,
      label: d.label,
      category: d.category,
      source: d.source,
    }));
    
    await fs.mkdir('kol-data', { recursive: true });
    await fs.writeFile('kol-data/bubblemaps-wallets.json', JSON.stringify(arr, null, 2));
    await fs.writeFile('kol-data/bubblemaps-api-raw.json', JSON.stringify(this.apiResponses, null, 2));
    
    console.log(`\n[Save] ${arr.length} labeled wallets → kol-data/bubblemaps-wallets.json`);
    return arr;
  }

  async sync(arr) {
    if (arr.length === 0) {
      console.log('[Supabase] No wallets to sync');
      return;
    }
    
    const rows = arr.map(w => ({
      address: w.address,
      label: w.label,
      category: w.category,
      description: `Bubblemaps labeled wallet`,
      confidence: 0.9,
      status: 'approved',
      source: 'bubblemaps',
    }));

    console.log(`[Supabase] Syncing ${rows.length} Bubblemaps wallets...`);
    
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
    console.log('║   BUBBLEMAPS WALLET SCRAPER                                    ║');
    console.log('║   Extracting labeled wallets and connections                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      await this.scrapeSolanaPage();
      await this.extractFromApiResponses();
      
      const arr = await this.save();
      await this.sync(arr);

      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`BUBBLEMAPS: ${this.wallets.size} labeled wallets`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }
}

new BubblemapsScraper().run().catch(e => { console.error(e); process.exit(1); });
