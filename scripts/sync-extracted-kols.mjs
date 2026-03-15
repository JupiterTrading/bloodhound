/**
 * BLOODHOUND — Sync Extracted KOLs to Supabase
 * Syncs Axiom Vision KOLs and GMGN wallets
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

// Axiom KOLs with Twitter handles (need wallet lookup)
const AXIOM_KOLS = [
  {name: "clukz", twitter: "clukzSOL", win_rate: 55.56, pnl_sol: 346.8},
  {name: "Dv", twitter: "vibed333", win_rate: 44.87, pnl_sol: 317.6},
  {name: "Jijo", twitter: "jijo_exe", win_rate: 66.05, pnl_sol: 254.6},
  {name: "Solstice", twitter: "The__Solstice", win_rate: 0, pnl_sol: 222.8},
  {name: "Radiance", twitter: "radiancebrr", win_rate: 49, pnl_sol: 195.8},
  {name: "Solkrow", twitter: "runitbackghost", win_rate: 17.24, pnl_sol: 149.5},
  {name: "trenchmanjames", twitter: "trenchmanjames", win_rate: 50.99, pnl_sol: 115.9},
  {name: "Publix", twitter: "Publixplayz", win_rate: 48.18, pnl_sol: 94.82},
  {name: "Latuche", twitter: "Latuche95", win_rate: 47.51, pnl_sol: 93.98},
  {name: "Kev", twitter: "Kevsznx", win_rate: 59.53, pnl_sol: 73.28},
  {name: "Smokez", twitter: "SmokezXBT", win_rate: 46.48, pnl_sol: 68.82},
  {name: "Gh0stee", twitter: "4GH0STEE", win_rate: 36, pnl_sol: 56.82},
  {name: "Veloce", twitter: "velocesvj", win_rate: 48.31, pnl_sol: 43.41},
  {name: "Xunle", twitter: "xunle111", win_rate: 29.17, pnl_sol: 25.86},
  {name: "Trey", twitter: "treysocial", win_rate: 36.17, pnl_sol: 21.93},
  {name: "Daumen", twitter: "daumeneth", win_rate: 59.09, pnl_sol: 11.74},
  {name: "Dali", twitter: "SolanaDali", win_rate: 25.41, pnl_sol: -110.1},
  {name: "Ozark", twitter: "ohzarke", win_rate: 20.13, pnl_sol: -113.7},
  {name: "Awkchan45", twitter: "awkchan45", win_rate: 20.11, pnl_sol: -115},
  {name: "Jack Duval", twitter: "jackduvalstocks", win_rate: 43.75, pnl_sol: -116.2},
  {name: "Fashr", twitter: "FASHRCrypto", win_rate: 31.29, pnl_sol: -120.3},
  {name: "Jidn", twitter: "jidn_w", win_rate: 34.34, pnl_sol: -130.6},
  {name: "Joji", twitter: "metaversejoji", win_rate: 32.93, pnl_sol: -179.5},
  {name: "Red", twitter: "redwithbag", win_rate: 19.16, pnl_sol: -215.7},
  {name: "Bandit", twitter: "bandeeeez", win_rate: 27.26, pnl_sol: -409},
  {name: "Cooker", twitter: "CookerFlips", win_rate: 76.92, pnl_sol: -492.9},
  {name: "Otta", twitter: "ottabag", win_rate: 31.71, pnl_sol: -512.5},
  {name: "West", twitter: "ratwizardx", win_rate: 25.24, pnl_sol: -584.5},
  {name: "Cented", twitter: "Cented7", win_rate: 38.49, pnl_sol: -645.4},
];

// GMGN wallets with actual addresses
const GMGN_WALLETS = [
  {address: "J485YzQjuJPLYoFEYjrjxd7NAoLHTiyUU63JwK7kLxRr", label: "0xDavid", source: "gmgn"},
  {address: "FAicXNV5FVqtfbpn4Zccs71XcfGeyxBSGbqLDyDJZjke", label: "radiance", source: "gmgn"},
  {address: "4uCT4g7YHH4xxfmfNfKUDenwGrRNGoZ9Ay1XFxfUGhQG", label: "Esee", source: "gmgn"},
];

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
    console.log(`  ✗ Error: ${await res.text()}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND KOL SYNC - Axiom + GMGN                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Sync GMGN wallets (have actual addresses)
  console.log('[1/2] Syncing GMGN wallets with actual addresses...');
  const gmgnRows = GMGN_WALLETS.map(w => ({
    address: w.address,
    label: w.label,
    category: 'kol',
    description: 'GMGN tracked trader',
    twitter_handle: null,
    confidence: 0.85,
    status: 'approved',
    source: 'gmgn',
  }));
  await syncToKnownWallets(gmgnRows);
  
  // Sync Axiom KOLs (use placeholder addresses, will be updated later)
  console.log('\n[2/2] Syncing Axiom KOLs with Twitter handles...');
  const axiomRows = AXIOM_KOLS.map(k => ({
    address: `AXIOM_${k.twitter.toUpperCase()}`,
    label: k.name,
    category: 'kol',
    description: `Axiom Vision KOL. Win rate: ${k.win_rate}%, PnL: ${k.pnl_sol} SOL`,
    twitter_handle: k.twitter,
    confidence: 0.90,
    status: 'approved',
    source: 'axiom_vision',
  }));
  await syncToKnownWallets(axiomRows);
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('SYNC COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  GMGN wallets:  ${GMGN_WALLETS.length} (with real addresses)`);
  console.log(`  Axiom KOLs:    ${AXIOM_KOLS.length} (with Twitter handles)`);
  console.log(`  Total:         ${GMGN_WALLETS.length + AXIOM_KOLS.length}`);
  console.log('\nNote: Axiom KOLs use placeholder addresses. Run wallet lookup to get real addresses.');
}

main().catch(console.error);
