#!/usr/bin/env node
/**
 * BLOODHOUND — KOL Wallet Import Script
 * 
 * Imports KOL wallet data from various sources into Supabase.
 * 
 * Usage:
 *   node scripts/import-kol-wallets.mjs --file ./scripts/kol-data/gmgn-kols-complete.json
 *   node scripts/import-kol-wallets.mjs --source gmgn
 * 
 * Supported JSON formats:
 * 
 * Format 1 (GMGN):
 * [
 *   {
 *     "wallet": "6S8GezkxYUfZy9JPtYnanbcZTMB87Wjt1qx3c6ELajKC",
 *     "name": "nyhrox",
 *     "twitter": "KingOnEth",
 *     "pnl": "167.9",
 *     "winRate": "167.9",
 *     "source": "gmgn_kol",
 *     "category": "kol"
 *   }
 * ]
 * 
 * Format 2 (Legacy):
 * [
 *   {
 *     "twitter_handle": "@punk6529",
 *     "display_name": "punk6529",
 *     "wallets": ["DezX...Bt1v"],
 *     "source": "birdeye"
 *   }
 * ]
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse CLI args
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const sourceIndex = args.indexOf('--source');

// Detect and normalize data format
function normalizeKolData(kol) {
  // GMGN format: { wallet, name, twitter, pnl, winRate, source, category }
  if (kol.wallet && !kol.wallets) {
    return {
      twitter_handle: kol.twitter?.replace('@', '').toLowerCase() || null,
      display_name: kol.name || kol.twitter || 'Unknown',
      wallets: [kol.wallet],
      source: kol.source || 'gmgn',
      pnl: kol.pnl ? parseFloat(kol.pnl.replace(/,/g, '')) : null,
      win_rate: kol.winRate ? parseFloat(kol.winRate) : null,
      category: kol.category || 'kol',
    };
  }
  
  // Legacy format: { twitter_handle, display_name, wallets, source, pfp_url }
  return {
    twitter_handle: kol.twitter_handle?.replace('@', '').toLowerCase(),
    display_name: kol.display_name || kol.twitter_handle,
    wallets: Array.isArray(kol.wallets) ? kol.wallets : [kol.wallet].filter(Boolean),
    source: kol.source || 'manual',
    pfp_url: kol.pfp_url,
    telegram_handle: kol.telegram_handle?.replace('@', ''),
    description: kol.description,
    pnl: null,
    win_rate: null,
  };
}

async function importFromFile(filePath) {
  console.log(`📂 Reading from ${filePath}...`);
  
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  if (!Array.isArray(data)) {
    throw new Error('Expected JSON array');
  }
  
  console.log(`📊 Found ${data.length} KOL entries`);
  
  // Detect format
  const isGmgnFormat = data[0]?.wallet && !data[0]?.wallets;
  console.log(`📋 Detected format: ${isGmgnFormat ? 'GMGN' : 'Legacy'}`);
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const rawKol of data) {
    try {
      const kol = normalizeKolData(rawKol);
      const twitterHandle = kol.twitter_handle;
      
      // Skip entries with no twitter and generic names
      if (!twitterHandle && kol.display_name === 'Copy') {
        console.log(`⏭️ Skipping generic entry without Twitter`);
        continue;
      }
      
      // Check if profile exists by twitter OR by wallet address
      let existing = null;
      
      if (twitterHandle) {
        const { data: byTwitter } = await supabase
          .from('kol_profiles')
          .select('id')
          .eq('twitter_handle', twitterHandle)
          .single();
        existing = byTwitter;
      }
      
      if (!existing && kol.wallets.length > 0) {
        // Check by wallet
        const { data: byWallet } = await supabase
          .from('kol_wallets')
          .select('kol_profile_id')
          .eq('address', kol.wallets[0])
          .single();
        
        if (byWallet) {
          const { data: profile } = await supabase
            .from('kol_profiles')
            .select('id')
            .eq('id', byWallet.kol_profile_id)
            .single();
          existing = profile;
        }
      }
      
      let profileId;
      
      if (existing) {
        // Update existing profile with new stats
        const updateData = {
          display_name: kol.display_name,
        };
        
        if (kol.pnl !== null) updateData.total_pnl_usd = kol.pnl;
        if (kol.win_rate !== null) updateData.win_rate = kol.win_rate;
        if (kol.pfp_url) updateData.twitter_pfp_url = kol.pfp_url;
        if (kol.telegram_handle) updateData.telegram_handle = kol.telegram_handle;
        if (kol.description) updateData.description = kol.description;
        
        const { error } = await supabase
          .from('kol_profiles')
          .update(updateData)
          .eq('id', existing.id);
        
        if (error) throw error;
        profileId = existing.id;
        updated++;
      } else {
        // Create new profile
        const { data: new_profile, error } = await supabase
          .from('kol_profiles')
          .insert({
            display_name: kol.display_name || 'Unknown',
            twitter_handle: twitterHandle,
            twitter_pfp_url: kol.pfp_url,
            telegram_handle: kol.telegram_handle,
            description: kol.description,
            source: kol.source,
            total_pnl_usd: kol.pnl || 0,
            win_rate: kol.win_rate || 0,
          })
          .select()
          .single();
        
        if (error) throw error;
        profileId = new_profile.id;
        created++;
      }
      
      // Add wallets
      for (let i = 0; i < kol.wallets.length; i++) {
        const address = kol.wallets[i];
        const isPrimary = i === 0;
        
        // Upsert wallet
        const { error } = await supabase
          .from('kol_wallets')
          .upsert({
            kol_profile_id: profileId,
            address,
            label: isPrimary ? 'Main' : `Wallet ${i + 1}`,
            is_primary: isPrimary,
            discovered_via: 'scraped',
          }, {
            onConflict: 'address',
          });
        
        if (error && !error.message.includes('duplicate')) {
          console.warn(`⚠️ Wallet ${address}: ${error.message}`);
        }
      }
      
      const label = twitterHandle || kol.display_name;
      const pnlStr = kol.pnl ? ` (PnL: $${kol.pnl.toLocaleString()})` : '';
      console.log(`✅ ${label}: ${kol.wallets.length} wallet(s)${pnlStr}`);
      
    } catch (err) {
      console.error(`❌ Error processing entry:`, err.message);
      errors++;
    }
  }
  
  console.log('\n📈 Import Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors:  ${errors}`);
  console.log(`   Total:   ${data.length}`);
}

async function importFromDataDir(source) {
  const dataDir = path.join(process.cwd(), 'data', 'kols');
  const files = await fs.readdir(dataDir).catch(() => []);
  
  const sourceFiles = files.filter(f => 
    f.includes(source) && f.endsWith('.json')
  );
  
  if (sourceFiles.length === 0) {
    console.log(`📂 No files found for source: ${source}`);
    console.log(`   Expected files in: ${dataDir}`);
    return;
  }
  
  for (const file of sourceFiles) {
    await importFromFile(path.join(dataDir, file));
  }
}

async function main() {
  console.log('🐕 BLOODHOUND KOL Wallet Importer\n');
  
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    await importFromFile(args[fileIndex + 1]);
  } else if (sourceIndex !== -1 && args[sourceIndex + 1]) {
    await importFromDataDir(args[sourceIndex + 1]);
  } else {
    console.log('Usage:');
    console.log('  node scripts/import-kol-wallets.mjs --file ./data/kols.json');
    console.log('  node scripts/import-kol-wallets.mjs --source birdeye');
    console.log('\nExpected JSON format:');
    console.log(JSON.stringify([{
      twitter_handle: "@example",
      display_name: "Example KOL",
      wallets: ["wallet1...", "wallet2..."],
      source: "birdeye",
      pfp_url: "https://..."
    }], null, 2));
  }
}

main().catch(console.error);
