/**
 * BLOODHOUND — Complete KOLscan Data Extraction
 * Extracts: wallet, name, Twitter, Telegram, pfp from embedded Next.js JSON
 */
import fs from 'fs/promises';
import { chromium } from 'playwright';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrapeAllLeaderboards() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   KOLSCAN COMPLETE DATA EXTRACTION                             ║');
  console.log('║   Wallet + Name + Twitter + Telegram                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const urls = [
    'https://kolscan.io/leaderboard',
    'https://kolscan.io/leaderboard?tab=daily',
    'https://kolscan.io/leaderboard?tab=weekly', 
    'https://kolscan.io/leaderboard?tab=monthly',
  ];

  let allHtml = '';
  
  for (const url of urls) {
    console.log(`Loading ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(3000);
    
    // Scroll to load all content
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => {
        const main = document.querySelector('.mainContent');
        if (main) main.scrollTop = main.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      });
      await sleep(1000);
    }
    
    allHtml += await page.content();
  }
  
  await browser.close();
  return allHtml;
}

function extractKols(html) {
  const kols = new Map();
  
  // Find all wallet entries with their full data
  const walletPattern = /\\"wallet_address\\":\\"([1-9A-HJ-NP-Za-km-z]{32,44})\\"/g;
  let match;
  
  while ((match = walletPattern.exec(html)) !== null) {
    const address = match[1];
    const startIdx = match.index;
    const context = html.slice(startIdx, startIdx + 600);
    
    // Extract name
    const nameMatch = context.match(/\\"name\\":\\"([^\\]*?)\\"/);
    const name = nameMatch ? nameMatch[1] : null;
    
    // Extract Twitter
    const twitterMatch = context.match(/\\"twitter\\":\\"(https?:[^\\]+)\\"/);
    let twitter = null;
    if (twitterMatch) {
      const handleMatch = twitterMatch[1].match(/x\.com\/(\w+)/);
      if (handleMatch) twitter = handleMatch[1].toLowerCase();
    }
    
    // Extract Telegram
    const telegramMatch = context.match(/\\"telegram\\":\\"(https?:[^\\]+)\\"/);
    let telegram = null;
    if (telegramMatch) {
      const tgMatch = telegramMatch[1].match(/t\.me\/(\w+)/);
      if (tgMatch) telegram = tgMatch[1].toLowerCase();
    }
    
    // Extract PFP
    const pfpMatch = context.match(/\\"pfp\\":\\"([^\\]+)\\"/);
    const pfp = pfpMatch ? pfpMatch[1] : null;
    
    if (!kols.has(address) && (name || twitter)) {
      kols.set(address, { name, twitter, telegram, pfp });
    } else if (kols.has(address)) {
      // Merge data - prefer non-null values
      const existing = kols.get(address);
      if (!existing.twitter && twitter) existing.twitter = twitter;
      if (!existing.telegram && telegram) existing.telegram = telegram;
      if (!existing.pfp && pfp) existing.pfp = pfp;
      kols.set(address, existing);
    }
  }
  
  return kols;
}

async function syncToSupabase(kols) {
  const rows = [...kols.entries()].map(([address, d]) => ({
    address,
    label: d.name || `KOL ${address.slice(0,8)}`,
    twitter_handle: d.twitter || null,
    telegram_handle: d.telegram || null,
    category: 'kol',
    description: 'KOLscan verified trader',
    confidence: d.twitter ? 0.95 : 0.8,
    status: 'approved',
    source: 'kolscan',
  }));

  console.log(`\n[Supabase] Syncing ${rows.length} KOLs...`);
  
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
  return rows;
}

async function main() {
  // Scrape fresh data from all leaderboards
  const html = await scrapeAllLeaderboards();
  
  // Extract KOL data
  const kols = extractKols(html);
  
  console.log(`\nExtracted ${kols.size} unique KOLs`);
  
  const withTwitter = [...kols.values()].filter(k => k.twitter).length;
  const withTelegram = [...kols.values()].filter(k => k.telegram).length;
  
  console.log(`With Twitter: ${withTwitter}`);
  console.log(`With Telegram: ${withTelegram}`);
  
  // Print samples with Telegram
  console.log('\nSample KOLs with Telegram:');
  let count = 0;
  for (const [addr, data] of kols) {
    if (data.telegram && count < 10) {
      console.log(`  ${addr.slice(0,12)}... @${(data.twitter||'-').padEnd(16)} t.me/${data.telegram}`);
      count++;
    }
  }
  
  // Save to file
  const arr = [...kols.entries()].map(([address, d]) => ({
    address, name: d.name, twitter_handle: d.twitter, telegram_handle: d.telegram, pfp: d.pfp
  }));
  await fs.mkdir('kol-data', { recursive: true });
  await fs.writeFile('kol-data/kolscan-complete.json', JSON.stringify(arr, null, 2));
  console.log(`\nSaved to kol-data/kolscan-complete.json`);
  
  // Sync to Supabase
  await syncToSupabase(kols);
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`FINAL: ${kols.size} KOLs, ${withTwitter} Twitter, ${withTelegram} Telegram`);
  console.log('══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
