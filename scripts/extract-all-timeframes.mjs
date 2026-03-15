/**
 * BLOODHOUND — Comprehensive Extraction (All Timeframes)
 * Connects to your Chrome, extracts wallets across all timeframes
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import readline from 'readline';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q) => new Promise(r => rl.question(q, r));

const allExtracted = {
  axiomGlobal: [],
  axiomKols: [],
  gmgnSmartMoney: []
};

async function extractWallets(page) {
  return await page.evaluate(() => {
    const results = [];
    
    // Find ALL links that might contain wallet addresses
    const allLinks = document.querySelectorAll('a');
    
    allLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      let wallet = null;
      
      // Match various wallet link patterns
      const patterns = [
        /\/sol\/address\/([A-Za-z0-9]{32,44})/,
        /\/address\/([A-Za-z0-9]{32,44})/,
        /solscan\.io\/account\/([A-Za-z0-9]{32,44})/,
        /solana\.fm\/address\/([A-Za-z0-9]{32,44})/
      ];
      
      for (const pattern of patterns) {
        const match = href.match(pattern);
        if (match && match[1].length >= 32 && match[1].length <= 44) {
          wallet = match[1];
          break;
        }
      }
      
      if (!wallet) return;
      
      // Find parent row/container
      const row = link.closest('tr') || 
                  link.closest('[class*="TableRow"]') || 
                  link.closest('[class*="row"]') || 
                  link.closest('div[class*="flex"]')?.parentElement ||
                  link.parentElement?.parentElement?.parentElement;
      
      // Get name
      let name = link.textContent?.trim() || '';
      if (!name || name.includes('...') || name.length > 40 || name.length < 2) {
        // Try to find name from nearby elements
        const nameEl = row?.querySelector('span, button, [class*="name"]');
        name = nameEl?.textContent?.trim() || wallet.slice(0, 8);
      }
      name = name.replace(/\.{3,}.*$/, '').replace(/[0-9.]+$/, '').trim() || wallet.slice(0, 8);
      
      // Find Twitter
      let twitter = null;
      const twitterLink = row?.querySelector('a[href*="x.com/"], a[href*="twitter.com/"]');
      if (twitterLink) {
        const tHref = twitterLink.getAttribute('href') || '';
        const tMatch = tHref.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/);
        if (tMatch) twitter = tMatch[1];
      }
      
      // Get stats from row text
      const rowText = row?.textContent || '';
      const pnlMatch = rowText.match(/([+-]?\$?[\d,]+\.?\d*)\s*(?:SOL|K|M|%)/);
      const winMatch = rowText.match(/([\d.]+)%/);
      
      results.push({
        wallet,
        name,
        twitter,
        pnl: pnlMatch ? pnlMatch[1] : null,
        winRate: winMatch ? winMatch[1] : null
      });
    });
    
    // Dedupe
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.wallet)) return false;
      seen.add(r.wallet);
      return true;
    });
  });
}

async function scrollAndExtract(page, existingWallets = []) {
  const allWallets = [...existingWallets];
  let lastCount = allWallets.length;
  let stableCount = 0;
  
  // Scroll to top first
  await page.keyboard.press('Home');
  await page.waitForTimeout(500);
  
  while (stableCount < 15) {
    const wallets = await extractWallets(page);
    
    for (const w of wallets) {
      if (!allWallets.find(x => x.wallet === w.wallet)) {
        allWallets.push(w);
      }
    }
    
    if (allWallets.length === lastCount) {
      stableCount++;
    } else {
      stableCount = 0;
      if (allWallets.length % 20 === 0 || allWallets.length > lastCount + 5) {
        console.log(`    ${allWallets.length} unique wallets...`);
      }
    }
    lastCount = allWallets.length;
    
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(350);
  }
  
  return allWallets;
}

async function extractWithTimeframes(page, category, label, timeframes = ['1d', '7d', '30d']) {
  console.log(`\n[${label}] Starting extraction across ${timeframes.length} timeframes...`);
  
  let allWallets = [];
  
  for (const tf of timeframes) {
    console.log(`\n  [${tf}] Switch to ${tf} timeframe, then press Enter...`);
    await prompt(`    Ready for ${tf}? `);
    
    console.log(`  [${tf}] Scrolling and extracting...`);
    allWallets = await scrollAndExtract(page, allWallets);
    console.log(`  [${tf}] Total unique: ${allWallets.length}`);
  }
  
  // Add metadata
  allWallets = allWallets.map(w => ({ ...w, source: label, category }));
  
  console.log(`\n[${label}] TOTAL: ${allWallets.length} unique wallets`);
  return allWallets;
}

async function syncToSupabase(wallets, category) {
  if (!wallets.length) return;
  console.log(`\n[SYNC] Upserting ${wallets.length} ${category} wallets...`);
  
  const rows = wallets.map(w => ({
    address: w.wallet,
    label: w.name,
    category,
    description: `${w.source}${w.winRate ? ` | Win: ${w.winRate}%` : ''}${w.pnl ? ` | PnL: ${w.pnl}` : ''}`,
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
    console.log(res.ok ? `  ✓ Batch ${Math.floor(i/50)+1}/${Math.ceil(rows.length/50)}` : `  ✗ Error: ${await res.text()}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND - Full Extraction (All Timeframes)                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to your Chrome!\n');
  } catch (e) {
    console.log('✗ Could not connect. Make sure Chrome was started with --remote-debugging-port=9222');
    process.exit(1);
  }
  
  const pages = browser.contexts()[0]?.pages() || [];
  if (!pages.length) { console.log('No tabs found.'); process.exit(1); }
  
  const page = pages[0];
  console.log(`Using tab: ${await page.title()}\n`);
  
  // === AXIOM GLOBAL ===
  console.log('════════════════════════════════════════════════════════════════');
  console.log('STEP 1: AXIOM GLOBAL (Smart Money)');
  console.log('Navigate to: Axiom → Vision → Global tab');
  await prompt('Press Enter when on Global tab...');
  
  allExtracted.axiomGlobal = await extractWithTimeframes(page, 'smart_money', 'axiom_global', ['1d', '7d', '30d']);
  writeFileSync('./kol-data/axiom-global-complete.json', JSON.stringify(allExtracted.axiomGlobal, null, 2));
  console.log('  Saved to axiom-global-complete.json');
  
  // === AXIOM KOLS ===
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('STEP 2: AXIOM KOLs');
  console.log('Navigate to: Axiom → Vision → KOL tab');
  await prompt('Press Enter when on KOL tab...');
  
  allExtracted.axiomKols = await extractWithTimeframes(page, 'kol', 'axiom_kol', ['1d', '7d', '30d']);
  writeFileSync('./kol-data/axiom-kols-complete.json', JSON.stringify(allExtracted.axiomKols, null, 2));
  console.log('  Saved to axiom-kols-complete.json');
  
  // === GMGN SMART MONEY ===
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('STEP 3: GMGN SMART MONEY');
  console.log('Navigate to: GMGN → CopyTrade → Smart Money tab');
  await prompt('Press Enter when on Smart Money tab...');
  
  allExtracted.gmgnSmartMoney = await extractWithTimeframes(page, 'smart_money', 'gmgn_smart_money', ['7d', '30d']);
  writeFileSync('./kol-data/gmgn-smart-money-complete.json', JSON.stringify(allExtracted.gmgnSmartMoney, null, 2));
  console.log('  Saved to gmgn-smart-money-complete.json');
  
  // === SUMMARY ===
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('EXTRACTION COMPLETE');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  Axiom Global:     ${allExtracted.axiomGlobal.length}`);
  console.log(`  Axiom KOLs:       ${allExtracted.axiomKols.length}`);
  console.log(`  GMGN Smart Money: ${allExtracted.gmgnSmartMoney.length}`);
  const total = allExtracted.axiomGlobal.length + allExtracted.axiomKols.length + allExtracted.gmgnSmartMoney.length;
  console.log(`  ─────────────────────────`);
  console.log(`  TOTAL NEW:        ${total}`);
  
  const doSync = await prompt('\nSync all to Supabase? (y/n): ');
  if (doSync.toLowerCase() === 'y') {
    await syncToSupabase(allExtracted.axiomGlobal, 'smart_money');
    await syncToSupabase(allExtracted.axiomKols, 'kol');
    await syncToSupabase(allExtracted.gmgnSmartMoney, 'smart_money');
    console.log('\n✓ All data synced to Supabase!');
  }
  
  // Save combined file
  writeFileSync('./kol-data/all-extracted-complete.json', JSON.stringify(allExtracted, null, 2));
  console.log('\nAll data saved to all-extracted-complete.json');
  
  rl.close();
}

main().catch(console.error);
