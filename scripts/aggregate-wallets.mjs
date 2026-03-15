import fs from 'fs';
import path from 'path';

const dataDir = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data';

// Known system/program wallets to exclude
const SYSTEM_WALLETS = new Set([
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
]);

// Common token mints to exclude (these appear frequently in transaction data)
const KNOWN_TOKENS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
]);

console.log('🔄 Starting wallet aggregation and deduplication...\n');

// Load all data files
const files = [
  { path: 'axiom-vision-kols-2026-03-13.json', source: 'axiom', type: 'kol' },
  { path: 'axiom-global-wallets-2026-03-13.json', source: 'axiom', type: 'smart_money' },
  { path: 'gmgn-kols-2026-03-14.json', source: 'gmgn', type: 'kol' },
  { path: 'gmgn-smart-money-2026-03-14.json', source: 'gmgn', type: 'smart_money' },
  { path: 'kolscan-kols-2026-03-14.json', source: 'kolscan', type: 'kol' },
  { path: 'dexscreener-wallets-2026-03-14.json', source: 'dexscreener', type: 'smart_money' },
  { path: 'stalkchain-wallets-2026-03-14.json', source: 'stalkchain', type: 'kol' },
];

// Wallet validation
function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  if (!/^[A-HJ-NP-Za-km-z1-9]+$/.test(address)) return false;
  if (SYSTEM_WALLETS.has(address)) return false;
  if (KNOWN_TOKENS.has(address)) return false;
  return true;
}

// Aggregate wallets by address
const walletMap = new Map();
let totalProcessed = 0;
let totalSkipped = 0;

