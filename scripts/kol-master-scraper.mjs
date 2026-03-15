/**
 * BLOODHOUND — Master KOL Data Aggregator
 * 
 * Combines all KOL data sources into a unified database:
 *   1. Axiom.trade KOL labels (WebSocket/DOM scraping)
 *   2. Pump.fun profile Twitter links
 *   3. Trending token trader analysis
 *   4. X/Twitter bio wallet scanning
 *   5. Existing Dune/KOLscan data
 * 
 * Usage:
 *   node scripts/kol-master-scraper.mjs
 *   node scripts/kol-master-scraper.mjs --source axiom
 *   node scripts/kol-master-scraper.mjs --source pumpfun
 *   node scripts/kol-master-scraper.mjs --source all
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';
const HELIUS_KEY = '60d6158d-429c-4d41-b7b4-1176b54228a6';

const OUTPUT_DIR = 'scripts/kol-data';
const MASTER_FILE = 'scripts/kol-data/master-kols.json';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =============================================================================
// KOL Database Manager
// =============================================================================
class KolDatabase {
  constructor() {
    this.kols = new Map();
    this.stats = {
      total: 0,
      withTwitter: 0,
      withName: 0,
      sources: {},
    };
  }

  add(address, data, source) {
    if (!address || address.length < 32 || address.length > 44) return;

    const existing = this.kols.get(address);
    if (existing) {
      // Merge data, prefer non-null values
      this.kols.set(address, {
        name: data.name || existing.name,
        twitter_handle: this.cleanTwitter(data.twitter_handle) || existing.twitter_handle,
        bio: data.bio || existing.bio,
        confidence: Math.max(data.confidence || 0, existing.confidence || 0),
        sources: [...new Set([...(existing.sources || []), source])],
        last_updated: new Date().toISOString(),
      });
    } else {
      this.kols.set(address, {
        name: data.name || null,
        twitter_handle: this.cleanTwitter(data.twitter_handle),
        bio: data.bio || null,
        confidence: data.confidence || 0.5,
        sources: [source],
        first_seen: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      });
    }

    this.stats.sources[source] = (this.stats.sources[source] || 0) + 1;
  }

  cleanTwitter(handle) {
    if (!handle) return null;
    let clean = handle.toString().trim();
    clean = clean.replace(/^@/, '');
    clean = clean.replace(/https?:\/\/(twitter|x)\.com\//, '');
    clean = clean.split('/')[0].split('?')[0];
    return clean.length > 0 && clean.length < 30 ? clean.toLowerCase() : null;
  }

  getStats() {
    this.stats.total = this.kols.size;
    this.stats.withTwitter = [...this.kols.values()].filter(k => k.twitter_handle).length;
    this.stats.withName = [...this.kols.values()].filter(k => k.name).length;
    return this.stats;
  }

  toArray() {
    return Array.from(this.kols.entries()).map(([address, data]) => ({
      address,
      ...data,
    }));
  }

  async load() {
    try {
      const data = await fs.readFile(MASTER_FILE, 'utf-8');
      const kols = JSON.parse(data);
      for (const kol of kols) {
        this.kols.set(kol.address, {
          name: kol.name,
          twitter_handle: kol.twitter_handle,
          bio: kol.bio,
          confidence: kol.confidence,
          sources: kol.sources || [],
          first_seen: kol.first_seen,
          last_updated: kol.last_updated,
        });
      }
      console.log(`[DB] Loaded ${this.kols.size} existing KOLs`);
    } catch {
      console.log('[DB] No existing data, starting fresh');
    }
  }

  async save() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(MASTER_FILE, JSON.stringify(this.toArray(), null, 2));
    console.log(`[DB] Saved ${this.kols.size} KOLs to ${MASTER_FILE}`);
  }
}

// =============================================================================
// Source: Axiom.trade
// =============================================================================
async function scrapeAxiom(db, browser) {
  console.log('\n========== AXIOM.TRADE ==========');
  
  const page = await browser.newPage();
  const wsData = [];

  // Intercept WebSocket
  page.on('websocket', ws => {
    ws.on('framereceived', frame => {
      try {
        const data = JSON.parse(frame.payload);
        wsData.push(data);
        extractKolsFromAxiomData(data, db);
      } catch {}
    });
  });

  // Intercept API responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') && (url.includes('trade') || url.includes('kol') || url.includes('user'))) {
      try {
        const json = await response.json();
        extractKolsFromAxiomData(json, db);
      } catch {}
    }
  });

  // Visit trending tokens
  const trendingTokens = await getTrendingTokens();
  
  for (const token of trendingTokens.slice(0, 5)) {
    try {
      console.log(`[Axiom] Scanning ${token.slice(0, 12)}...`);
      await page.goto(`https://axiom.trade/meme/${token}?chain=sol`, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });
      await sleep(3000);
      
      // Scroll to load more content
      await page.evaluate(() => window.scrollBy(0, 1000));
      await sleep(2000);

      // Extract from DOM
      const domKols = await page.evaluate(() => {
        const results = [];
        
        // Look for trader labels in trade feed
        document.querySelectorAll('[class*="trade"], [class*="activity"], [class*="feed"]').forEach(row => {
          const text = row.textContent || '';
          
          // Look for wallet addresses
          const walletMatch = text.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
          
          // Look for @handles
          const handleMatch = text.match(/@(\w{1,20})/);
          
          // Look for KOL labels (usually styled differently)
          const labelEl = row.querySelector('[class*="label"], [class*="name"], [class*="kol"]');
          const label = labelEl?.textContent?.trim();

          if (walletMatch) {
            results.push({
              address: walletMatch[1],
              name: label || null,
              twitter_handle: handleMatch ? handleMatch[1] : null,
            });
          }
        });

        // Look for any tooltip/hover data
        document.querySelectorAll('[data-wallet], [data-address]').forEach(el => {
          const wallet = el.getAttribute('data-wallet') || el.getAttribute('data-address');
          const name = el.getAttribute('data-name') || el.getAttribute('title');
          if (wallet) {
            results.push({ address: wallet, name, twitter_handle: null });
          }
        });

        return results;
      });

      domKols.forEach(kol => {
        if (kol.address) {
          db.add(kol.address, kol, 'axiom_dom');
        }
      });

    } catch (error) {
      console.warn(`[Axiom] Error: ${error.message}`);
    }
  }

  // Save raw WS data for analysis
  if (wsData.length > 0) {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(`${OUTPUT_DIR}/axiom-ws-raw.json`, JSON.stringify(wsData.slice(0, 200), null, 2));
    console.log(`[Axiom] Saved ${wsData.length} WebSocket messages for analysis`);
  }

  await page.close();
  console.log(`[Axiom] Complete. DB size: ${db.kols.size}`);
}

function extractKolsFromAxiomData(data, db) {
  if (!data || typeof data !== 'object') return;

  // Handle arrays
  if (Array.isArray(data)) {
    data.forEach(item => extractKolsFromAxiomData(item, db));
    return;
  }

  // Look for wallet/trader fields
  const address = data.wallet || data.address || data.trader || data.user || data.pubkey;
  const name = data.name || data.label || data.displayName || data.username;
  const twitter = data.twitter || data.twitter_handle || data.handle || data.x_handle;

  if (address && typeof address === 'string' && address.length >= 32 && address.length <= 44) {
    if (name || twitter) {
      db.add(address, { name, twitter_handle: twitter }, 'axiom_ws');
    }
  }

  // Recurse into nested objects
  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'object') {
      extractKolsFromAxiomData(data[key], db);
    }
  }
}

// =============================================================================
// Source: Pump.fun Profiles
// =============================================================================
async function scrapePumpFun(db, browser) {
  console.log('\n========== PUMP.FUN PROFILES ==========');
  
  const page = await browser.newPage();
  
  // Get wallets that need Twitter enrichment
  const walletsToCheck = [...db.kols.entries()]
    .filter(([_, data]) => !data.twitter_handle && data.name)
    .map(([addr]) => addr)
    .slice(0, 50);

  // Also add some from Supabase
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/known_wallets?select=address&twitter_handle=is.null&limit=50`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        }
      }
    );
    if (res.ok) {
      const wallets = await res.json();
      wallets.forEach(w => {
        if (!walletsToCheck.includes(w.address)) {
          walletsToCheck.push(w.address);
        }
      });
    }
  } catch {}

  console.log(`[Pump.fun] Checking ${walletsToCheck.length} profiles`);

  let found = 0;
  for (const address of walletsToCheck.slice(0, 30)) {
    try {
      await page.goto(`https://pump.fun/profile/${address}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
      await sleep(1500);

      const profile = await page.evaluate(() => {
        const result = { name: null, twitter_handle: null, bio: null };

        // Twitter link
        const twitterLink = document.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
        if (twitterLink) {
          const href = twitterLink.getAttribute('href') || '';
          const match = href.match(/(?:twitter|x)\.com\/(@?[\w]+)/);
          if (match) result.twitter_handle = match[1].replace('@', '');
        }

        // Name
        const nameEl = document.querySelector('h1, h2, [class*="name"], [class*="username"]');
        if (nameEl) {
          const text = nameEl.textContent?.trim();
          if (text && text.length > 1 && text.length < 50) {
            result.name = text;
          }
        }

        // Bio
        const bioEl = document.querySelector('[class*="bio"], [class*="description"]');
        if (bioEl) result.bio = bioEl.textContent?.trim().slice(0, 200);

        // Check if 404
        if (document.body.textContent?.includes('not found')) return null;

        return result;
      });

      if (profile) {
        db.add(address, profile, 'pumpfun_profile');
        if (profile.twitter_handle) {
          found++;
          console.log(`[+] ${address.slice(0, 8)}... → @${profile.twitter_handle}`);
        }
      }

      await sleep(1000 + Math.random() * 1000);
    } catch {}
  }

  await page.close();
  console.log(`[Pump.fun] Found ${found} new Twitter handles`);
}

// =============================================================================
// Source: DexScreener Trending + Helius Enrichment
// =============================================================================
async function scrapeTrendingTraders(db) {
  console.log('\n========== TRENDING TRADERS ==========');
  
  // Get trending tokens
  const tokens = await getTrendingTokens();
  console.log(`[Trending] Analyzing ${tokens.length} tokens`);

  for (const token of tokens.slice(0, 10)) {
    try {
      // Get recent transactions
      const txRes = await fetch(
        `https://api.helius.xyz/v0/addresses/${token}/transactions?api-key=${HELIUS_KEY}&limit=30`
      );
      
      if (!txRes.ok) continue;
      
      const txs = await txRes.json();
      const traders = new Set();
      
      txs.forEach(tx => {
        if (tx.feePayer) traders.add(tx.feePayer);
        tx.accountData?.forEach(acc => {
          if (acc.nativeBalanceChange && Math.abs(acc.nativeBalanceChange) > 100000000) {
            traders.add(acc.account);
          }
        });
      });

      // Enrich traders with Helius names
      for (const trader of [...traders].slice(0, 5)) {
        try {
          const nameRes = await fetch(
            `https://api.helius.xyz/v0/addresses/${trader}/names?api-key=${HELIUS_KEY}`
          );
          if (nameRes.ok) {
            const names = await nameRes.json();
            if (names.length > 0) {
              db.add(trader, { name: names[0], confidence: 0.7 }, 'helius_identity');
            }
          }
        } catch {}
        await sleep(100);
      }
    } catch {}
  }
}

async function getTrendingTokens() {
  const tokens = [];
  
  try {
    // DexScreener boosted
    const boostRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    if (boostRes.ok) {
      const data = await boostRes.json();
      (data || [])
        .filter(t => t.chainId === 'solana')
        .slice(0, 10)
        .forEach(t => tokens.push(t.tokenAddress));
    }

    // DexScreener profiles
    const profileRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
    if (profileRes.ok) {
      const data = await profileRes.json();
      (data || [])
        .filter(t => t.chainId === 'solana')
        .slice(0, 10)
        .forEach(t => {
          if (!tokens.includes(t.tokenAddress)) {
            tokens.push(t.tokenAddress);
          }
        });
    }
  } catch {}

  return tokens;
}

// =============================================================================
// Supabase Sync
// =============================================================================
async function syncToSupabase(db) {
  console.log('\n========== SUPABASE SYNC ==========');
  
  const kols = db.toArray().filter(k => k.name || k.twitter_handle);
  console.log(`[Supabase] Syncing ${kols.length} KOLs`);

  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < kols.length; i += 25) {
    const batch = kols.slice(i, i + 25).map(k => ({
      address: k.address,
      label: k.name || `KOL ${k.address.slice(0, 8)}`,
      twitter_handle: k.twitter_handle,
      category: 'kol',
      description: k.bio || `KOL discovered via ${k.sources?.join(', ') || 'scraping'}`,
      confidence: k.confidence || 0.6,
      status: 'approved',
      source: k.sources?.join(',') || 'scraper',
    }));

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

      if (res.ok) {
        upserted += batch.length;
      } else {
        errors++;
        const err = await res.text();
        if (i === 0) console.warn(`[Supabase] Error: ${err.slice(0, 100)}`);
      }
    } catch (error) {
      errors++;
    }
  }

  console.log(`[Supabase] Upserted: ${upserted}, Errors: ${errors}`);
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND KOL MASTER SCRAPER            ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const sourceArg = args.indexOf('--source');
  const source = sourceArg !== -1 ? args[sourceArg + 1] : 'all';

  const db = new KolDatabase();
  await db.load();

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    if (source === 'all' || source === 'axiom') {
      await scrapeAxiom(db, browser);
    }

    if (source === 'all' || source === 'pumpfun') {
      await scrapePumpFun(db, browser);
    }

    if (source === 'all' || source === 'trending') {
      await scrapeTrendingTraders(db);
    }

    // Save local database
    await db.save();

    // Sync to Supabase
    await syncToSupabase(db);

    // Print stats
    const stats = db.getStats();
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   RESULTS                                  ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`Total KOLs:      ${stats.total}`);
    console.log(`With Twitter:    ${stats.withTwitter}`);
    console.log(`With Name:       ${stats.withName}`);
    console.log('\nBy source:');
    Object.entries(stats.sources).forEach(([src, count]) => {
      console.log(`  ${src}: ${count}`);
    });

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
