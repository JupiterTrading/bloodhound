import fs from 'fs';

const harPath = process.argv[2] || 'c:\\Users\\guestarino\\Downloads\\kolscan.io.har';
const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));

// Extract wallet addresses from account URLs
const walletAddresses = new Set();
const profileImages = new Map();

har.log.entries.forEach(entry => {
  const url = entry.request.url;
  
  // Extract from account URLs
  const accountMatch = url.match(/\/account\/([A-Za-z0-9]{32,44})\?/);
  if (accountMatch) {
    walletAddresses.add(accountMatch[1]);
  }
  
  // Extract from profile image URLs
  const profileMatch = url.match(/cdn\.kolscan\.io\/profiles\/([A-Za-z0-9]{32,44})\./);
  if (profileMatch) {
    const wallet = profileMatch[1];
    walletAddresses.add(wallet);
    profileImages.set(wallet, url);
  }
});

console.log(`Found ${walletAddresses.size} unique wallet addresses`);

const formatted = Array.from(walletAddresses).map(wallet => ({
  wallet,
  name: null,
  twitter: null,
  telegram: null,
  avatar: profileImages.get(wallet) || null,
  source: 'kolscan',
  category: 'kol',
  scraped_at: new Date().toISOString()
}));

const outputPath = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\scripts\\kol-data\\kolscan-kols-2026-03-14.json';
fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2));
console.log(`Saved ${formatted.length} KOLs to kolscan-kols-2026-03-14.json`);
