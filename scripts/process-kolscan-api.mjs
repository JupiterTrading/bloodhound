/**
 * Process captured KOLscan API data and extract all KOL wallets
 */
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

async function main() {
  console.log('Processing KOLscan API data...\n');
  
  const raw = JSON.parse(await fs.readFile('kol-data/kolscan-api-raw.json', 'utf-8'));
  const kols = new Map();

  // Process each API response
  for (const resp of raw) {
    extractKols(resp.data, kols);
  }

  console.log(`Total unique KOLs: ${kols.size}`);
  
  // Convert to array and sort by those with names first
  const kolArray = [...kols.entries()].map(([address, data]) => ({
    address,
    name: data.name,
    twitter_handle: data.twitter,
    pnl: data.pnl,
    rank: data.rank,
  }));
  
  kolArray.sort((a, b) => {
    if (a.name && !b.name) return -1;
    if (!a.name && b.name) return 1;
    return 0;
  });

  // Save
  await fs.writeFile('kol-data/kolscan-all.json', JSON.stringify(kolArray, null, 2));
  console.log(`Saved to kol-data/kolscan-all.json`);

  // Stats
  const withName = kolArray.filter(k => k.name).length;
  const withTwitter = kolArray.filter(k => k.twitter_handle).length;
  console.log(`With name: ${withName}`);
  console.log(`With Twitter: ${withTwitter}`);

  // Sync to Supabase (only those with names)
  const toSync = kolArray.filter(k => k.name).map(k => ({
    address: k.address,
    label: k.name,
    twitter_handle: k.twitter_handle || null,
    category: 'kol',
    description: k.pnl ? `KOLscan trader - PnL: ${k.pnl}` : 'KOLscan trader',
    confidence: 0.8,
    status: 'approved',
    source: 'kolscan_api',
  }));

  console.log(`\nSyncing ${toSync.length} KOLs to Supabase...`);
  
  let success = 0;
  for (let i = 0; i < toSync.length; i += 50) {
    const batch = toSync.slice(i, i + 50);
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
      if (res.ok) success += batch.length;
    } catch {}
    
    if ((i + 50) % 500 === 0) console.log(`  Progress: ${i + 50}/${toSync.length}`);
  }
  
  console.log(`Synced: ${success}/${toSync.length}`);
}

function extractKols(data, kols, depth = 0) {
  if (depth > 10 || !data) return;
  
  if (Array.isArray(data)) {
    for (const item of data) extractKols(item, kols, depth + 1);
    return;
  }
  
  if (typeof data !== 'object') return;

  // Check for leaderboard entries
  if (data.leaderboard && Array.isArray(data.leaderboard)) {
    for (const entry of data.leaderboard) {
      const addr = entry.wallet_address;
      if (addr && addr.length >= 32 && addr.length <= 44) {
        if (!kols.has(addr)) {
          kols.set(addr, {
            name: entry.name || entry.display_name || entry.username,
            twitter: entry.twitter || entry.twitter_handle,
            pnl: entry.pnl || entry.realized_pnl,
            rank: entry.rank,
          });
        }
      }
    }
  }

  // Check for direct wallet entries
  const addr = data.wallet_address || data.address || data.wallet;
  if (addr && typeof addr === 'string' && addr.length >= 32 && addr.length <= 44) {
    if (!kols.has(addr)) {
      kols.set(addr, {
        name: data.name || data.display_name || data.username,
        twitter: data.twitter || data.twitter_handle,
        pnl: data.pnl || data.realized_pnl,
        rank: data.rank,
      });
    }
  }

  // Recurse
  for (const key of Object.keys(data)) {
    if (key !== 'leaderboard') {
      extractKols(data[key], kols, depth + 1);
    }
  }
}

main().catch(console.error);
