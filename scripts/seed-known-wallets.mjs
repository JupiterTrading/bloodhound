/**
 * BLOODHOUND — Known Wallets Seeder (Sprint B3 / US-B303)
 *
 * Sources:
 *   1. KOLscan leaderboard  — top 50 Solana traders by realized PnL
 *   2. Dune query 4838225   — curated KOL wallet list with Twitter handles
 *                             (optional: set DUNE_API_KEY env var)
 *   3. Helius identity API  — enriches addresses with Helius's 5,100+ label DB
 *
 * NOTE: KOLscan SSR HTML doesn't reliably expose per-wallet Twitter handles
 * (site-wide KOL spotlight elements make scraping ambiguous). Set DUNE_API_KEY
 * for Twitter handle enrichment via curated Dune datasets.
 *
 * Usage:
 *   node scripts/seed-known-wallets.mjs
 *   DUNE_API_KEY=xxx node scripts/seed-known-wallets.mjs
 */

const SUPABASE_URL   = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';
const HELIUS_API_KEY = '60d6158d-429c-4d41-b7b4-1176b54228a6';
const DUNE_API_KEY   = process.env.DUNE_API_KEY || '';

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. KOLscan leaderboard — extract addresses + names
// ---------------------------------------------------------------------------
async function scrapeKolscanLeaderboard() {
  console.log('\n[1/3] Scraping KOLscan leaderboard...');
  const { load } = await import('cheerio');

  const res = await fetch('https://kolscan.io/leaderboard', { headers: FETCH_HEADERS });
  if (!res.ok) { console.warn(`  KOLscan ${res.status} — skipping`); return []; }

  const html = await res.text();
  const $ = load(html);
  const wallets = [];

  // Each row: div[class*="leaderboardUser"]
  // Address: href="/account/{ADDRESS}" on the inner <a> tag
  // Name:    <h1 style="font-size:20px..."> inside that <a>
  $('[class*="leaderboardUser"]').each((_, el) => {
    const row = $(el);
    const accountLink = row.find('a[href*="/account/"]').first();
    const href = accountLink.attr('href') || '';
    const addrMatch = href.match(/\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (!addrMatch) return;
    const address = addrMatch[1];

    // Name is in h1 with font-size:20px inside the account link
    let label = accountLink.find('h1').first().text().trim();
    // Fallback: any h1 in the row that isn't a PnL number
    if (!label) {
      row.find('h1').each((_, h) => {
        const t = $(h).text().trim();
        if (t && !t.includes('Sol') && !t.includes('$') && !t.startsWith('+') && !t.startsWith('-')) {
          label = t;
        }
      });
    }
    if (!label || label.length < 2) return;

    wallets.push({ address, label });
  });

  const seen = new Set();
  const unique = wallets.filter(w => { if (seen.has(w.address)) return false; seen.add(w.address); return true; });
  console.log(`  Found ${unique.length} wallets`);
  return unique;
}

// ---------------------------------------------------------------------------
// 2. Dune Analytics — optional curated KOL list with Twitter handles
// ---------------------------------------------------------------------------
async function fetchDuneKols() {
  if (!DUNE_API_KEY) {
    console.log('\n[2/3] Dune: no DUNE_API_KEY — skipping');
    console.log('      Set DUNE_API_KEY=xxx for +100 KOL wallets with Twitter handles');
    return [];
  }

  console.log('\n[2/3] Fetching Dune KOL wallet lists...');
  const wallets = [];

  for (const queryId of ['4838225', '4868517']) {
    try {
      const res = await fetch(
        `https://api.dune.com/api/v1/query/${queryId}/results/csv`,
        { headers: { 'X-DUNE-API-KEY': DUNE_API_KEY } }
      );
      if (!res.ok) { console.warn(`  Query ${queryId}: ${res.status}`); continue; }

      const csv = await res.text();
      const lines = csv.trim().split('\n');
      const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const ai = hdrs.findIndex(h => h.includes('address') || h.includes('wallet'));
      const ni = hdrs.findIndex(h => h.includes('name') || h.includes('label'));
      const ti = hdrs.findIndex(h => h.includes('twitter') || h.includes('handle'));

      if (ai === -1) continue;
      for (const line of lines.slice(1)) {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
        const address = cols[ai];
        if (!address || address.length < 32) continue;
        wallets.push({
          address,
          label: ni !== -1 ? cols[ni] : null,
          twitter_handle: ti !== -1 ? cols[ti]?.replace('@', '') || null : null,
        });
      }
      console.log(`  Query ${queryId}: ${lines.length - 1} rows`);
    } catch (e) { console.warn(`  Query ${queryId}: ${e.message}`); }
  }

  const seen = new Set();
  const unique = wallets.filter(w => { if (seen.has(w.address)) return false; seen.add(w.address); return true; });
  console.log(`  Dune total: ${unique.length} unique wallets`);
  return unique;
}

// ---------------------------------------------------------------------------
// 3. Helius batch identity — enrich with Helius's label DB
// ---------------------------------------------------------------------------
async function enrichWithHelius(addresses) {
  if (!addresses.length) return {};
  console.log(`\n  Helius identity enrichment for ${addresses.length} addresses...`);
  const enriched = {};

  const CONCURRENCY = 5;
  for (let i = 0; i < Math.min(addresses.length, 30); i += CONCURRENCY) {
    const batch = addresses.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async addr => {
      try {
        const res = await fetch(
          `https://api.helius.xyz/v0/addresses/${addr}/names?api-key=${HELIUS_API_KEY}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            enriched[addr] = { helius_label: data[0] };
          }
        }
      } catch { /* ignore */ }
    }));
    await sleep(100);
  }

  console.log(`  Helius matched: ${Object.keys(enriched).length} addresses`);
  return enriched;
}

// ---------------------------------------------------------------------------
// 4. Upsert to Supabase
// ---------------------------------------------------------------------------
async function upsertToSupabase(rows) {
  if (!rows.length) { console.log('\n  Nothing to upsert'); return 0; }
  console.log(`\n[3/3] Upserting ${rows.length} rows to Supabase...`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    // ?on_conflict=address tells PostgREST which column to use for the upsert
    const res = await fetch(`${SUPABASE_URL}/rest/v1/known_wallets?on_conflict=address`, {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(`  Batch error: ${await res.text()}`);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  Inserted/updated: ${inserted}`);
  return inserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== BLOODHOUND Known Wallets Seeder ===\n');

  // Step 1: Scrape KOLscan leaderboard
  const leaderboard = await scrapeKolscanLeaderboard();

  // Step 2: Dune (optional — includes Twitter handles)
  const duneWallets = await fetchDuneKols();

  // Merge all sources — deduplicate by address, Dune takes priority for Twitter
  const byAddress = new Map();
  for (const w of [...leaderboard]) {
    byAddress.set(w.address, { ...w, twitter_handle: null });
  }
  for (const w of duneWallets) {
    if (!byAddress.has(w.address)) {
      byAddress.set(w.address, w);
    } else {
      const existing = byAddress.get(w.address);
      byAddress.set(w.address, {
        ...existing,
        ...w,
        label: w.label || existing.label,
        twitter_handle: w.twitter_handle || existing.twitter_handle,
      });
    }
  }

  // Helius enrichment
  const allAddresses = [...byAddress.keys()];
  const heliusData = await enrichWithHelius(allAddresses);

  // Build final rows
  const rows = [];
  for (const [address, data] of byAddress) {
    const label = data.label || heliusData[address]?.helius_label;
    if (!label || label.length < 2) continue;

    rows.push({
      address,
      label,
      category: 'kol',
      description: `KOLscan leaderboard trader. Ranked by realized PnL.`,
      twitter_handle: data.twitter_handle || null,
      telegram_handle: null,
      confidence: 0.80,
      status: 'approved',
    });
  }

  console.log(`\nTotal rows to insert: ${rows.length}`);
  if (rows.length === 0) {
    console.log('\nNo rows collected. Try adding DUNE_API_KEY for additional data.');
    return;
  }

  // Preview first 5
  console.log('\nPreview:');
  rows.slice(0, 5).forEach(r =>
    console.log(`  ${r.label.padEnd(20)} @${(r.twitter_handle || '—').padEnd(20)} ${r.address.slice(0, 12)}...`)
  );

  await upsertToSupabase(rows);

  const withTwitter = rows.filter(r => r.twitter_handle).length;
  console.log(`\n✓ Done. ${rows.length} KOL wallets seeded. ${withTwitter} have Twitter handles.`);
}

main().catch(err => { console.error(err); process.exit(1); });
