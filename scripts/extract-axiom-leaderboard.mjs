import fs from 'fs';

const harPath = process.argv[2] || 'c:\\Users\\guestarino\\Downloads\\axiom.trade.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));

const lbEntries = har.log.entries.filter(e => 
  e.request.url.includes('vision-leaderboard') && 
  e.response.content.text
);

console.log(`Found ${lbEntries.length} leaderboard requests`);

const allWallets = [];
lbEntries.forEach((entry, idx) => {
  try {
    const data = JSON.parse(entry.response.content.text);
    console.log(`Entry ${idx}: type=${typeof data}, isArray=${Array.isArray(data)}`);
    
    if (data.wallets && Array.isArray(data.wallets)) {
      data.wallets.forEach(w => allWallets.push(w));
    } else if (Array.isArray(data)) {
      data.forEach(w => allWallets.push(w));
    } else if (data.data && Array.isArray(data.data)) {
      data.data.forEach(w => allWallets.push(w));
    } else {
      console.log('Unknown structure:', Object.keys(data));
    }
  } catch (err) {
    console.error(`Error parsing entry ${idx}:`, err.message);
  }
});

console.log(`\nTotal wallets collected: ${allWallets.length}`);

if (allWallets.length > 0) {
  console.log('\nSample wallet:', JSON.stringify(allWallets[0], null, 2).substring(0, 500));
  
  const formatted = allWallets.map(w => ({
    wallet: w.wallet_address || w.walletAddress || w.address || w.wallet,
    name: w.name || w.displayName || null,
    twitter: w.twitterUrl ? w.twitterUrl.replace('https://x.com/', '').replace('https://twitter.com/', '') : (w.twitter || null),
    pnl_sol: w.total_pnl_sol || w.pnl || null,
    pnl_usd: w.total_pnl_usd || null,
    volume_sol: w.total_volume_sol || null,
    volume_usd: w.total_volume_usd || null,
    winning_positions: w.total_winning_positions || null,
    losing_positions: w.total_losing_positions || null,
    total_buys: w.total_buys || null,
    total_sells: w.total_sells || null,
    avg_hold_time_ms: w.average_hold_time_ms || null,
    winRate: w.total_winning_positions && w.total_losing_positions ? 
      (w.total_winning_positions / (w.total_winning_positions + w.total_losing_positions)) : null,
    rank: w.rank || null,
    source: 'axiom_global',
    category: 'smart_money',
    scraped_at: new Date().toISOString()
  }));
  
  const outputPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\axiom-global-wallets-2026-03-13.json';
  fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2));
  console.log(`\nSaved ${formatted.length} global wallets to axiom-global-wallets-2026-03-13.json`);
}
