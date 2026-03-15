import { readFile, writeFile } from 'fs/promises';

/**
 * Generic HAR file parser template
 * Extracts API responses matching a pattern and normalizes data
 */

export async function parseHAR(harPath, config) {
  console.log(`\n📂 Parsing HAR: ${harPath}`);
  console.log(`🎯 Target API pattern: ${config.apiPattern}`);
  
  const har = JSON.parse(await readFile(harPath, 'utf-8'));
  const entries = har.log.entries;
  
  // Filter for target API calls
  const apiCalls = entries.filter(e => {
    const url = e.request.url;
    const isJson = e.response.content.mimeType?.includes('json');
    const matchesPattern = config.apiPattern.test(url);
    return isJson && matchesPattern && e.response.status === 200;
  });
  
  console.log(`✅ Found ${apiCalls.length} matching API calls`);
  
  const allData = [];
  
  for (const entry of apiCalls) {
    const url = entry.request.url;
    const responseText = entry.response.content.text;
    
    if (!responseText) {
      console.warn(`⚠️  Empty response from ${url}`);
      continue;
    }
    
    try {
      const data = JSON.parse(responseText);
      allData.push({ url, data, timestamp: entry.startedDateTime });
    } catch (err) {
      console.warn(`❌ Failed to parse response from ${url}: ${err.message}`);
    }
  }
  
  // Process and normalize data using source-specific normalizer
  console.log(`\n🔄 Normalizing ${allData.length} responses...`);
  const normalized = config.normalizer(allData);
  
  // Write output
  const output = {
    source: config.sourceName,
    collected_at: new Date().toISOString(),
    total_records: normalized.length,
    data: normalized
  };
  
  await writeFile(config.outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Wrote ${normalized.length} records to ${config.outputPath}`);
  
  return output;
}

/**
 * Utility functions for data normalization
 */

export function normalizeTwitterHandle(handle) {
  if (!handle) return null;
  return handle.replace('@', '').toLowerCase().trim();
}

export function normalizeTelegramHandle(handle) {
  if (!handle) return null;
  return handle.replace('@', '').toLowerCase().trim();
}

export function normalizeDisplayName(name) {
  if (!name) return null;
  return name.trim();
}

export function validateSolanaAddress(address) {
  if (!address) return false;
  // Solana addresses are 32-44 characters, base58
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function validateEvmAddress(address) {
  if (!address) return false;
  // EVM addresses are 42 characters with 0x prefix
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function parseNumericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Standard data format template
 */
export function createStandardRecord(data) {
  return {
    solana_address: data.solana_address || null,
    evm_address: data.evm_address || null,
    display_name: normalizeDisplayName(data.display_name),
    twitter_handle: normalizeTwitterHandle(data.twitter_handle),
    telegram_handle: normalizeTelegramHandle(data.telegram_handle),
    avatar_url: data.avatar_url || null,
    bio: data.bio || null,
    metrics: {
      pnl_24h_usd: parseNumericValue(data.pnl_24h_usd),
      pnl_7d_usd: parseNumericValue(data.pnl_7d_usd),
      pnl_30d_usd: parseNumericValue(data.pnl_30d_usd),
      win_rate: parseNumericValue(data.win_rate),
      total_trades: parseNumericValue(data.total_trades),
      total_volume_usd: parseNumericValue(data.total_volume_usd),
      followers_count: parseNumericValue(data.followers_count),
      following_count: parseNumericValue(data.following_count)
    },
    tier: data.tier || 'standard',
    wallet_type: data.wallet_type || 'kol',
    is_verified: data.is_verified || false,
    raw_data: data.raw_data || null // Store original for debugging
  };
}
