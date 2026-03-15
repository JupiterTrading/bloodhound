/**
 * BLOODHOUND — Extract from YOUR Chrome Browser
 * Connects to your existing Chrome with remote debugging
 * 
 * STEP 1: Close Chrome completely
 * STEP 2: Run this in a NEW terminal:
 *   chrome --remote-debugging-port=9222
 * STEP 3: Log into Axiom and GMGN in that Chrome window
 * STEP 4: Run this script: node extract-from-chrome.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import readline from 'readline';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q) => new Promise(r => rl.question(q, r));

const extracted = { axiomGlobal: [], axiomKols: [], gmgnSmartMoney: [] };

async function extractWallets(page) {
  return await page.evaluate(() => {
    const results = [];
    const links = document.querySelectorAll('a[href*="/sol/address/"], a[href*="solscan.io/account/"], a[href*="/address/"]');
    
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      let wallet = null;
      
      const match = href.match(/(?:\/sol\/address\/|\/address\/|solscan\.io\/account\/)([A-Za-z0-9]{32,})/);
      if (match) wallet = match[1];
      if (!wallet || wallet.length < 32 || wallet.length > 50) return;
      
      const row = link.closest('tr') || link.closest('[class*="row"]') || link.closest('div[class*="flex"]') || link.parentElement?.parentElement;
      let name = link.textContent?.trim() || wallet.slice(0, 8);
      if (name.includes('...') || name.length > 50) name = wallet.slice(0, 8);
      
      const twitterLink = row?.querySelector('a[href*="x.com/"], a[href*="twitter.com/"]');
      let twitter = null;
      if (twitterLink) {
        const tHref = twitterLink.getAttribute('href') || '';
        twitter = tHref.split(/x\.com\/|twitter\.com\//)[1]?.split(/[/?]/)[0];
      }
      
      results.push({ wallet, name: name.replace(/\.{3,}.*$/, '').trim(), twitter });
    });
    
    const seen = new Set();
    return results.filter(r => { if (seen.has(r.wallet)) return false; seen.add(r.wallet); return true; });
  });
}

async function scrollAndExtract(page, category, label) {
  console.log(`\n[${label}] Extracting wallets...`);
  const allWallets = [];
  let lastCount = 0, stableCount = 0;
  
  while (stableCount < 12) {
    const wallets = await extractWallets(page);
    for (const w of wallets) {
      if (!allWallets.find(x => x.wallet === w.wallet)) {
        allWallets.push({ ...w, source: label, category });
      }
    }
    
    if (allWallets.length === lastCount) stableCount++;
    else { stableCount = 0; console.log(`  Found ${allWallets.length} wallets...`); }
    lastCount = allWallets.length;
    
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(400);
  }
  
  console.log(`[${label}] Total: ${allWallets.length} wallets`);
  return allWallets;
}

async function syncToSupabase(wallets, category) {
  if (!wallets.length) return;
  console.log(`\n[SYNC] Upserting ${wallets.length} ${category} wallets...`);
  
  const rows = wallets.map(w => ({
    address: w.wallet,
    label: w.name,
    category,
    description: `${w.source}`,
    twitter_handle: w.twitter || null,
    confidence: 0.90,
    status: 'approved',
    source: w.source,
  }));
  
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/known_wallets?on_conflict=address`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    console.log(res.ok ? `  ✓ Batch ${Math.floor(i/50)+1}` : `  ✗ Error`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND - Extract from YOUR Chrome                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Connecting to Chrome on port 9222...');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to Chrome!\n');
  } catch (e) {
    console.log('✗ Could not connect to Chrome.');
    console.log('\nTo fix this:');
    console.log('  1. Close ALL Chrome windows');
    console.log('  2. Open a terminal and run:');
    console.log('     chrome --remote-debugging-port=9222');
    console.log('  3. Log into Axiom and GMGN in that Chrome');
    console.log('  4. Run this script again');
    process.exit(1);
  }
  
  const contexts = browser.contexts();
  const pages = contexts[0]?.pages() || [];
  
  if (pages.length === 0) {
    console.log('No pages found. Open Axiom/GMGN in Chrome first.');
    process.exit(1);
  }
  
  console.log(`Found ${pages.length} tab(s). Using active tab.\n`);
  const page = pages[0];
  
  // === AXIOM GLOBAL ===
  console.log('═══ STEP 1: AXIOM GLOBAL ═══');
  console.log('In Chrome: Go to Axiom → Vision → Global tab');
  await prompt('Press Enter when ready...');
  extracted.axiomGlobal = await scrollAndExtract(page, 'smart_money', 'axiom_global');
  writeFileSync('./kol-data/axiom-global-complete.json', JSON.stringify(extracted.axiomGlobal, null, 2));
  
  // === AXIOM KOLS ===
  console.log('\n═══ STEP 2: AXIOM KOLs ═══');
  console.log('In Chrome: Go to Axiom → Vision → KOL tab');
  await prompt('Press Enter when ready...');
  extracted.axiomKols = await scrollAndExtract(page, 'kol', 'axiom_kol');
  writeFileSync('./kol-data/axiom-kols-complete.json', JSON.stringify(extracted.axiomKols, null, 2));
  
  // === GMGN SMART MONEY ===
  console.log('\n═══ STEP 3: GMGN SMART MONEY ═══');
  console.log('In Chrome: Go to GMGN → CopyTrade → Smart Money tab');
  await prompt('Press Enter when ready...');
  extracted.gmgnSmartMoney = await scrollAndExtract(page, 'smart_money', 'gmgn_smart_money');
  writeFileSync('./kol-data/gmgn-smart-money-complete.json', JSON.stringify(extracted.gmgnSmartMoney, null, 2));
  
  // === SUMMARY ===
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('EXTRACTION COMPLETE');
  console.log(`  Axiom Global:     ${extracted.axiomGlobal.length}`);
  console.log(`  Axiom KOLs:       ${extracted.axiomKols.length}`);
  console.log(`  GMGN Smart Money: ${extracted.gmgnSmartMoney.length}`);
  console.log(`  TOTAL:            ${extracted.axiomGlobal.length + extracted.axiomKols.length + extracted.gmgnSmartMoney.length}`);
  
  const doSync = await prompt('\nSync to Supabase? (y/n): ');
  if (doSync.toLowerCase() === 'y') {
    await syncToSupabase(extracted.axiomGlobal, 'smart_money');
    await syncToSupabase(extracted.axiomKols, 'kol');
    await syncToSupabase(extracted.gmgnSmartMoney, 'smart_money');
    console.log('\n✓ All synced!');
  }
  
  rl.close();
}

main().catch(console.error);
