import fs from 'fs';
import https from 'https';
import { pipeline } from 'stream/promises';

const logos = [
  {
    name: 'axiom',
    url: 'https://axiom.trade/favicon.ico',
    filename: 'axiom.ico'
  },
  {
    name: 'gmgn',
    url: 'https://gmgn.ai/favicon.ico',
    filename: 'gmgn.ico'
  },
  {
    name: 'kolscan',
    url: 'https://kolscan.io/favicon.ico',
    filename: 'kolscan.ico'
  },
  {
    name: 'dexscreener',
    url: 'https://dexscreener.com/favicon.ico',
    filename: 'dexscreener.ico'
  },
  {
    name: 'stalkchain',
    url: 'https://www.stalkchain.com/favicon.ico',
    filename: 'stalkchain.ico'
  },
  {
    name: 'pumpfun',
    url: 'https://pump.fun/icon.png',
    filename: 'pumpfun.png'
  }
];

const outputDir = 'c:\\Users\\guestarino\\CascadeProjects\\bloodhound\\apps\\web\\public\\logos';

async function downloadLogo(logo) {
  return new Promise((resolve, reject) => {
    https.get(logo.url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(`${outputDir}\\${logo.filename}`);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✓ Downloaded ${logo.name}`);
          resolve();
        });
      } else {
        console.log(`✗ Failed to download ${logo.name}: ${response.statusCode}`);
        resolve();
      }
    }).on('error', (err) => {
      console.log(`✗ Error downloading ${logo.name}:`, err.message);
      resolve();
    });
  });
}

console.log('Downloading company logos...\n');

for (const logo of logos) {
  await downloadLogo(logo);
}

console.log('\nDone!');
