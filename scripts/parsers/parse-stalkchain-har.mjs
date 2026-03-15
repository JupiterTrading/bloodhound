import fs from 'fs';

const harPath = process.argv[2] || 'c:\\Users\\guestarino\\Downloads\\www.stalkchain.com.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));

// StalkChain uses websockets and server-side rendering
// Extract wallet addresses from any text content
const allWallets = new Set();

har.log.entries.forEach(entry => {
  try {
    if (entry.response.content.text) {
      const text = entry.response.content.text;
      
      // Extract Solana wallet addresses (32-44 chars base58)
      const walletMatches = text.matchAll(/([A-HJ-NP-Za-km-z1-9]{32,44})/g);
      
      for (const match of walletMatches) {
        const wallet = match[1];
        // Basic validation
        if (wallet.length >= 32 && wallet.length <= 44) {
          allWallets.add(wallet);
        }
      }
    }
  } catch (err) {
    // Skip errors
  }
});

console.log(`Total unique wallets collected: ${allWallets.size}`);

if (allWallets.size > 0) {
  const formatted = Array.from(allWallets).map(wallet => ({
    wallet,
    name: null,
    twitter: null,
    source: 'stalkchain',
    category: 'kol',
    scraped_at: new Date().toISOString()
  }));
  
  const outputPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\stalkchain-wallets-2026-03-14.json';
  fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2));
  console.log(`Saved ${formatted.length} wallets to stalkchain-wallets-2026-03-14.json`);
}
