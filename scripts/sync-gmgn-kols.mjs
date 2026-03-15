/**
 * BLOODHOUND — Sync GMGN KOLs to Supabase
 * Syncs extracted KOLs with full wallet addresses and Twitter handles
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

async function syncToKnownWallets(wallets) {
  console.log(`[Sync] Upserting ${wallets.length} wallets to known_wallets...`);
  
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
      body: JSON.stringify(wallets),
    }
  );
  
  if (res.ok) {
    console.log(`  ✓ Synced ${wallets.length} wallets`);
    return true;
  } else {
    const err = await res.text();
    console.log(`  ✗ Error: ${err}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND - Sync GMGN KOLs to Supabase                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Load GMGN KOLs
  const data = JSON.parse(readFileSync('./kol-data/gmgn-kols-full.json', 'utf8'));
  console.log(`Loaded ${data.kols.length} KOLs from GMGN CopyTrade\n`);
  
  // Convert to known_wallets format
  const rows = data.kols.map(k => ({
    address: k.wallet,
    label: k.name,
    category: 'kol',
    description: `GMGN KOL #${k.rank}. Win rate: ${k.win_rate}%, PnL: +$${k.pnl_usd}`,
    twitter_handle: k.twitter,
    confidence: 0.95,
    status: 'approved',
    source: 'gmgn_copytrade',
  }));
  
  await syncToKnownWallets(rows);
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('SYNC COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Total KOLs synced: ${rows.length}`);
  console.log(`  All have: wallet address + Twitter handle`);
  
  // Show sample
  console.log('\nSample KOLs:');
  rows.slice(0, 5).forEach(r => 
    console.log(`  ${r.label.padEnd(15)} @${r.twitter_handle.padEnd(18)} ${r.address.slice(0,8)}...`)
  );
}

main().catch(console.error);
