/**
 * BLOODHOUND — Solscan Labeled Wallets Scraper
 * 
 * Extracts labeled wallets from Solscan:
 * - Exchanges (Binance, Coinbase, etc.)
 * - Launchpads
 * - DEX protocols
 * - Known entities
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Known exchange and protocol wallets to verify
const KNOWN_ENTITIES = [
  { name: 'Binance', searchTerms: ['binance'] },
  { name: 'Coinbase', searchTerms: ['coinbase'] },
  { name: 'Kraken', searchTerms: ['kraken'] },
  { name: 'OKX', searchTerms: ['okx', 'okex'] },
  { name: 'Bybit', searchTerms: ['bybit'] },
  { name: 'Raydium', searchTerms: ['raydium'] },
  { name: 'Jupiter', searchTerms: ['jupiter'] },
  { name: 'Orca', searchTerms: ['orca'] },
  { name: 'Marinade', searchTerms: ['marinade'] },
  { name: 'Phantom', searchTerms: ['phantom'] },
];

class SolscanLabelScraper {
  constructor() {
    this.wallets = new Map();
    this.browser = null;
    this.page = null;
    this.apiResponses = [];
  }

  async init() {
    console.log('[Solscan] Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('label') || url.includes('account')) {
        try {
          const json = await response.json();
          this.apiResponses.push({ url, data: json });
        } catch {}
      }
    });
  }

  async scrapeLabelsPage() {
    console.log('\n[Solscan] Loading labels/accounts page...');
    
    const pages = [
      'https://solscan.io/account-labels',
      'https://solscan.io/analytics/defi',
    ];
    
    for (const url of pages) {
      try {
        console.log(`  Loading ${url}...`);
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        await sleep(3000);
        
        // Scroll to load content
        for (let i = 0; i < 5; i++) {
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
        }
        
        // Extract labeled wallets
        const walletData = await this.page.evaluate(() => {
          const wallets = [];
          
          // Look for labeled addresses
          document.querySelectorAll('a[href*="/account/"]').forEach(link => {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
            if (!match) return;
            
            const address = match[1];
            const container = link.closest('tr, div, [class*="row"]') || link.parentElement;
            
            // Look for label text
            let label = null;
            const labelEl = container?.querySelector('[class*="label"], [class*="tag"], [class*="name"]');
            if (labelEl) {
              label = labelEl.textContent?.trim();
            }
            
            // Also check link text
            if (!label) {
              const linkText = link.textContent?.trim();
              if (linkText && linkText.length < 40 && !linkText.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
                label = linkText;
              }
            }
            
            if (label && address) {
              // Determine category
              const labelLower = label.toLowerCase();
              let category = 'known_figure';
              
              if (labelLower.includes('exchange') || labelLower.includes('binance') || 
                  labelLower.includes('coinbase') || labelLower.includes('kraken') ||
                  labelLower.includes('okx') || labelLower.includes('bybit')) {
                category = 'exchange';
              } else if (labelLower.includes('raydium') || labelLower.includes('jupiter') ||
                         labelLower.includes('orca') || labelLower.includes('protocol') ||
                         labelLower.includes('dex') || labelLower.includes('defi')) {
                category = 'protocol_team';
              } else if (labelLower.includes('launchpad') || labelLower.includes('pump')) {
                category = 'protocol_team';
              }
              
              wallets.push({ address, label, category });
            }
          });
          
          return wallets;
        });
        
        for (const w of walletData) {
          if (!this.wallets.has(w.address)) {
            this.wallets.set(w.address, {
              label: w.label,
              category: w.category,
              source: 'solscan',
            });
            console.log(`    [+] ${w.label.slice(0,30)} - ${w.address.slice(0,12)}...`);
          }
        }
        
      } catch (err) {
        console.warn(`  Error on ${url}: ${err.message}`);
      }
    }
  }

  async searchKnownEntities() {
    console.log('\n[Solscan] Searching for known entities...');
    
    for (const entity of KNOWN_ENTITIES) {
      for (const term of entity.searchTerms) {
        try {
          const url = `https://solscan.io/search?q=${term}`;
          await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          await sleep(2000);
          
          const wallets = await this.page.evaluate((entityName) => {
            const results = [];
            document.querySelectorAll('a[href*="/account/"]').forEach(link => {
              const href = link.getAttribute('href') || '';
              const match = href.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
              if (match) {
                results.push({ 
                  address: match[1], 
                  label: entityName,
                  category: 'exchange'
                });
              }
            });
            return results.slice(0, 5);
          }, entity.name);
          
          for (const w of wallets) {
            if (!this.wallets.has(w.address)) {
              this.wallets.set(w.address, {
                label: w.label,
                category: w.category,
                source: 'solscan_search',
              });
              console.log(`    [+] ${w.label} - ${w.address.slice(0,12)}...`);
            }
          }
          
        } catch (err) {
          // Continue
        }
      }
    }
  }

  async extractFromApiResponses() {
    console.log(`\n[API] Processing ${this.apiResponses.length} captured API responses...`);
    
    let found = 0;
    for (const resp of this.apiResponses) {
      found += this.extractFromJson(resp.data);
    }
    console.log(`  Found ${found} wallets from API data`);
  }

  extractFromJson(data, depth = 0) {
    if (depth > 8 || !data) return 0;
    let found = 0;
    
    if (Array.isArray(data)) {
      for (const item of data) found += this.extractFromJson(item, depth + 1);
      return found;
    }
    
    if (typeof data !== 'object') return 0;
    
    const address = data.address || data.account || data.pubkey;
    const label = data.label || data.name || data.tag;
    
    if (address && typeof address === 'string' && address.length >= 32 && label) {
      if (!this.wallets.has(address)) {
        this.wallets.set(address, { label, category: 'known_figure', source: 'solscan_api' });
        found++;
      }
    }
    
    for (const key of Object.keys(data)) found += this.extractFromJson(data[key], depth + 1);
    return found;
  }

  async save() {
    const arr = [...this.wallets.entries()].map(([address, d]) => ({
      address, label: d.label, category: d.category, source: d.source
    }));
    
    await fs.mkdir('kol-data', { recursive: true });
    await fs.writeFile('kol-data/solscan-labels.json', JSON.stringify(arr, null, 2));
    console.log(`\n[Save] ${arr.length} labeled wallets → kol-data/solscan-labels.json`);
    return arr;
  }

  async sync(arr) {
    if (arr.length === 0) return;
    
    const rows = arr.map(w => ({
      address: w.address,
      label: w.label,
      category: w.category,
      description: `Solscan labeled wallet`,
      confidence: 0.95,
      status: 'approved',
      source: 'solscan',
    }));

    console.log(`[Supabase] Syncing ${rows.length} Solscan wallets...`);
    
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
    console.log('║   SOLSCAN LABELED WALLETS SCRAPER                              ║');
    console.log('║   Exchanges, Protocols, Launchpads                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      await this.scrapeLabelsPage();
      await this.searchKnownEntities();
      await this.extractFromApiResponses();
      
      const arr = await this.save();
      await this.sync(arr);

      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`SOLSCAN: ${this.wallets.size} labeled wallets`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }
}

new SolscanLabelScraper().run().catch(e => { console.error(e); process.exit(1); });
