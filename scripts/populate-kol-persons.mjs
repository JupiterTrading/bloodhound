/**
 * BLOODHOUND — Populate KOL Persons from Known Wallets
 * 
 * Creates person records from known_wallets data and generates search aliases
 * for better name matching (e.g., "Frank DeGods" -> ["frankdegods", "frank", "degods"])
 */
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

// Generate search aliases from a name
function generateAliases(name, twitterHandle) {
  const aliases = new Set();
  
  if (!name) return [];
  
  // Original name
  aliases.add(name.toLowerCase());
  
  // Remove special characters and spaces
  aliases.add(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  // Split by spaces and add parts
  const parts = name.split(/[\s\-_]+/).filter(p => p.length > 1);
  parts.forEach(p => aliases.add(p.toLowerCase()));
  
  // Common variations
  if (name.includes(' ')) {
    // FirstLast
    aliases.add(parts.join('').toLowerCase());
    // First_Last
    aliases.add(parts.join('_').toLowerCase());
  }
  
  // Add Twitter handle without @
  if (twitterHandle) {
    aliases.add(twitterHandle.toLowerCase().replace('@', ''));
  }
  
  return [...aliases].filter(a => a.length > 1);
}

async function fetchKnownWallets() {
  console.log('[Fetch] Getting known wallets from Supabase...');
  
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/known_wallets?status=eq.approved&category=eq.kol&select=*`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${await res.text()}`);
  }
  
  const wallets = await res.json();
  console.log(`  Found ${wallets.length} KOL wallets`);
  return wallets;
}

async function updateWalletAliases(wallets) {
  console.log('\n[Aliases] Updating search aliases for wallets...');
  
  let updated = 0;
  for (const wallet of wallets) {
    const aliases = generateAliases(wallet.label, wallet.twitter_handle);
    
    if (aliases.length > 0) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/known_wallets?address=eq.${wallet.address}`,
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
        
        if (res.ok) updated++;
      } catch {}
    }
  }
  
  console.log(`  Updated ${updated}/${wallets.length} wallets with aliases`);
}

async function createPersonsFromWallets(wallets) {
  console.log('\n[Persons] Creating KOL person records...');
  
  // Group wallets by Twitter handle (same person = same Twitter)
  const byTwitter = new Map();
  
  for (const w of wallets) {
    if (w.twitter_handle) {
      const handle = w.twitter_handle.toLowerCase();
      if (!byTwitter.has(handle)) {
        byTwitter.set(handle, []);
      }
      byTwitter.get(handle).push(w);
    }
  }
  
  console.log(`  Found ${byTwitter.size} unique Twitter handles (potential persons)`);
  
  // Create person records
  const persons = [];
  for (const [twitter, walletList] of byTwitter) {
    // Use the first wallet's data as primary
    const primary = walletList[0];
    const aliases = generateAliases(primary.label, twitter);
    
    persons.push({
      display_name: primary.label,
      twitter_handle: twitter,
      telegram_handle: primary.telegram_handle || null,
      aliases,
      confidence: primary.confidence || 0.85,
      verified: false,
    });
  }
  
  // Insert persons (upsert on twitter_handle)
  console.log(`  Inserting ${persons.length} person records...`);
  
  let ok = 0;
  for (let i = 0; i < persons.length; i += 50) {
    const batch = persons.slice(i, i + 50);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/kol_persons?on_conflict=twitter_handle`,
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
        ok += batch.length;
      } else {
        const err = await res.text();
        // Table might not exist yet - that's OK
        if (err.includes('does not exist')) {
          console.log('  Note: kol_persons table not created yet. Run migration first.');
          return;
        }
      }
    } catch {}
  }
  
  console.log(`  Created ${ok}/${persons.length} person records`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   POPULATE KOL PERSONS & SEARCH ALIASES                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  try {
    const wallets = await fetchKnownWallets();
    
    // Update search aliases on known_wallets
    await updateWalletAliases(wallets);
    
    // Try to create person records (may fail if table doesn't exist)
    await createPersonsFromWallets(wallets);
    
    // Print sample aliases
    console.log('\nSample search aliases:');
    wallets.slice(0, 5).forEach(w => {
      const aliases = generateAliases(w.label, w.twitter_handle);
      console.log(`  ${w.label}: [${aliases.join(', ')}]`);
    });
    
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('Done! KOLs are now searchable by name variations.');
    console.log('══════════════════════════════════════════════════════════════════');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
