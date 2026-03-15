// Extract KOL data from saved KOLscan HTML
import fs from 'fs/promises';

const html = await fs.readFile('kol-data/kolscan-page.html', 'utf8');

// The data is JSON-escaped in Next.js script tags, so we need to handle escaped quotes
// Pattern: \"wallet_address\":\"ADDRESS\",\"name\":\"NAME\",...\"twitter\":\"URL\"

const kols = new Map();

// Find all wallet entries with their associated data
// The JSON is escaped with backslashes
const walletPattern = /\\"wallet_address\\":\\"([1-9A-HJ-NP-Za-km-z]{32,44})\\"/g;
let match;
while ((match = walletPattern.exec(html)) !== null) {
  const address = match[1];
  const startIdx = match.index;
  
  // Get surrounding context (500 chars after the match)
  const context = html.slice(startIdx, startIdx + 500);
  
  // Extract name
  const nameMatch = context.match(/\\"name\\":\\"([^\\]*?)\\"/);
  const name = nameMatch ? nameMatch[1] : null;
  
  // Extract twitter
  const twitterMatch = context.match(/\\"twitter\\":\\"(https?:[^\\]+)\\"/);
  let twitter = null;
  if (twitterMatch) {
    const twitterUrl = twitterMatch[1];
    const handleMatch = twitterUrl.match(/x\.com\/(\w+)/);
    if (handleMatch) twitter = handleMatch[1].toLowerCase();
  }
  
  if (!kols.has(address) && (name || twitter)) {
    kols.set(address, { name, twitter });
  }
}

console.log(`Found ${kols.size} unique wallets`);

const withTwitter = [...kols.values()].filter(k => k.twitter).length;
console.log(`With Twitter: ${withTwitter}`);

// Print samples
console.log('\nSample entries:');
let count = 0;
for (const [addr, data] of kols) {
  if (data.twitter && count < 20) {
    console.log(`  ${addr.slice(0,12)}... @${data.twitter.padEnd(18)} ${data.name || '-'}`);
    count++;
  }
}

// Save
const arr = [...kols.entries()].map(([address, d]) => ({
  address,
  name: d.name,
  twitter_handle: d.twitter,
}));
await fs.writeFile('kol-data/kolscan-final.json', JSON.stringify(arr, null, 2));
console.log(`\nSaved to kol-data/kolscan-final.json`);
