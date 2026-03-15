/**
 * BLOODHOUND — Load Verified KOLs
 * 
 * Loads the curated verified-kols.json and syncs to Supabase.
 * This is the most reliable source of wallet-Twitter mappings.
 * 
 * Usage:
 *   node scripts/load-verified-kols.mjs
 */

import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   BLOODHOUND — Load Verified KOLs                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Load verified KOLs
  const data = JSON.parse(await fs.readFile('verified-kols.json', 'utf-8'));
  const kols = data.kols;

  console.log(`[Load] ${kols.length} verified KOLs`);
  console.log(`[Load] Last updated: ${data.last_updated}\n`);

  // Preview
  console.log('Preview:');
  kols.slice(0, 10).forEach(k => {
    console.log(`  ${k.name.padEnd(20)} @${k.twitter.padEnd(20)} ${k.address.slice(0, 12)}...`);
  });

  // Prepare for Supabase
  const rows = kols.map(k => ({
    address: k.address,
    label: k.name,
    twitter_handle: k.twitter.toLowerCase(),
    category: 'kol',
    description: `Verified ${k.source.replace('_', ' ')}`,
    confidence: k.confidence,
    status: 'approved',
    source: `verified_${k.source}`,
  }));

  // Sync to Supabase
  console.log(`\n[Supabase] Syncing ${rows.length} KOLs...`);

  let success = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    try {
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
        success += batch.length;
      } else {
        const err = await res.text();
        console.warn(`  Batch error: ${err.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn(`  Error: ${err.message}`);
    }
  }

  console.log(`[Supabase] Synced: ${success}/${rows.length}`);

  // Also save to aggregated file
  const aggregated = kols.map(k => ({
    address: k.address,
    name: k.name,
    twitter_handle: k.twitter.toLowerCase(),
    confidence: k.confidence,
    sources: [`verified_${k.source}`],
  }));

  await fs.mkdir('kol-data', { recursive: true });
  await fs.writeFile('kol-data/aggregated-kols.json', JSON.stringify(aggregated, null, 2));
  console.log(`\n[Save] Updated scripts/kol-data/aggregated-kols.json`);

  // Stats
  const withTwitter = kols.filter(k => k.twitter).length;
  console.log(`\n✓ Done. ${kols.length} verified KOLs loaded. ${withTwitter} have Twitter handles.`);
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
