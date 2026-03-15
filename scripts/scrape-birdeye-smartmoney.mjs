/**
 * BLOODHOUND — Birdeye Smart Money Scraper
 * Extracts smart money wallet addresses from Birdeye token pages
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const sleep = ms => new Promise(r => setTimeout(r, ms));

class BirdeyeSmartMoneyScraper {
  constructor() {
    this.wallets = new Map();
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('[Birdeye] Launching browser...');
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async scrapeSmartMoneyPage() {
    console.log('\n[Birdeye] Loading Smart Money page...');
    
    await this.page.goto('https://birdeye.so/find-gems?type=smartMoney', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    await sleep(5000);

    // Click "VIEW SMART MONEY" if present
    try {
      await this.page.click('button:has-text("VIEW SMART MONEY")', { timeout: 5000 });
      await sleep(3000);
    } catch {}

    // Get token links with smart money
    const tokenLinks = await this.page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/solana/token/"]').forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.includes('entry_type=SmartMoney')) {
          links.push(href);
        }
      });
      return [...new Set(links)].slice(0, 10);
    });

    console.log(`  Found ${tokenLinks.length} tokens with smart money`);

    // Visit each token page to extract wallet addresses
    for (const link of tokenLinks) {
      await this.scrapeTokenPage(link);
    }
  }

  async scrapeTokenPage(tokenPath) {
    const url = tokenPath.startsWith('http') ? tokenPath : `https://birdeye.so${tokenPath}`;
    console.log(`\n  [Token] ${url.slice(0, 70)}...`);

    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await sleep(3000);

      // Extract wallet addresses from the page
      const walletData = await this.page.evaluate(() => {
        const wallets = [];
        
        // Find wallet analyzer links
        document.querySelectorAll('a[href*="/wallet-analyzer/"]').forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/wallet-analyzer\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (match) {
            wallets.push({
              address: match[1],
              source: 'birdeye_smartmoney'
            });
          }
        });

        // Also check for Solscan wallet links
        document.querySelectorAll('a[href*="solscan.io/address/"]').forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/address\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (match) {
            wallets.push({
              address: match[1],
              source: 'birdeye_solscan'
            });
          }
        });

        return wallets;
      });

      // Add to collection
      for (const w of walletData) {
        if (!this.wallets.has(w.address)) {
          this.wallets.set(w.address, {
            source: w.source,
            category: 'profitable_trader'
          });
        }
      }

      console.log(`    Found ${walletData.length} wallets, total: ${this.wallets.size}`);

    } catch (err) {
      console.warn(`    Error: ${err.message.slice(0, 50)}`);
    }
  }

  async save() {
    const arr = [...this.wallets.entries()].map(([address, d]) => ({
      address,
      source: d.source,
      category: d.category
    }));

    await fs.mkdir('kol-data', { recursive: true });
    await fs.writeFile('kol-data/birdeye-smartmoney.json', JSON.stringify(arr, null, 2));
    console.log(`\n[Save] ${arr.length} wallets → kol-data/birdeye-smartmoney.json`);
    return arr;
  }

  async sync(arr) {
    if (arr.length === 0) return;

    const rows = arr.map(w => ({
      address: w.address,
      label: `Smart Money ${w.address.slice(0,8)}`,
      category: 'profitable_trader',
      description: 'Birdeye Smart Money wallet',
      confidence: 0.85,
      status: 'approved',
      source: 'birdeye',
    }));

    console.log(`[Supabase] Syncing ${rows.length} Birdeye wallets...`);

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
    console.log('║   BIRDEYE SMART MONEY SCRAPER                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    await this.init();

    try {
      await this.scrapeSmartMoneyPage();
      const arr = await this.save();
      await this.sync(arr);

      console.log('\n══════════════════════════════════════════════════════════════════');
      console.log(`BIRDEYE: ${this.wallets.size} smart money wallets`);
      console.log('══════════════════════════════════════════════════════════════════');

    } finally {
      await this.browser.close();
    }
  }
}

new BirdeyeSmartMoneyScraper().run().catch(console.error);
