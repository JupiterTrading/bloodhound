import fs from 'fs';

const harPath = process.argv[2] || 'c:\\Users\\guestarino\\Downloads\\dexscreener.com.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));

// Find trader log API calls
const traderEntries = har.log.entries.filter(e => 
  e.request.url.includes('/log/amm/') && 
  e.response.content.text
);

console.log(`Found ${traderEntries.length} trader log API calls`);

const allWallets = [];
const seenWallets = new Set();

traderEntries.forEach((entry, idx) => {
  try {
    const responseText = entry.response.content.text;
    
    // Extract wallet addresses using regex (Solana addresses are 32-44 chars base58)
    const walletMatches = responseText.matchAll(/([A-HJ-NP-Za-km-z1-9]{32,44})/g);
    
    for (const match of walletMatches) {
      const wallet = match[1];
      // Filter out common non-wallet strings
      if (wallet.length >= 32 && wallet.length <= 44 && !seenWallets.has(wallet)) {
        seenWallets.add(wallet);
        allWallets.push({ wallet });
      }
    }
  } catch (err) {
    // Skip errors
  }
});

console.log(`\nTotal unique wallets collected: ${allWallets.length}`);

if (allWallets.length > 0) {
  const formatted = allWallets.map(w => ({
    wallet: w.wallet,
    name: null,
    twitter: null,
    source: 'dexscreener',
    category: 'smart_money',
    scraped_at: new Date().toISOString()
  }));
  
  const outputPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\dexscreener-wallets-2026-03-14.json';
  fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2));
  console.log(`\nSaved ${formatted.length} wallets to dexscreener-wallets-2026-03-14.json`);
}
