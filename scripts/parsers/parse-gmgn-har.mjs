import fs from 'fs';

const harPath = process.argv[2] || 'c:\\Users\\guestarino\\Downloads\\gmgn.ai.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));

// Find wallet ranking API calls
const walletEntries = har.log.entries.filter(e => 
  e.request.url.includes('/rank/sol/wallets') && 
  e.response.content.text
);

console.log(`Found ${walletEntries.length} wallet ranking API calls`);

const allWallets = [];
const seenWallets = new Set();

walletEntries.forEach((entry, idx) => {
  try {
    let responseText = entry.response.content.text;
    
    // Decode base64 if needed
    if (responseText.startsWith('eyJ')) {
      responseText = Buffer.from(responseText, 'base64').toString('utf8');
    }
    
    const data = JSON.parse(responseText);
    console.log(`Entry ${idx}: Processing...`);
    
    if (data.data && data.data.rank) {
      const wallets = data.data.rank;
      console.log(`  Found ${wallets.length} wallets`);
      
      wallets.forEach(w => {
        const walletAddr = w.wallet_address;
        if (walletAddr && !seenWallets.has(walletAddr)) {
          seenWallets.add(walletAddr);
          allWallets.push(w);
        }
      });
    }
  } catch (err) {
    console.error(`Error parsing entry ${idx}:`, err.message);
  }
});

console.log(`\nTotal unique wallets collected: ${allWallets.length}`);

if (allWallets.length > 0) {
  console.log('\nSample wallet:', JSON.stringify(allWallets[0], null, 2).substring(0, 600));
  
  const formatted = allWallets.map(w => ({
    wallet: w.wallet_address,
    name: w.name || w.wallet_tag_v2 || null,
    twitter: w.twitter_username || null,
    telegram: w.telegram_username || null,
    avatar: w.avatar || null,
    tags: w.tags || [],
    pnl_1d: w.pnl_1d || null,
    pnl_7d: w.pnl_7d || null,
    pnl_30d: w.pnl_30d || null,
    winrate: w.winrate || null,
    winrate_1d: w.winrate_1d || null,
    winrate_7d: w.winrate_7d || null,
    winrate_30d: w.winrate_30d || null,
    realized_profit_1d: w.realized_profit_1d || null,
    realized_profit_7d: w.realized_profit_7d || null,
    realized_profit_30d: w.realized_profit_30d || null,
    buy_30d: w.buy_30d || null,
    sell_30d: w.sell_30d || null,
    last_active_timestamp: w.last_active_timestamp || null,
    wallet_tag_v2: w.wallet_tag_v2 || null,
    is_kol: w.tags?.includes('renowned') || w.tags?.includes('kol') || false,
    is_smart_money: w.tags?.includes('smart_degen') || w.tags?.includes('pump_smart') || w.tags?.includes('launchpad_smart') || false,
    source: 'gmgn',
    category: (w.tags?.includes('renowned') || w.tags?.includes('kol')) ? 'kol' : 'smart_money',
    scraped_at: new Date().toISOString()
  }));
  
  // Split into KOLs and Smart Money
  const kols = formatted.filter(w => w.is_kol);
  const smartMoney = formatted.filter(w => !w.is_kol);
  
  const kolPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\gmgn-kols-2026-03-14.json';
  const smartPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\gmgn-smart-money-2026-03-14.json';
  
  fs.writeFileSync(kolPath, JSON.stringify(kols, null, 2));
  fs.writeFileSync(smartPath, JSON.stringify(smartMoney, null, 2));
  
  console.log(`\nSaved ${kols.length} KOLs to gmgn-kols-2026-03-14.json`);
  console.log(`Saved ${smartMoney.length} Smart Money wallets to gmgn-smart-money-2026-03-14.json`);
}
