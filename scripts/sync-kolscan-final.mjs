// Sync extracted KOLscan data to Supabase
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const data = JSON.parse(await fs.readFile('kol-data/kolscan-final.json', 'utf8'));

const rows = data.filter(k => k.name || k.twitter_handle).map(k => ({
  address: k.address,
  label: k.name || `KOL ${k.address.slice(0,8)}`,
  twitter_handle: k.twitter_handle || null,
  category: 'kol',
  description: 'KOLscan leaderboard - verified trader',
  confidence: k.twitter_handle ? 0.95 : 0.8,
  status: 'approved',
  source: 'kolscan',
}));

console.log(`Syncing ${rows.length} KOLs to Supabase...`);
console.log(`With Twitter: ${rows.filter(r => r.twitter_handle).length}`);

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
    else console.log('Batch error:', await res.text());
  } catch (e) {
    console.log('Error:', e.message);
  }
}

console.log(`\nSynced: ${ok}/${rows.length}`);
console.log('Done!');