for (const file of files) {
  const filePath = path.join(dataDir, file.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file.path} (not found)`);
    continue;
  }
  
  console.log(`📂 Processing ${file.path}...`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  let fileProcessed = 0;
  let fileSkipped = 0;
  
  for (const wallet of data) {
    const address = wallet.wallet || wallet.address || wallet.wallet_address;
    
    if (!isValidSolanaAddress(address)) {
      fileSkipped++;
      continue;
    }
    
    fileProcessed++;
    
    if (!walletMap.has(address)) {
      walletMap.set(address, {
        wallet: address,
        sources: [],
        categories: new Set(),
        data: {}
      });
    }
    
    const entry = walletMap.get(address);
    
    // Add source
    if (!entry.sources.includes(file.source)) {
      entry.sources.push(file.source);
    }
    
    // Add category
    entry.categories.add(wallet.category || file.type);
    
    // Merge data (prefer non-null values)
    if (wallet.name && !entry.data.name) entry.data.name = wallet.name;
    if (wallet.twitter && !entry.data.twitter) entry.data.twitter = wallet.twitter;
    if (wallet.telegram && !entry.data.telegram) entry.data.telegram = wallet.telegram;
    if (wallet.avatar && !entry.data.avatar) entry.data.avatar = wallet.avatar;
    
    // Merge metrics (prefer higher quality sources)
    if (wallet.pnl_sol && !entry.data.pnl_sol) entry.data.pnl_sol = wallet.pnl_sol;
    if (wallet.pnl_1d && !entry.data.pnl_1d) entry.data.pnl_1d = wallet.pnl_1d;
    if (wallet.pnl_7d && !entry.data.pnl_7d) entry.data.pnl_7d = wallet.pnl_7d;
    if (wallet.pnl_30d && !entry.data.pnl_30d) entry.data.pnl_30d = wallet.pnl_30d;
    if (wallet.winrate && !entry.data.winrate) entry.data.winrate = wallet.winrate;
    if (wallet.winRate && !entry.data.winrate) entry.data.winrate = wallet.winRate;
    if (wallet.winrate_7d && !entry.data.winrate_7d) entry.data.winrate_7d = wallet.winrate_7d;
    if (wallet.winrate_30d && !entry.data.winrate_30d) entry.data.winrate_30d = wallet.winrate_30d;
    if (wallet.volume_sol && !entry.data.volume_sol) entry.data.volume_sol = wallet.volume_sol;
    if (wallet.total_trades && !entry.data.total_trades) entry.data.total_trades = wallet.total_trades;
    if (wallet.followers && !entry.data.followers) entry.data.followers = wallet.followers;
    
    // Store all tags
    if (wallet.tags && Array.isArray(wallet.tags)) {
      if (!entry.data.tags) entry.data.tags = [];
      entry.data.tags.push(...wallet.tags);
    }
  }
  
  console.log(`   ✓ Processed: ${fileProcessed}, Skipped: ${fileSkipped}`);
  totalProcessed += fileProcessed;
  totalSkipped += fileSkipped;
}

console.log(`\n📊 Aggregation Summary:`);
console.log(`   Total wallets processed: ${totalProcessed}`);
console.log(`   Invalid/system wallets skipped: ${totalSkipped}`);
console.log(`   Unique valid wallets: ${walletMap.size}`);

// Format final output
const aggregated = Array.from(walletMap.values()).map(entry => {
  const categories = Array.from(entry.categories);
  const primaryCategory = categories.includes('kol') ? 'kol' : 'smart_money';
  
  return {
    wallet: entry.wallet,
    name: entry.data.name || null,
    twitter: entry.data.twitter || null,
    telegram: entry.data.telegram || null,
    avatar: entry.data.avatar || null,
    category: primaryCategory,
    is_kol: categories.includes('kol'),
    is_smart_money: categories.includes('smart_money'),
    sources: entry.sources,
    source_count: entry.sources.length,
    tags: entry.data.tags ? [...new Set(entry.data.tags)] : [],
    metrics: {
      pnl_sol: entry.data.pnl_sol || null,
      pnl_1d: entry.data.pnl_1d || null,
      pnl_7d: entry.data.pnl_7d || null,
      pnl_30d: entry.data.pnl_30d || null,
      winrate: entry.data.winrate || null,
      winrate_7d: entry.data.winrate_7d || null,
      winrate_30d: entry.data.winrate_30d || null,
      volume_sol: entry.data.volume_sol || null,
      total_trades: entry.data.total_trades || null,
      followers: entry.data.followers || null,
    },
    aggregated_at: new Date().toISOString()
  };
});

// Sort by source count (more sources = higher confidence)
aggregated.sort((a, b) => b.source_count - a.source_count);

// Split into KOLs and Smart Money
const kols = aggregated.filter(w => w.is_kol);
const smartMoney = aggregated.filter(w => !w.is_kol && w.is_smart_money);

console.log(`\n📋 Final Breakdown:`);
console.log(`   KOLs: ${kols.length}`);
console.log(`   Smart Money: ${smartMoney.length}`);
console.log(`   Multi-source wallets: ${aggregated.filter(w => w.source_count > 1).length}`);

// Save outputs
const outputDir = dataDir;
fs.writeFileSync(
  path.join(outputDir, 'aggregated-all-wallets.json'),
  JSON.stringify(aggregated, null, 2)
);
fs.writeFileSync(
  path.join(outputDir, 'aggregated-kols.json'),
  JSON.stringify(kols, null, 2)
);
fs.writeFileSync(
  path.join(outputDir, 'aggregated-smart-money.json'),
  JSON.stringify(smartMoney, null, 2)
);

console.log(`\n✅ Aggregation complete!`);
console.log(`   📁 aggregated-all-wallets.json (${aggregated.length} wallets)`);
console.log(`   📁 aggregated-kols.json (${kols.length} wallets)`);
console.log(`   📁 aggregated-smart-money.json (${smartMoney.length} wallets)`);

// Generate stats
const stats = {
  total_wallets: aggregated.length,
  kols: kols.length,
  smart_money: smartMoney.length,
  by_source: {},
  multi_source: aggregated.filter(w => w.source_count > 1).length,
  with_twitter: aggregated.filter(w => w.twitter).length,
  with_telegram: aggregated.filter(w => w.telegram).length,
  with_name: aggregated.filter(w => w.name).length,
  with_metrics: aggregated.filter(w => w.metrics.pnl_sol || w.metrics.pnl_30d).length,
  generated_at: new Date().toISOString()
};

// Count by source
for (const wallet of aggregated) {
  for (const source of wallet.sources) {
    stats.by_source[source] = (stats.by_source[source] || 0) + 1;
  }
}

fs.writeFileSync(
  path.join(outputDir, 'aggregation-stats.json'),
  JSON.stringify(stats, null, 2)
);

console.log(`\n📊 Statistics saved to aggregation-stats.json`);
console.log(`\n🎉 Ready for database seeding!`);
