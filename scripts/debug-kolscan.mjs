import { chromium } from 'playwright';
import fs from 'fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://kolscan.io/leaderboard', { waitUntil: 'networkidle', timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));

// Search for ANYTHING that might be Twitter-related
const twitterSearch = await page.evaluate(() => {
  const results = {
    links: [],
    svgs: [],
    images: [],
    buttons: [],
    clickableElements: [],
    dataAttributes: [],
  };

  // Check all links
  document.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const onclick = a.getAttribute('onclick') || '';
    if (href.includes('twitter') || href.includes('x.com') || onclick.includes('twitter')) {
      results.links.push({ href, onclick, text: a.textContent?.slice(0,30) });
    }
  });

  // Check all SVGs for X/Twitter logos
  document.querySelectorAll('svg').forEach(svg => {
    const parent = svg.closest('a, button, [onclick]');
    if (parent) {
      const href = parent.getAttribute('href') || '';
      const onclick = parent.getAttribute('onclick') || '';
      results.svgs.push({ 
        parentTag: parent.tagName, 
        href, 
        onclick: onclick?.slice(0,100),
        className: parent.className?.slice(0,50)
      });
    }
  });

  // Check images
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    if (src.includes('twitter') || src.includes('x.') || alt.includes('twitter') || alt.includes('X')) {
      const parent = img.closest('a, button');
      results.images.push({ src, alt, parentHref: parent?.getAttribute('href') });
    }
  });

  // Check for any element with twitter/x in data attributes
  document.querySelectorAll('*').forEach(el => {
    for (const attr of el.attributes || []) {
      if (attr.value?.includes('twitter') || attr.value?.includes('x.com')) {
        results.dataAttributes.push({ 
          tag: el.tagName, 
          attr: attr.name, 
          value: attr.value?.slice(0,100) 
        });
      }
    }
  });

  // Get full HTML of first user row
  const firstRow = document.querySelector('[class*="leaderboardUser"], [class*="user-row"], [class*="kol-row"]');
  if (firstRow) {
    results.firstRowHTML = firstRow.outerHTML.slice(0, 2000);
    results.firstRowClasses = firstRow.className;
  }

  // Also get the raw HTML around the first account link
  const firstAccount = document.querySelector('a[href*="/account/"]');
  if (firstAccount) {
    let container = firstAccount.parentElement?.parentElement?.parentElement;
    results.accountContainerHTML = container?.outerHTML?.slice(0, 1500);
  }

  return results;
});

console.log('Twitter search results:');
console.log('Links:', twitterSearch.links.length);
console.log('SVGs with parents:', twitterSearch.svgs.slice(0, 5));
console.log('Images:', twitterSearch.images);
console.log('Data attributes:', twitterSearch.dataAttributes.slice(0, 5));

// Save full HTML for analysis
const fullHTML = await page.content();
await fs.writeFile('kol-data/kolscan-page.html', fullHTML);
console.log('\nFull page HTML saved to kol-data/kolscan-page.html');

// Also take a screenshot
await page.screenshot({ path: 'kol-data/kolscan-screenshot.png', fullPage: false });
console.log('Screenshot saved to kol-data/kolscan-screenshot.png');

await browser.close();
