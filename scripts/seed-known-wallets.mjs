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
async function duneGetOrExecute(queryId) {
  const DUNE_HEADERS = { 'X-DUNE-API-KEY': DUNE_API_KEY };

  // Try cached results first
  let res = await fetch(
    `https://api.dune.com/api/v1/query/${queryId}/results/csv`,
    { headers: DUNE_HEADERS }
  );

  // 409 = no cached results, need to execute the query first
  if (res.status === 409) {
    console.log(`  Query ${queryId}: no cache, executing...`);
    const execRes = await fetch(
      `https://api.dune.com/api/v1/query/${queryId}/execute`,
      { method: 'POST', headers: DUNE_HEADERS }
    );
    if (!execRes.ok) { console.warn(`  Query ${queryId}: execute failed ${execRes.status}`); return null; }
    const { execution_id } = await execRes.json();

    // Poll until complete (max 60s)
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const statusRes = await fetch(
        `https://api.dune.com/api/v1/execution/${execution_id}/status`,
        { headers: DUNE_HEADERS }
      );
      const status = await statusRes.json();
      process.stdout.write(`  Query ${queryId}: ${status.state}...\r`);
      if (status.state === 'QUERY_STATE_COMPLETED') break;
      if (status.state === 'QUERY_STATE_FAILED') { console.warn(`\n  Query ${queryId}: failed`); return null; }
    }
    console.log('');

    // Fetch results now that query is done
    res = await fetch(
      `https://api.dune.com/api/v1/execution/${execution_id}/results/csv`,
      { headers: DUNE_HEADERS }
    );
  }

  if (!res.ok) { console.warn(`  Query ${queryId}: ${res.status}`); return null; }
  return res.text();
}

async function fetchDuneKols() {
  if (!DUNE_API_KEY) {
    console.log('\n[2/3] Dune: no DUNE_API_KEY — skipping');
    console.log('      Set DUNE_API_KEY=xxx for +100 KOL wallets with Twitter handles');
    return [];
  }

  console.log('\n[2/3] Fetching Dune wallet data...');
  const wallets = [];

  // Query 4868517 — curated KOL address list (addresses only, no labels)
  // Used for cross-referencing, not directly inserted (requires label)
  try {
    const csv = await duneGetOrExecute('4868517');
    if (csv) {
      const lines = csv.trim().split('\n');
      const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const ai = hdrs.findIndex(h => h.includes('address') || h.includes('wallet'));
      if (ai !== -1) {
        let count = 0;
        for (const line of lines.slice(1)) {
          const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
          const address = cols[ai];
          if (!address || address.length < 32) continue;
          wallets.push({ address, label: null, twitter_handle: null, _source: 'dune_4868517' });
          count++;
        }
        console.log(`  Query 4868517: ${count} addresses (no labels — used for cross-ref)`);
      }
    }
  } catch (e) { console.warn(`  Query 4868517: ${e.message}`); }

  // Query 3832067 — top Solana DEX traders by volume (has rank + volume data)
  // Generate meaningful labels from rank + volume metadata
  try {
    const csv = await duneGetOrExecute('3832067');
    if (csv) {
      const lines = csv.trim().split('\n');
      const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const rankI  = hdrs.findIndex(h => h.includes('rank'));
      const addrI  = hdrs.findIndex(h => h === 'useraddress' || h === 'user_address');
      const volI   = hdrs.findIndex(h => h.includes('totalvolumeusd') || h.includes('total_volume'));
      const tradeI = hdrs.findIndex(h => h.includes('numberoftrades') || h.includes('trade'));

      if (addrI === -1) { console.warn('  Query 3832067: no address column'); }
      else {
        let count = 0;
        for (const line of lines.slice(1)) {
          const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
          const address = cols[addrI];
          if (!address || address.length < 32) continue;
          const rank    = rankI  !== -1 ? parseInt(cols[rankI])   : null;
          const vol     = volI   !== -1 ? parseFloat(cols[volI])  : null;
          const trades  = tradeI !== -1 ? parseInt(cols[tradeI])  : null;
          const volStr  = vol ? `$${(vol / 1000).toFixed(0)}k` : '';
          const label   = rank ? `Solana DEX Trader #${rank}` : 'Solana DEX Trader';
          const desc    = [
            `High-volume Solana DEX trader.`,
            rank   ? `Ranked #${rank} by total volume.` : '',
            volStr ? `${volStr} total volume.`          : '',
            trades ? `${trades} trades recorded.`       : '',
          ].filter(Boolean).join(' ');

          wallets.push({ address, label, twitter_handle: null, _description: desc, _category: 'profitable_trader', _source: 'dune_3832067' });
          count++;
        }
        console.log(`  Query 3832067: ${count} volume-ranked traders`);
      }
    }
  } catch (e) { console.warn(`  Query 3832067: ${e.message}`); }

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
  let sourceColumnExists = true;

  for (let i = 0; i < rows.length; i += 50) {
    let batch = rows.slice(i, i + 50);
    if (!sourceColumnExists) batch = batch.map(({ source, ...r }) => r);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/known_wallets?on_conflict=address`, {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      // If source column doesn't exist yet, retry without it
      if (err.includes("'source'") && sourceColumnExists) {
        console.warn('  source column not found — run 003_known_wallets_source.sql in Supabase SQL editor to enable it');
        console.warn('  Retrying without source field...');
        sourceColumnExists = false;
        i -= 50; // retry this batch
        continue;
      }
      console.error(`  Batch error: ${err}`);
    } else {
      inserted += batch.length;
    }
  }
  if (!sourceColumnExists) console.warn('\n  ⚠ source column missing — run packages/db/schema/003_known_wallets_source.sql in Supabase to track wallet origins');
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

  // Merge all sources — deduplicate by address
  // Priority order: KOLscan > Dune (KOLscan label wins if overlap)
  const byAddress = new Map();

  for (const w of leaderboard) {
    byAddress.set(w.address, { ...w, twitter_handle: null, source: 'kolscan_leaderboard', _category: 'kol' });
  }

  for (const w of duneWallets) {
    if (!byAddress.has(w.address)) {
      byAddress.set(w.address, { ...w, source: w._source || 'dune_query' });
    } else {
      const existing = byAddress.get(w.address);
      // Merge: prefer existing label and twitter, pick up Dune twitter if missing
      byAddress.set(w.address, {
        ...existing,
        twitter_handle: existing.twitter_handle || w.twitter_handle,
        source: `${existing.source},${w._source || 'dune_query'}`,
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

    const category = data._category || (data._source === 'dune_3832067' ? 'profitable_trader' : 'kol');
    const description = data._description ||
      (category === 'kol' ? 'KOLscan leaderboard trader. Ranked by realized PnL.' : 'Notable Solana wallet.');
    rows.push({
      address,
      label,
      category,
      description,
      twitter_handle: data.twitter_handle || null,
      telegram_handle: null,
      confidence: category === 'kol' ? 0.80 : 0.70,
      status: 'approved',
      source: data.source || 'kolscan_leaderboard',
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
