/**
 * Run the KOL Persons migration via Supabase REST API
 */

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

// Migration SQL statements (split for execution)
const migrations = [
  // Add search_aliases column to known_wallets
  `ALTER TABLE known_wallets ADD COLUMN IF NOT EXISTS search_aliases text[] DEFAULT '{}'`,
  
  // Create index for name search
  `CREATE INDEX IF NOT EXISTS idx_known_wallets_label_gin ON known_wallets USING gin(to_tsvector('english', label))`,
];

async function runMigration() {
  console.log('Running migration via Supabase...\n');
  
  for (const sql of migrations) {
    console.log(`Executing: ${sql.slice(0, 60)}...`);
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
      
      if (res.ok) {
        console.log('  ✓ Success');
      } else {
        const err = await res.text();
        // Ignore "already exists" errors
        if (err.includes('already exists') || err.includes('does not exist')) {
          console.log('  ✓ Already exists or N/A');
        } else {
          console.log(`  ✗ Error: ${err.slice(0, 100)}`);
        }
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
    }
  }
  
  console.log('\nMigration complete. Now populating search aliases...');
}

// Generate search aliases from a name
function generateAliases(name, twitterHandle) {
  const aliases = new Set();
  if (!name) return [];
  
  aliases.add(name.toLowerCase());
  aliases.add(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  const parts = name.split(/[\s\-_]+/).filter(p => p.length > 1);
  parts.forEach(p => aliases.add(p.toLowerCase()));
  
  if (name.includes(' ')) {
    aliases.add(parts.join('').toLowerCase());
  }
  
  if (twitterHandle) {
    aliases.add(twitterHandle.toLowerCase().replace('@', ''));
  }
  
  return [...aliases].filter(a => a.length > 1);
}

async function populateAliases() {
  // Fetch all KOL wallets
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/known_wallets?status=eq.approved&category=eq.kol&select=address,label,twitter_handle`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  
  const wallets = await res.json();
  console.log(`Found ${wallets.length} KOL wallets to update\n`);
  
  // Update each wallet with aliases
  let updated = 0;
  for (const w of wallets) {
    const aliases = generateAliases(w.label, w.twitter_handle);
    
    try {
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/known_wallets?address=eq.${encodeURIComponent(w.address)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ search_aliases: aliases }),
        }
      );
      
      if (updateRes.ok) updated++;
    } catch {}
  }
  
  console.log(`Updated ${updated}/${wallets.length} wallets with search aliases`);
  
  // Show sample
  console.log('\nSample aliases:');
  wallets.slice(0, 5).forEach(w => {
    const aliases = generateAliases(w.label, w.twitter_handle);
    console.log(`  ${w.label}: [${aliases.slice(0, 4).join(', ')}]`);
  });
}

async function main() {
  await runMigration();
  await populateAliases();
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('Done! KOLs are now searchable by name variations.');
  console.log('══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
