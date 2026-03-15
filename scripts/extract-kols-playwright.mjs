/**
 * BLOODHOUND — Direct Browser KOL Extraction
 * Uses Playwright with visible browser window for reliable extraction
 * Run: node extract-kols-playwright.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

// Storage for extracted data
const allKols = {
  axiom: [],
  gmgn: [],
  smartMoney: []
};

async function extractAxiomKols(page) {
  console.log('\n[AXIOM] Extracting KOLs from Vision page...');
  
  await page.goto('https://axiom.trade/vision');
  await page.waitForTimeout(5000);
  
  // Click KOL tab if not selected
  try {
    await page.click('button:has-text("KOL")');
    await page.waitForTimeout(2000);
  } catch (e) {}
  
  const timeframes = ['1d', '3d', '7d', '14d', '30d'];
  
  for (const tf of timeframes) {
    console.log(`  [${tf}] Extracting...`);
    
    // Click timeframe button
    try {
      await page.click(`button:has-text("${tf}")`);
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log(`    Could not click ${tf} button`);
      continue;
    }
    
    // Scroll and extract KOLs
    let lastCount = 0;
    let attempts = 0;
    
    while (attempts < 20) {
      // Extract visible KOLs
      const kols = await page.evaluate(() => {
        const results = [];
        // Find all Twitter links (each KOL has one)
        const twitterLinks = document.querySelectorAll('a[href*="x.com/"]');
        
        twitterLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (!href || !href.includes('x.com/')) return;
          
          const twitter = href.split('x.com/')[1]?.split('/')[0]?.split('?')[0];
          if (!twitter) return;
          
          // Find the parent row to get name and stats
          const row = link.closest('[class*="row"]') || link.parentElement?.parentElement?.parentElement;
          if (!row) return;
          
          // Try to find the name button near the twitter link
          const nameBtn = row.querySelector('button');
          const name = nameBtn?.textContent?.trim() || twitter;
          
          // Look for PNL value
          const pnlMatch = row.textContent?.match(/\+?([\d,]+\.?\d*)\s*SOL/);
          const pnl = pnlMatch ? parseFloat(pnlMatch[1].replace(',', '')) : null;
          
          // Look for win rate
          const winMatch = row.textContent?.match(/([\d.]+)%/);
          const winRate = winMatch ? parseFloat(winMatch[1]) : null;
          
          results.push({ name, twitter, pnl, winRate });
        });
        
        return results;
      });
      
      // Add unique KOLs
      for (const kol of kols) {
        const exists = allKols.axiom.find(k => k.twitter === kol.twitter);
        if (!exists && kol.twitter) {
          allKols.axiom.push({ ...kol, timeframe: tf, source: 'axiom_vision' });
        }
      }
      
      if (allKols.axiom.length === lastCount) {
        attempts++;
      } else {
        attempts = 0;
        lastCount = allKols.axiom.length;
      }
      
      // Scroll down
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(500);
    }
    
    console.log(`    Found ${allKols.axiom.length} unique KOLs so far`);
  }
  
  console.log(`[AXIOM] Total unique KOLs: ${allKols.axiom.length}`);
  return allKols.axiom;
}

async function extractGmgnKols(page) {
  console.log('\n[GMGN] Extracting KOLs from CopyTrade page...');
  
  await page.goto('https://gmgn.ai/sol/trade');
  await page.waitForTimeout(5000);
  
  // Click KOL tab
  try {
    const kolTab = await page.locator('button:has-text("KOL"), [role="tab"]:has-text("KOL")');
    await kolTab.first().click();
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('  Could not find KOL tab, may already be selected');
  }
  
  let lastCount = 0;
  let attempts = 0;
  
  while (attempts < 30) {
    // Extract KOLs with wallet addresses
    const kols = await page.evaluate(() => {
      const results = [];
      
      // Find all wallet address links
      const walletLinks = document.querySelectorAll('a[href*="/sol/address/"]');
      
      walletLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const walletMatch = href.match(/\/sol\/address\/([A-Za-z0-9]+)/);
        if (!walletMatch) return;
        
        const wallet = walletMatch[1];
        if (wallet.length < 32) return; // Not a valid Solana address
        
        // Find Twitter link nearby
        const row = link.closest('tr') || link.closest('[class*="row"]') || link.parentElement?.parentElement;
        const twitterLink = row?.querySelector('a[href*="x.com/"]');
        const twitter = twitterLink?.href?.split('x.com/')[1]?.split('/')[0]?.split('?')[0];
        
        // Get name
        const name = link.textContent?.trim() || wallet.slice(0, 8);
        
        if (wallet && wallet.length >= 32) {
          results.push({ name, wallet, twitter: twitter || null });
        }
      });
      
      return results;
    });
    
    // Add unique KOLs
    for (const kol of kols) {
      const exists = allKols.gmgn.find(k => k.wallet === kol.wallet);
      if (!exists && kol.wallet) {
        allKols.gmgn.push({ ...kol, source: 'gmgn_kol' });
      }
    }
    
    if (allKols.gmgn.length === lastCount) {
      attempts++;
    } else {
      attempts = 0;
      lastCount = allKols.gmgn.length;
      console.log(`  Found ${allKols.gmgn.length} KOLs...`);
    }
    
    // Scroll within table
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(800);
  }
  
  console.log(`[GMGN] Total KOLs with wallets: ${allKols.gmgn.length}`);
  return allKols.gmgn;
}

async function extractGmgnSmartMoney(page) {
  console.log('\n[GMGN] Extracting Smart Money wallets...');
  
  // Click Smart Money tab
  try {
    const smTab = await page.locator('button:has-text("Smart Money"), [role="tab"]:has-text("Smart")');
    await smTab.first().click();
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('  Could not find Smart Money tab');
    return [];
  }
  
  let lastCount = 0;
  let attempts = 0;
  
  while (attempts < 30) {
    const wallets = await page.evaluate(() => {
      const results = [];
      const walletLinks = document.querySelectorAll('a[href*="/sol/address/"]');
      
      walletLinks.forEach(link => {
        const href = link.getAttribute('href');
        const walletMatch = href?.match(/\/sol\/address\/([A-Za-z0-9]+)/);
        if (!walletMatch) return;
        
        const wallet = walletMatch[1];
        if (wallet.length < 32) return;
        
        const name = link.textContent?.trim() || wallet.slice(0, 8);
        results.push({ wallet, name });
      });
      
      return results;
    });
    
    for (const w of wallets) {
      const exists = allKols.smartMoney.find(k => k.wallet === w.wallet);
      if (!exists && w.wallet) {
        allKols.smartMoney.push({ ...w, source: 'gmgn_smart_money', category: 'smart_money' });
      }
    }
    
    if (allKols.smartMoney.length === lastCount) {
      attempts++;
    } else {
      attempts = 0;
      lastCount = allKols.smartMoney.length;
      console.log(`  Found ${allKols.smartMoney.length} smart money wallets...`);
    }
    
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(800);
  }
  
  console.log(`[GMGN] Total Smart Money wallets: ${allKols.smartMoney.length}`);
  return allKols.smartMoney;
}

async function syncToSupabase(wallets, category = 'kol') {
  console.log(`\n[SYNC] Upserting ${wallets.length} ${category} wallets to Supabase...`);
  
  const rows = wallets.map(w => ({
    address: w.wallet || `PENDING_${w.twitter?.toUpperCase() || w.name?.toUpperCase()}`,
    label: w.name,
    category: category,
    description: `${w.source} - ${category === 'kol' ? 'KOL trader' : 'Smart money wallet'}`,
    twitter_handle: w.twitter || null,
    confidence: w.wallet ? 0.95 : 0.80,
    status: 'approved',
    source: w.source,
  }));
  
  // Batch upsert
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
      console.log(`  ✓ Synced batch ${Math.floor(i/batchSize) + 1}`);
    } else {
      console.log(`  ✗ Error: ${await res.text()}`);
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND - Direct Browser KOL Extraction                    ║');
  console.log('║   Browser will open - please log into Axiom & GMGN first        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Launch visible browser
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Step 1: Manual login
  console.log('Opening Axiom for login...');
  await page.goto('https://axiom.trade');
  console.log('\n⚠️  Please log into AXIOM, then press Enter to continue...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  console.log('Opening GMGN for login...');
  await page.goto('https://gmgn.ai');
  console.log('\n⚠️  Please log into GMGN, then press Enter to continue...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  // Step 2: Extract Axiom KOLs
  await extractAxiomKols(page);
  
  // Save intermediate results
  writeFileSync('./kol-data/axiom-kols-complete.json', JSON.stringify(allKols.axiom, null, 2));
  console.log('Saved Axiom KOLs to axiom-kols-complete.json');
  
  // Step 3: Extract GMGN KOLs
  await extractGmgnKols(page);
  
  // Save intermediate results
  writeFileSync('./kol-data/gmgn-kols-complete.json', JSON.stringify(allKols.gmgn, null, 2));
  console.log('Saved GMGN KOLs to gmgn-kols-complete.json');
  
  // Step 4: Extract Smart Money
  await extractGmgnSmartMoney(page);
  
  // Save all results
  writeFileSync('./kol-data/smart-money-complete.json', JSON.stringify(allKols.smartMoney, null, 2));
  writeFileSync('./kol-data/all-extracted-kols.json', JSON.stringify(allKols, null, 2));
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('EXTRACTION COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Axiom KOLs:     ${allKols.axiom.length}`);
  console.log(`  GMGN KOLs:      ${allKols.gmgn.length}`);
  console.log(`  Smart Money:    ${allKols.smartMoney.length}`);
  console.log(`  TOTAL:          ${allKols.axiom.length + allKols.gmgn.length + allKols.smartMoney.length}`);
  
  // Step 5: Sync to Supabase
  console.log('\n[SYNC] Syncing to Supabase...');
  
  // Sync Axiom KOLs (Twitter only, no wallet yet)
  if (allKols.axiom.length > 0) {
    await syncToSupabase(allKols.axiom, 'kol');
  }
  
  // Sync GMGN KOLs (with wallets)
  if (allKols.gmgn.length > 0) {
    await syncToSupabase(allKols.gmgn, 'kol');
  }
  
  // Sync Smart Money (with wallets, different category)
  if (allKols.smartMoney.length > 0) {
    await syncToSupabase(allKols.smartMoney, 'smart_money');
  }
  
  console.log('\n✓ All data synced to Supabase!');
  
  await browser.close();
}

main().catch(console.error);
