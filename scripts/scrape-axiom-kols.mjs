/**
 * BLOODHOUND — Axiom KOL Data Extractor
 * 
 * Extracts KOL wallet addresses, names, and Twitter handles from Axiom.trade
 * by monitoring their WebSocket streams and API endpoints.
 * 
 * Usage:
 *   node scripts/scrape-axiom-kols.mjs
 *   node scripts/scrape-axiom-kols.mjs --token <mint_address>
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const OUTPUT_FILE = 'scripts/axiom-kols.json';
const AXIOM_BASE = 'https://axiom.trade';

// Popular tokens to scan for KOL activity
const SAMPLE_TOKENS = [
  '3LHYwhm61rVwPxHJwnkV7zB7tmknAoa6scHXX4nCZfQY', // From user's example
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

class AxiomKolExtractor {
  constructor() {
    this.kols = new Map(); // address -> { name, twitter_handle, first_seen_token }
    this.browser = null;
    this.page = null;
    this.wsMessages = [];
  }

  async init() {
    console.log('[Axiom] Launching browser...');
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Intercept WebSocket messages
    this.page.on('websocket', ws => {
      console.log(`[WS] Connected: ${ws.url()}`);
      ws.on('framereceived', frame => {
        try {
          const data = JSON.parse(frame.payload);
          this.processWsMessage(data);
        } catch { /* binary or non-JSON */ }
      });
    });

    // Intercept XHR/Fetch responses
    this.page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('kol') || url.includes('trader')) {
        try {
          const json = await response.json();
          this.processApiResponse(url, json);
        } catch { /* not JSON */ }
      }
    });
  }

  processWsMessage(data) {
    // Look for KOL-related events in WebSocket messages
    // Axiom typically sends trade events with trader info
    if (data.type === 'trade' || data.type === 'swap' || data.event === 'trade') {
      const trader = data.trader || data.wallet || data.user;
      if (trader) {
        this.extractKolFromEvent(trader, data);
      }
    }

    // Handle array of events
    if (Array.isArray(data)) {
      data.forEach(event => this.processWsMessage(event));
    }

    // Handle nested data structures
    if (data.data && typeof data.data === 'object') {
      this.processWsMessage(data.data);
    }

    // Store raw messages for analysis
    this.wsMessages.push(data);
  }

  processApiResponse(url, json) {
    // Extract KOL data from API responses
    if (Array.isArray(json)) {
      json.forEach(item => this.extractKolFromItem(item));
    } else if (json.data && Array.isArray(json.data)) {
      json.data.forEach(item => this.extractKolFromItem(item));
    } else if (json.traders || json.kols || json.users) {
      const list = json.traders || json.kols || json.users;
      list.forEach(item => this.extractKolFromItem(item));
    } else {
      this.extractKolFromItem(json);
    }
  }

  extractKolFromEvent(trader, event) {
    // trader could be an object or just an address string
    if (typeof trader === 'string' && trader.length >= 32 && trader.length <= 44) {
      // Just an address, check if we have label info
      const label = event.label || event.name || event.displayName || event.kol_name;
      const twitter = event.twitter || event.twitter_handle || event.x_handle || event.handle;
      if (label || twitter) {
        this.addKol(trader, label, twitter, event.token || 'unknown');
      }
    } else if (typeof trader === 'object') {
      this.extractKolFromItem(trader);
    }
  }

  extractKolFromItem(item) {
    if (!item || typeof item !== 'object') return;

    // Look for address field
    const address = item.address || item.wallet || item.walletAddress || 
                    item.trader || item.user || item.pubkey || item.publicKey;
    if (!address || address.length < 32 || address.length > 44) return;

    // Look for name/label
    const name = item.name || item.label || item.displayName || item.kol_name ||
                 item.username || item.trader_name || item.alias;

    // Look for Twitter handle
    const twitter = item.twitter || item.twitter_handle || item.twitterHandle ||
                    item.x_handle || item.xHandle || item.handle || item.social?.twitter;

    if (name || twitter) {
      this.addKol(address, name, twitter, item.token || 'api');
    }
  }

  addKol(address, name, twitter, source) {
    const existing = this.kols.get(address);
    if (existing) {
      // Merge: prefer non-null values
      this.kols.set(address, {
        name: existing.name || name,
        twitter_handle: existing.twitter_handle || this.cleanTwitterHandle(twitter),
        first_seen: existing.first_seen,
        sources: [...new Set([...existing.sources, source])],
      });
    } else {
      this.kols.set(address, {
        name: name || null,
        twitter_handle: this.cleanTwitterHandle(twitter),
        first_seen: new Date().toISOString(),
        sources: [source],
      });
      console.log(`[KOL+] ${address.slice(0, 8)}... | ${name || '?'} | @${twitter || '?'}`);
    }
  }

  cleanTwitterHandle(handle) {
    if (!handle) return null;
    // Remove @ prefix, URLs, etc.
    let clean = handle.toString().trim();
    clean = clean.replace(/^@/, '');
    clean = clean.replace(/https?:\/\/(twitter|x)\.com\//, '');
    clean = clean.split('/')[0].split('?')[0];
    return clean.length > 0 && clean.length < 50 ? clean : null;
  }

  async scrapeTokenPage(tokenMint) {
    const url = `${AXIOM_BASE}/meme/${tokenMint}?chain=sol`;
    console.log(`\n[Axiom] Visiting ${url}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for content to load
      await sleep(3000);
      
      // Scroll to trigger lazy-loaded content
      await this.page.evaluate(() => window.scrollBy(0, 500));
      await sleep(1000);
      await this.page.evaluate(() => window.scrollBy(0, 500));
      await sleep(1000);

      // Extract any visible KOL labels from DOM
      const domKols = await this.page.evaluate(() => {
        const results = [];
        
        // Look for trade entries with KOL labels
        // Axiom typically shows trader info in trade lists
        const tradeRows = document.querySelectorAll('[class*="trade"], [class*="transaction"], [class*="swap"]');
        tradeRows.forEach(row => {
          const addressEl = row.querySelector('[class*="address"], [class*="wallet"]');
          const labelEl = row.querySelector('[class*="kol"], [class*="label"], [class*="name"]');
          const twitterEl = row.querySelector('[class*="twitter"], a[href*="twitter.com"], a[href*="x.com"]');
          
          if (addressEl) {
            const address = addressEl.textContent?.trim() || addressEl.getAttribute('data-address');
            const label = labelEl?.textContent?.trim();
            let twitter = twitterEl?.getAttribute('href') || twitterEl?.textContent?.trim();
            
            if (address && address.length >= 32) {
              results.push({ address, label, twitter });
            }
          }
        });

        // Look for tooltip/hover data that might contain KOL info
        const tooltips = document.querySelectorAll('[data-kol], [data-trader], [title*="@"]');
        tooltips.forEach(el => {
          const data = el.getAttribute('data-kol') || el.getAttribute('data-trader');
          if (data) {
            try {
              const parsed = JSON.parse(data);
              results.push(parsed);
            } catch {
              results.push({ raw: data });
            }
          }
        });

        return results;
      });

      domKols.forEach(kol => {
        if (kol.address) {
          this.addKol(kol.address, kol.label, kol.twitter, tokenMint);
        }
      });

      console.log(`[Axiom] Page scan complete. Total KOLs: ${this.kols.size}`);
      
    } catch (error) {
      console.warn(`[Axiom] Error on ${tokenMint}: ${error.message}`);
    }
  }

  async analyzeNetworkPatterns() {
    // Analyze captured WebSocket messages to understand data structure
    console.log(`\n[Analysis] Captured ${this.wsMessages.length} WebSocket messages`);
    
    const patterns = new Map();
    this.wsMessages.forEach(msg => {
      const type = msg.type || msg.event || msg.action || 'unknown';
      patterns.set(type, (patterns.get(type) || 0) + 1);
    });

    console.log('[Analysis] Message types:');
    patterns.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });

    // Save raw messages for manual inspection
    await fs.writeFile(
      'scripts/axiom-ws-samples.json',
      JSON.stringify(this.wsMessages.slice(0, 100), null, 2)
    );
    console.log('[Analysis] Sample messages saved to scripts/axiom-ws-samples.json');
  }

  async run(tokens = SAMPLE_TOKENS) {
    await this.init();

    for (const token of tokens) {
      await this.scrapeTokenPage(token);
      await sleep(2000); // Be gentle with rate limits
    }

    await this.analyzeNetworkPatterns();
    await this.save();
    await this.browser.close();
  }

  async save() {
    const kolArray = Array.from(this.kols.entries()).map(([address, data]) => ({
      address,
      ...data,
    }));

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(kolArray, null, 2));
    console.log(`\n[Axiom] Saved ${kolArray.length} KOLs to ${OUTPUT_FILE}`);

    // Print summary
    const withTwitter = kolArray.filter(k => k.twitter_handle).length;
    const withName = kolArray.filter(k => k.name).length;
    console.log(`  With Twitter: ${withTwitter}`);
    console.log(`  With Name: ${withName}`);
  }
}

// CLI
const args = process.argv.slice(2);
const tokenArg = args.indexOf('--token');
const tokens = tokenArg !== -1 && args[tokenArg + 1] 
  ? [args[tokenArg + 1]] 
  : SAMPLE_TOKENS;

const extractor = new AxiomKolExtractor();
extractor.run(tokens).catch(err => {
  console.error('[Axiom] Fatal error:', err);
  process.exit(1);
});
