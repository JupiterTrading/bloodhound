import fs from 'fs';

const harPath = process.argv[2] || 'c:\\Users\\guestarino\\Downloads\\kolscan.io.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));

// Find account API calls
const accountEntries = har.log.entries.filter(e => 
  e.request.url.includes('/account/') && 
  e.request.url.includes('?timeframe=') &&
  e.response.content.text
);

console.log(`Found ${accountEntries.length} account API calls`);

const allWallets = [];
const seenWallets = new Set();

accountEntries.forEach((entry, idx) => {
  try {
    // Extract wallet address from URL
    const urlMatch = entry.request.url.match(/\/account\/([A-Za-z0-9]+)\?/);
    if (!urlMatch) return;
    
    const walletAddr = urlMatch[1];
    if (seenWallets.has(walletAddr)) return;
    
    let responseText = entry.response.content.text;
    
    // Decode base64 if needed
    if (responseText.startsWith('eyJ')) {
      responseText = Buffer.from(responseText, 'base64').toString('utf8');
    }
    
    const data = JSON.parse(responseText);
    
    if (data && data.wallet) {
      seenWallets.add(walletAddr);
      allWallets.push(data.wallet);
      if (idx < 5) {
        console.log(`Sample ${idx}:`, data.wallet.name || walletAddr);
      }
    }
  } catch (err) {
    // Silently skip errors
  }
});

console.log(`\nTotal unique wallets collected: ${allWallets.length}`);

if (allWallets.length > 0) {
  const formatted = allWallets.map(w => ({
    wallet: w.address || w.wallet_address,
    name: w.name || w.displayName || null,
    twitter: w.twitter || w.twitterHandle || null,
    telegram: w.telegram || w.telegramHandle || null,
    avatar: w.profileImage || w.avatar || null,
    followers: w.followers || null,
    pnl_sol: w.pnl || w.totalPnl || null,
    winrate: w.winRate || w.winrate || null,
    total_trades: w.totalTrades || w.trades || null,
    volume_sol: w.volume || w.totalVolume || null,
    source: 'kolscan',
    category: 'kol',
    scraped_at: new Date().toISOString()
  }));
  
  const outputPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\kolscan-kols-2026-03-14.json';
  fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2));
  console.log(`\nSaved ${formatted.length} KOLs to kolscan-kols-2026-03-14.json`);
}
