/**
 * BLOODHOUND — Manual Navigation Extractor
 * User navigates to pages, script extracts wallet data
 * Run: node manual-extract.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import readline from 'readline';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q) => new Promise(r => rl.question(q, r));

const extracted = {
  axiomGlobal: [],
  axiomKols: [],
  gmgnSmartMoney: []
};

async function extractWallets(page) {
  return await page.evaluate(() => {
    const results = [];
    
    // Find all wallet address links (Solana addresses)
    const links = document.querySelectorAll('a[href*="/sol/address/"], a[href*="solscan.io/account/"]');
    
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      let wallet = null;
      
      // Extract from GMGN style links
      const gmgnMatch = href.match(/\/sol\/address\/([A-Za-z0-9]{32,})/);
      if (gmgnMatch) wallet = gmgnMatch[1];
      
      // Extract from Solscan links
      const solscanMatch = href.match(/solscan\.io\/account\/([A-Za-z0-9]{32,})/);
      if (solscanMatch) wallet = solscanMatch[1];
      
      if (!wallet || wallet.length < 32) return;
      
      // Try to find name/label
      const row = link.closest('tr') || link.closest('[class*="row"]') || link.parentElement?.parentElement;
      let name = link.textContent?.trim() || '';
      if (name.includes('...') || name.length > 50) {
        name = wallet.slice(0, 8);
      }
      
      // Find Twitter if exists
      const twitterLink = row?.querySelector('a[href*="x.com/"], a[href*="twitter.com/"]');
      let twitter = null;
      if (twitterLink) {
        const tHref = twitterLink.getAttribute('href') || '';
        twitter = tHref.split(/x\.com\/|twitter\.com\//)[1]?.split(/[/?]/)[0];
      }
      
      // Extract any visible stats
      const text = row?.textContent || '';
      const pnlMatch = text.match(/[+-]?\$?([\d,]+\.?\d*)\s*(?:SOL|K|M)?/);
      const winMatch = text.match(/([\d.]+)%/);
      
      results.push({
        wallet,
        name: name.replace(/\.{3,}.*$/, '').trim() || wallet.slice(0, 8),
        twitter,
        pnl: pnlMatch ? pnlMatch[0] : null,
        winRate: winMatch ? winMatch[1] : null
      });
    });
    
    // Dedupe by wallet
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.wallet)) return false;
      seen.add(r.wallet);
      return true;
    });
  });
}

async function scrollAndExtract(page, category, label) {
  console.log(`\n[${label}] Extracting wallets...`);
  
  const allWallets = [];
  let lastCount = 0;
  let stableCount = 0;
  
  while (stableCount < 10) {
    const wallets = await extractWallets(page);
    
    for (const w of wallets) {
      const exists = allWallets.find(x => x.wallet === w.wallet);
      if (!exists) {
        allWallets.push({ ...w, source: label, category });
      }
    }
    
    if (allWallets.length === lastCount) {
      stableCount++;
    } else {
      stableCount = 0;
      console.log(`  Found ${allWallets.length} wallets...`);
    }
    lastCount = allWallets.length;
    
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(500);
  }
  
  console.log(`[${label}] Total: ${allWallets.length} wallets`);
  return allWallets;
}

async function syncToSupabase(wallets, category) {
  if (wallets.length === 0) return;
  
  console.log(`\n[SYNC] Upserting ${wallets.length} ${category} wallets...`);
  
  const rows = wallets.map(w => ({
    address: w.wallet,
    label: w.name,
    category: category,
    description: `${w.source}. ${w.winRate ? `Win rate: ${w.winRate}%` : ''} ${w.pnl || ''}`.trim(),
    twitter_handle: w.twitter || null,
    confidence: 0.90,
    status: 'approved',
    source: w.source,
  }));
  
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
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
      console.log(`  ✓ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rows.length/batchSize)}`);
    } else {
      console.log(`  ✗ Error: ${await res.text()}`);
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND - Manual Navigation Extractor                      ║');
  console.log('║   Navigate to each page, press Enter to extract                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  // Start at a neutral page
  await page.goto('https://google.com');
  
  // === AXIOM GLOBAL ===
  console.log('\n═══ STEP 1: AXIOM GLOBAL (Smart Money) ═══');
  console.log('Navigate to Axiom → Vision → Global tab');
  await prompt('Press Enter when ready to extract Axiom Global...');
  
  extracted.axiomGlobal = await scrollAndExtract(page, 'smart_money', 'axiom_global');
  writeFileSync('./kol-data/axiom-global-complete.json', JSON.stringify(extracted.axiomGlobal, null, 2));
  console.log('  Saved to axiom-global-complete.json');
  
  // === AXIOM KOLS ===
  console.log('\n═══ STEP 2: AXIOM KOLs ═══');
  console.log('Navigate to Axiom → Vision → KOL tab');
  await prompt('Press Enter when ready to extract Axiom KOLs...');
  
  extracted.axiomKols = await scrollAndExtract(page, 'kol', 'axiom_kol');
  writeFileSync('./kol-data/axiom-kols-complete.json', JSON.stringify(extracted.axiomKols, null, 2));
  console.log('  Saved to axiom-kols-complete.json');
  
  // === GMGN SMART MONEY ===
  console.log('\n═══ STEP 3: GMGN SMART MONEY ═══');
  console.log('Navigate to GMGN → CopyTrade → Smart Money tab');
  await prompt('Press Enter when ready to extract GMGN Smart Money...');
  
  extracted.gmgnSmartMoney = await scrollAndExtract(page, 'smart_money', 'gmgn_smart_money');
  writeFileSync('./kol-data/gmgn-smart-money-complete.json', JSON.stringify(extracted.gmgnSmartMoney, null, 2));
  console.log('  Saved to gmgn-smart-money-complete.json');
  
  // === SUMMARY ===
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('EXTRACTION COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Axiom Global:     ${extracted.axiomGlobal.length}`);
  console.log(`  Axiom KOLs:       ${extracted.axiomKols.length}`);
  console.log(`  GMGN Smart Money: ${extracted.gmgnSmartMoney.length}`);
  console.log(`  TOTAL NEW:        ${extracted.axiomGlobal.length + extracted.axiomKols.length + extracted.gmgnSmartMoney.length}`);
  
  // Sync to Supabase
  const doSync = await prompt('\nSync all to Supabase? (y/n): ');
  if (doSync.toLowerCase() === 'y') {
    await syncToSupabase(extracted.axiomGlobal, 'smart_money');
    await syncToSupabase(extracted.axiomKols, 'kol');
    await syncToSupabase(extracted.gmgnSmartMoney, 'smart_money');
    console.log('\n✓ All data synced to Supabase!');
  }
  
  await browser.close();
  rl.close();
}

main().catch(console.error);
