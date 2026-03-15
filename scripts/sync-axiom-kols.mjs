/**
 * BLOODHOUND — Sync Axiom Vision KOLs to Supabase
 * Extracted from Axiom Vision leaderboard (7d + 1d views)
 */

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

// KOLs extracted from Axiom Vision leaderboard
const axiomKols = [
  // Top performers from 7d view
  {name: "clukz", twitter: "clukzSOL"},
  {name: "Dv", twitter: "vibed333"},
  {name: "Jijo", twitter: "jijo_exe"},
  {name: "Solstice", twitter: "The__Solstice"},
  {name: "Radiance", twitter: "radiancebrr"},
  {name: "Solkrow", twitter: "runitbackghost"},
  {name: "trenchmanjames", twitter: "trenchmanjames"},
  {name: "Latuche", twitter: "Latuche95"},
  {name: "Smokez", twitter: "SmokezXBT"},
  {name: "Kev", twitter: "Kevsznx"},
  {name: "Gh0stee", twitter: "4GH0STEE"},
  {name: "Publix", twitter: "Publixplayz"},
  {name: "Veloce", twitter: "velocesvj"},
  {name: "Trey", twitter: "treysocial"},
  {name: "The Doc", twitter: "KayTheDoc"},
  {name: "Daumen", twitter: "daumeneth"},
  // Mid-tier from 7d
  {name: "ABSol", twitter: "absolquant"},
  {name: "Nyhrox", twitter: "nyhrox"},
  {name: "Value & Time", twitter: "valueandtime"},
  {name: "Jay", twitter: "BitBoyJay"},
  {name: "Meechie", twitter: "973Meech"},
  {name: "Dutch", twitter: "0xDutch_"},
  {name: "BagCalls", twitter: "BagCalls"},
  {name: "Sully", twitter: "sullyfromDeets"},
  {name: "Larry", twitter: "larryislockedin"},
  {name: "JB", twitter: "Jeetburner"},
  {name: "Saif", twitter: "degensaif"},
  {name: "Carti the Menace", twitter: "CartiTheMenace"},
  {name: "Padly", twitter: "Padly1k"},
  {name: "0xWinged", twitter: "0xExorcized"},
  {name: "Peely", twitter: "0xpeely"},
  {name: "Sebisol", twitter: "limpcritisism"},
  // Lower tier 7d (ranks 117-129)
  {name: "Jidn", twitter: "jidn_w"},
  {name: "Dali", twitter: "SolanaDali"},
  {name: "Jack Duval", twitter: "jackduvalstocks"},
  {name: "Ozark", twitter: "ohzarke"},
  {name: "Fashr", twitter: "FASHRCrypto"},
  {name: "Awkchan45", twitter: "awkchan45"},
  {name: "Joji", twitter: "metaversejoji"},
  {name: "Red", twitter: "redwithbag"},
  {name: "Bandit", twitter: "bandeeeez"},
  {name: "Otta", twitter: "ottabag"},
  {name: "Cooker", twitter: "CookerFlips"},
  {name: "Cented", twitter: "Cented7"},
  {name: "West", twitter: "ratwizardx"},
  // From 1d view (new entries)
  {name: "Sebastian", twitter: "Saint_pablo123"},
  {name: "Xander", twitter: "xandereef"},
  {name: "Loopierr", twitter: "Loopierr"},
  {name: "Brox", twitter: "ohbrox"},
  {name: "OGAntD", twitter: "0GAntD"},
  {name: "Ethan Prosper", twitter: "pr6spr"},
  // GMGN KOL
  {name: "Blubber Nuggets", twitter: "Beard3dOne", address: "E883BMMcPDgYbarxZp7Qf3Kz8xBw7ZkdDSJkYT9nqJxP"},
];

async function syncToSupabase() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   AXIOM KOL SYNC TO SUPABASE                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  // Deduplicate by Twitter handle
  const byTwitter = new Map();
  for (const k of axiomKols) {
    const handle = k.twitter.toLowerCase();
    if (!byTwitter.has(handle)) {
      byTwitter.set(handle, k);
    }
  }
  
  console.log(`\n[Info] ${byTwitter.size} unique KOLs to sync`);
  
  // Build rows - use Twitter handle as unique key for now
  // Wallet addresses will be added when we can extract them
  const rows = [...byTwitter.values()].map(k => ({
    address: k.address || `axiom_${k.twitter.toLowerCase()}`, // Placeholder if no wallet
    label: k.name,
    twitter_handle: k.twitter,
    category: 'kol',
    description: `Axiom Vision KOL - ${k.name}`,
    confidence: k.address ? 0.95 : 0.80, // Higher confidence if we have wallet
    status: 'approved',
    source: 'axiom_vision',
  }));
  
  console.log(`[Supabase] Syncing ${rows.length} Axiom KOLs...`);
  
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
      if (res.ok) {
        ok += batch.length;
        console.log(`  Batch ${Math.floor(i/50)+1}: ${batch.length} synced`);
      } else {
        const err = await res.text();
        console.log(`  Batch ${Math.floor(i/50)+1} error: ${err.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`  Batch error: ${e.message}`);
    }
  }
  
  console.log(`\n[Supabase] Synced: ${ok}/${rows.length} KOLs`);
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('Note: KOLs without wallet addresses have placeholder addresses.');
  console.log('Run wallet extraction to update with real addresses.');
  console.log('══════════════════════════════════════════════════════════════════');
}

syncToSupabase().catch(console.error);
