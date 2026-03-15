/**
 * Inspect KOLscan page structure to understand how to scrape all wallets
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Inspecting KOLscan page structure...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture all network requests
  const apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('api') || req.url().includes('graphql')) {
      apiCalls.push({ url: req.url(), method: req.method() });
    }
  });

  await page.goto('https://kolscan.io/leaderboard', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(5000);

  // Get page structure info
  const pageInfo = await page.evaluate(() => {
    const info = {
      title: document.title,
      accountLinks: document.querySelectorAll('a[href*="/account/"]').length,
      buttons: [],
      tabs: [],
      scrollableContainers: [],
    };

    // Find all buttons
    document.querySelectorAll('button').forEach(btn => {
      info.buttons.push(btn.textContent?.trim().slice(0, 50));
    });

    // Find tabs or nav elements
    document.querySelectorAll('[role="tab"], [class*="tab"], nav a').forEach(el => {
      info.tabs.push(el.textContent?.trim().slice(0, 30));
    });

    // Find scrollable containers
    document.querySelectorAll('div').forEach(div => {
      const style = getComputedStyle(div);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        info.scrollableContainers.push({
          className: div.className?.slice(0, 50),
          height: div.scrollHeight,
          children: div.children.length,
        });
      }
    });

    // Get a sample of account links with their parent structure
    const samples = [];
    document.querySelectorAll('a[href*="/account/"]').forEach((link, i) => {
      if (i < 3) {
        const parent = link.closest('div');
        samples.push({
          href: link.getAttribute('href'),
          text: link.textContent?.trim().slice(0, 100),
          parentClass: parent?.className?.slice(0, 50),
          parentHTML: parent?.innerHTML?.slice(0, 500),
        });
      }
    });
    info.sampleLinks = samples;

    return info;
  });

  console.log('Page Info:');
  console.log(`  Title: ${pageInfo.title}`);
  console.log(`  Account links: ${pageInfo.accountLinks}`);
  console.log(`  Buttons: ${pageInfo.buttons.slice(0, 10).join(', ')}`);
  console.log(`  Tabs: ${pageInfo.tabs.slice(0, 10).join(', ')}`);
  console.log(`  Scrollable containers: ${pageInfo.scrollableContainers.length}`);
  
  console.log('\nAPI Calls:');
  apiCalls.slice(0, 10).forEach(c => console.log(`  ${c.method} ${c.url}`));

  // Try scrolling in different ways
  console.log('\nTrying scroll interactions...');
  
  // Find and scroll main content
  const scrollResults = await page.evaluate(async () => {
    const results = [];
    
    // Try to find main scrollable container
    const containers = [...document.querySelectorAll('div')].filter(d => {
      const s = getComputedStyle(d);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > 500;
    });

    for (const container of containers.slice(0, 3)) {
      const before = document.querySelectorAll('a[href*="/account/"]').length;
      
      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
      await new Promise(r => setTimeout(r, 2000));
      
      const after = document.querySelectorAll('a[href*="/account/"]').length;
      results.push({ before, after, scrolled: container.className?.slice(0, 30) });
    }

    return results;
  });

  console.log('Scroll results:', scrollResults);

  // Save sample link data
  console.log('\nSample links:');
  pageInfo.sampleLinks?.forEach(s => {
    console.log(`  ${s.href}`);
    console.log(`    Text: ${s.text?.slice(0, 80)}`);
  });

  // Try clicking different tabs
  console.log('\nTrying tab interactions...');
  const tabElements = await page.$$('[role="tab"], [class*="tab"] button, button');
  
  for (const tab of tabElements.slice(0, 5)) {
    const text = await tab.textContent();
    if (text?.toLowerCase().includes('all') || text?.toLowerCase().includes('monthly') || text?.toLowerCase().includes('weekly')) {
      console.log(`  Clicking: ${text?.trim()}`);
      try {
        await tab.click();
        await sleep(3000);
        const count = await page.evaluate(() => document.querySelectorAll('a[href*="/account/"]').length);
        console.log(`    Account links after: ${count}`);
      } catch {}
    }
  }

  await browser.close();
  
  // Save full info
  await fs.mkdir('kol-data', { recursive: true });
  await fs.writeFile('kol-data/kolscan-inspect.json', JSON.stringify(pageInfo, null, 2));
  console.log('\nSaved inspection data to kol-data/kolscan-inspect.json');
}

main().catch(console.error);
