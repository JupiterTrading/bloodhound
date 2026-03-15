/**
 * BLOODHOUND — Extract Axiom wallet addresses from Firecrawl browser session
 * Run this while Firecrawl browser is open on Axiom
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const wallets = new Map();

// Solana address regex (32-44 base58 chars)
const SOL_ADDR_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// Token addresses to check for top traders
const TRENDING_TOKENS = [
  '2TduCAriQckRzNtZzegr1QXYAMKjHE8b2PyyTDqjpump', // BILLIONS
  'HF8dnkkCwqo34W8iDHexHgqez5NE8txe8evKxTCSHkYK',
  'CdoQKournsTERPHJwJowB7DrS2o4tvBywASHPuuumaow',
];

async function runFirecrawl(cmd) {
  try {
    const { stdout } = await execAsync(`npx firecrawl browser "${cmd}"`, { 
      cwd: process.cwd(),
      timeout: 60000 
    });
    return stdout;
  } catch (e) {
    console.log(`  Command error: ${e.message.slice(0, 50)}`);
    return '';
  }
}

async function extractWalletsFromSnapshot() {
  const snapshot = await runFirecrawl('snapshot');
  
  // Extract Solscan wallet links
  const solscanMatches = snapshot.matchAll(/solscan\.io\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/g);
  for (const m of solscanMatches) {
    if (!wallets.has(m[1])) {
      wallets.set(m[1], { source: 'axiom_alpha', category: 'profitable_trader' });
    }
  }

  // Extract any standalone Solana addresses
  const addrMatches = snapshot.matchAll(SOL_ADDR_REGEX);
  for (const m of addrMatches) {
    // Filter out common non-wallet patterns
    if (m[0].length >= 32 && m[0].length <= 44 && !m[0].includes('pump')) {
      if (!wallets.has(m[0])) {
        wallets.set(m[0], { source: 'axiom_snapshot', category: 'trader' });
      }
    }
  }

  return wallets.size;
}

async function navigateAndExtract(url) {
  console.log(`\n  Navigating to: ${url.slice(0, 60)}...`);
  await runFirecrawl(`open ${url}`);
  await new Promise(r => setTimeout(r, 5000));
  
  const before = wallets.size;
  await extractWalletsFromSnapshot();
  const found = wallets.size - before;
  console.log(`    Found ${found} new wallets (total: ${wallets.size})`);
}

async function clickTopTraders() {
  console.log('  Looking for Top Traders tab...');
  const snapshot = await runFirecrawl('snapshot');
  
  // Find Top Traders button reference
  const match = snapshot.match(/button "Top Traders".*?\[ref=(e\d+)\]/);
  if (match) {
    console.log(`  Clicking Top Traders (${match[1]})...`);
    await runFirecrawl(`click @${match[1]}`);
    await new Promise(r => setTimeout(r, 3000));
    await extractWalletsFromSnapshot();
  }
}

async function save() {
  const arr = [...wallets.entries()].map(([address, d]) => ({
    address,
    source: d.source,
    category: d.category
  }));

  await fs.mkdir('kol-data', { recursive: true });
  await fs.writeFile('kol-data/axiom-wallets.json', JSON.stringify(arr, null, 2));
  console.log(`\n[Save] ${arr.length} wallets → kol-data/axiom-wallets.json`);
  return arr;
}

async function sync(arr) {
  if (arr.length === 0) return;

  const rows = arr.map(w => ({
    address: w.address,
    label: `Axiom Trader ${w.address.slice(0,8)}`,
    category: w.category === 'profitable_trader' ? 'profitable_trader' : 'kol',
    description: 'Axiom top trader wallet',
    confidence: 0.85,
    status: 'approved',
    source: 'axiom',
  }));

  console.log(`[Supabase] Syncing ${rows.length} Axiom wallets...`);

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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   AXIOM WALLET EXTRACTOR                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Extract from current page
  console.log('\n[1/4] Extracting from current page...');
  await extractWalletsFromSnapshot();
  console.log(`  Found ${wallets.size} wallets`);

  // Click Top Traders if available
  console.log('\n[2/4] Checking Top Traders tab...');
  await clickTopTraders();

  // Navigate to Alpha page for more tokens
  console.log('\n[3/4] Checking Alpha page...');
  await navigateAndExtract('https://axiom.trade/alpha?chain=sol');
  await clickTopTraders();

  // Check PnL leaderboard
  console.log('\n[4/4] Checking PnL leaderboard...');
  await runFirecrawl('snapshot'); // Get current state
  const snapshot = await runFirecrawl('snapshot');
  const pnlMatch = snapshot.match(/button " PnL".*?\[ref=(e\d+)\]/);
  if (pnlMatch) {
    await runFirecrawl(`click @${pnlMatch[1]}`);
    await new Promise(r => setTimeout(r, 3000));
    await extractWalletsFromSnapshot();
  }

  const arr = await save();
  await sync(arr);

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`AXIOM: ${wallets.size} unique wallets extracted`);
  console.log('══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
