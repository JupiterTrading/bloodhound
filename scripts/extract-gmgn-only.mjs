/**
 * BLOODHOUND — GMGN KOL + Smart Money Extraction
 * Direct browser extraction - user already logged in
 * Run: node extract-gmgn-only.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const allKols = [];
const smartMoney = [];

async function extractGmgnKols(page) {
  console.log('\n[GMGN] Navigating to CopyTrade KOL tab...');
  
  await page.goto('https://gmgn.ai/sol/trade');
  await page.waitForTimeout(4000);
  
  // Click KOL tab
  try {
    await page.click('text=KOL');
    await page.waitForTimeout(3000);
    console.log('  Clicked KOL tab');
  } catch (e) {
    console.log('  KOL tab may already be selected');
  }
  
  console.log('  Scrolling and extracting KOLs...');
  
  let lastCount = 0;
  let stableCount = 0;
  
  while (stableCount < 15) {
    // Extract all wallet links with Twitter handles
    const kols = await page.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll('table tbody tr, [class*="TableRow"], [class*="row"]');
      
      rows.forEach(row => {
        // Find wallet address link
        const walletLink = row.querySelector('a[href*="/sol/address/"]');
        if (!walletLink) return;
        
        const href = walletLink.getAttribute('href');
        const walletMatch = href.match(/\/sol\/address\/([A-Za-z0-9]{32,})/);
        if (!walletMatch) return;
        
        const wallet = walletMatch[1];
        
        // Find Twitter link
        const twitterLink = row.querySelector('a[href*="x.com/"]');
        let twitter = null;
        if (twitterLink) {
          const tHref = twitterLink.getAttribute('href');
          twitter = tHref.split('x.com/')[1]?.split('/')[0]?.split('?')[0];
        }
        
        // Get name from wallet link text or nearby element
        let name = walletLink.textContent?.trim();
        if (!name || name.includes('...')) {
          const nameEl = row.querySelector('a[href*="/sol/address/"] + * a, button');
          name = nameEl?.textContent?.trim() || wallet.slice(0, 8);
        }
        
        // Get stats if visible
        const text = row.textContent || '';
        const pnlMatch = text.match(/\+\$?([\d,]+\.?\d*[KM]?)/);
        const winMatch = text.match(/([\d.]+)%/);
        
        results.push({
          wallet,
          name: name.replace(/\.{3,}.*$/, '').trim(),
          twitter,
          pnl: pnlMatch ? pnlMatch[1] : null,
          winRate: winMatch ? winMatch[1] : null
        });
      });
      
      return results;
    });
    
    // Add unique KOLs
    for (const kol of kols) {
      if (!kol.wallet || kol.wallet.length < 32) continue;
      const exists = allKols.find(k => k.wallet === kol.wallet);
      if (!exists) {
        allKols.push({ ...kol, source: 'gmgn_kol', category: 'kol' });
      }
    }
    
    if (allKols.length === lastCount) {
      stableCount++;
    } else {
      stableCount = 0;
      console.log(`  Found ${allKols.length} KOLs...`);
    }
    lastCount = allKols.length;
    
    // Scroll
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(600);
  }
  
  console.log(`[GMGN] Total KOLs extracted: ${allKols.length}`);
  return allKols;
}

async function extractSmartMoney(page) {
  console.log('\n[GMGN] Switching to Smart Money tab...');
  
  // Click Smart Money tab
  try {
    await page.click('text=Smart Money');
    await page.waitForTimeout(3000);
    console.log('  Clicked Smart Money tab');
  } catch (e) {
    console.log('  Could not find Smart Money tab, trying alternative...');
    try {
      await page.click('button:has-text("Smart")');
      await page.waitForTimeout(3000);
    } catch (e2) {
      console.log('  Smart Money tab not found');
      return [];
    }
  }
  
  console.log('  Scrolling and extracting Smart Money wallets...');
  
  let lastCount = 0;
  let stableCount = 0;
  
  while (stableCount < 15) {
    const wallets = await page.evaluate(() => {
      const results = [];
      const walletLinks = document.querySelectorAll('a[href*="/sol/address/"]');
      
      walletLinks.forEach(link => {
        const href = link.getAttribute('href');
        const walletMatch = href.match(/\/sol\/address\/([A-Za-z0-9]{32,})/);
        if (!walletMatch) return;
        
        const wallet = walletMatch[1];
        let name = link.textContent?.trim() || wallet.slice(0, 8);
        name = name.replace(/\.{3,}.*$/, '').trim();
        
        results.push({ wallet, name });
      });
      
      return results;
    });
    
    for (const w of wallets) {
      if (!w.wallet || w.wallet.length < 32) continue;
      const exists = smartMoney.find(k => k.wallet === w.wallet);
      // Also check not already a KOL
      const isKol = allKols.find(k => k.wallet === w.wallet);
      if (!exists && !isKol) {
        smartMoney.push({ ...w, source: 'gmgn_smart_money', category: 'smart_money' });
      }
    }
    
    if (smartMoney.length === lastCount) {
      stableCount++;
    } else {
      stableCount = 0;
      console.log(`  Found ${smartMoney.length} Smart Money wallets...`);
    }
    lastCount = smartMoney.length;
    
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(600);
  }
  
  console.log(`[GMGN] Total Smart Money wallets: ${smartMoney.length}`);
  return smartMoney;
}

async function syncToSupabase(wallets, category) {
  if (wallets.length === 0) return;
  
  console.log(`\n[SYNC] Upserting ${wallets.length} ${category} wallets...`);
  
  const rows = wallets.map(w => ({
    address: w.wallet,
    label: w.name,
    category: category,
    description: `GMGN ${category}. ${w.winRate ? `Win rate: ${w.winRate}%` : ''} ${w.pnl ? `PnL: ${w.pnl}` : ''}`.trim(),
    twitter_handle: w.twitter || null,
    confidence: 0.95,
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
  console.log('║   BLOODHOUND - GMGN KOL + Smart Money Extraction                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Go to GMGN - user should already be logged in
  console.log('Opening GMGN...');
  await page.goto('https://gmgn.ai/sol/trade');
  await page.waitForTimeout(3000);
  
  console.log('\n⚠️  Verify you are logged in, then press Enter to start extraction...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  // Extract KOLs
  await extractGmgnKols(page);
  writeFileSync('./kol-data/gmgn-kols-complete.json', JSON.stringify(allKols, null, 2));
  console.log('  Saved to gmgn-kols-complete.json');
  
  // Extract Smart Money
  await extractSmartMoney(page);
  writeFileSync('./kol-data/gmgn-smart-money.json', JSON.stringify(smartMoney, null, 2));
  console.log('  Saved to gmgn-smart-money.json');
  
  // Summary
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('EXTRACTION COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  GMGN KOLs:        ${allKols.length}`);
  console.log(`  Smart Money:      ${smartMoney.length}`);
  console.log(`  TOTAL:            ${allKols.length + smartMoney.length}`);
  
  // Sync to Supabase
  await syncToSupabase(allKols, 'kol');
  await syncToSupabase(smartMoney, 'smart_money');
  
  console.log('\n✓ All GMGN data synced to Supabase!');
  
  await browser.close();
}

main().catch(console.error);
