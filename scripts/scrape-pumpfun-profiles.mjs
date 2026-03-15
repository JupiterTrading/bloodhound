/**
 * BLOODHOUND — Pump.fun Profile Scraper
 * 
 * Scrapes Pump.fun profile pages to extract linked Twitter handles.
 * Takes wallet addresses from existing known_wallets and enriches with Twitter data.
 * 
 * Usage:
 *   node scripts/scrape-pumpfun-profiles.mjs
 *   node scripts/scrape-pumpfun-profiles.mjs --limit 100
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

const SUPABASE_URL = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';

const OUTPUT_FILE = 'scripts/pumpfun-profiles.json';
const PUMP_BASE = 'https://pump.fun';

const sleep = ms => new Promise(r => setTimeout(r, ms));

class PumpFunScraper {
  constructor() {
    this.profiles = new Map(); // address -> { name, twitter_handle, bio, tokens_created }
    this.browser = null;
    this.page = null;
    this.rateLimitHits = 0;
  }

  async init() {
    console.log('[Pump.fun] Launching browser...');
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set realistic viewport and user agent
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
  }

  async fetchKnownWallets(limit = 500) {
    console.log('[Pump.fun] Fetching known wallets from Supabase...');
    
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/known_wallets?select=address,label,twitter_handle&limit=${limit}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          }
        }
      );
      
      if (!res.ok) {
        console.warn(`[Pump.fun] Supabase error: ${res.status}`);
        return [];
      }
      
      const wallets = await res.json();
      // Prioritize wallets without Twitter handles
      const needsEnrichment = wallets.filter(w => !w.twitter_handle);
      const hasTwitter = wallets.filter(w => w.twitter_handle);
      
      console.log(`  Total: ${wallets.length}, Need enrichment: ${needsEnrichment.length}`);
      return [...needsEnrichment, ...hasTwitter];
    } catch (error) {
      console.error(`[Pump.fun] Failed to fetch wallets: ${error.message}`);
      return [];
    }
  }

  async scrapeProfile(address) {
    const url = `${PUMP_BASE}/profile/${address}`;
    
    try {
      const response = await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });

      // Check for rate limiting
      if (response?.status() === 429) {
        this.rateLimitHits++;
        console.warn(`[Pump.fun] Rate limited (${this.rateLimitHits}x). Waiting 30s...`);
        await sleep(30000);
        return null;
      }

      // Wait for profile content
      await sleep(1500);

      // Extract profile data from DOM
      const profileData = await this.page.evaluate(() => {
        const result = {
          name: null,
          twitter_handle: null,
          bio: null,
          tokens_created: 0,
          followers: 0,
          pnl: null,
        };

        // Name / Display name - usually in a prominent heading
        const nameSelectors = [
          'h1', 'h2', 
          '[class*="username"]', 
          '[class*="displayName"]',
          '[class*="profile-name"]',
          '[class*="ProfileName"]',
        ];
        for (const sel of nameSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.textContent?.trim();
            // Filter out obvious non-names
            if (text && text.length > 1 && text.length < 50 && !text.includes('Profile') && !text.includes('404')) {
              result.name = text;
              break;
            }
          }
        }

        // Twitter handle - look for links and displayed handles
        const twitterPatterns = [
          'a[href*="twitter.com"]',
          'a[href*="x.com"]',
          '[class*="twitter"]',
          '[class*="social"] a',
        ];
        for (const sel of twitterPatterns) {
          const el = document.querySelector(sel);
          if (el) {
            const href = el.getAttribute('href') || '';
            const text = el.textContent?.trim() || '';
            
            // Extract handle from URL
            const urlMatch = href.match(/(?:twitter\.com|x\.com)\/(@?[\w]+)/);
            if (urlMatch) {
              result.twitter_handle = urlMatch[1].replace('@', '');
              break;
            }
            
            // Or from text content
            const textMatch = text.match(/@([\w]+)/);
            if (textMatch) {
              result.twitter_handle = textMatch[1];
              break;
            }
          }
        }

        // Bio / Description
        const bioSelectors = [
          '[class*="bio"]',
          '[class*="description"]',
          '[class*="about"]',
          'p[class*="text"]',
        ];
        for (const sel of bioSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.textContent?.trim();
            if (text && text.length > 10 && text.length < 500) {
              result.bio = text;
              break;
            }
          }
        }

        // Tokens created count
        const tokenCountEl = document.querySelector('[class*="created"], [class*="tokens"]');
        if (tokenCountEl) {
          const match = tokenCountEl.textContent?.match(/(\d+)/);
          if (match) {
            result.tokens_created = parseInt(match[1]);
          }
        }

        // Check if profile exists (404 detection)
        const body = document.body.textContent?.toLowerCase() || '';
        if (body.includes('not found') || body.includes('404') || body.includes('no profile')) {
          return null;
        }

        return result;
      });

      if (profileData) {
        this.profiles.set(address, {
          ...profileData,
          scraped_at: new Date().toISOString(),
        });
        
        const hasTwitter = profileData.twitter_handle ? `@${profileData.twitter_handle}` : '-';
        const hasName = profileData.name || '-';
        console.log(`[+] ${address.slice(0, 8)}... | ${hasName.padEnd(20)} | ${hasTwitter}`);
        
        return profileData;
      }

      return null;
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.warn(`[Pump.fun] Timeout on ${address.slice(0, 8)}...`);
      } else {
        console.warn(`[Pump.fun] Error on ${address.slice(0, 8)}...: ${error.message}`);
      }
      return null;
    }
  }

  async updateSupabase(updates) {
    if (!updates.length) return 0;
    
    console.log(`\n[Pump.fun] Updating ${updates.length} wallets in Supabase...`);
    let updated = 0;

    for (const { address, twitter_handle } of updates) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/known_wallets?address=eq.${address}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ twitter_handle }),
          }
        );
        
        if (res.ok) {
          updated++;
        }
      } catch (error) {
        console.warn(`[Pump.fun] Failed to update ${address.slice(0, 8)}...`);
      }
    }

    console.log(`  Updated: ${updated}`);
    return updated;
  }

  async run(limit = 200) {
    await this.init();

    // Get wallets to scrape
    const wallets = await this.fetchKnownWallets(limit);
    if (!wallets.length) {
      console.log('[Pump.fun] No wallets to process');
      await this.browser.close();
      return;
    }

    console.log(`\n[Pump.fun] Scraping ${Math.min(limit, wallets.length)} profiles...\n`);

    let processed = 0;
    const twitterFound = [];

    for (const wallet of wallets.slice(0, limit)) {
      const profile = await this.scrapeProfile(wallet.address);
      processed++;

      if (profile?.twitter_handle && !wallet.twitter_handle) {
        twitterFound.push({
          address: wallet.address,
          twitter_handle: profile.twitter_handle,
        });
      }

      // Progress update every 10
      if (processed % 10 === 0) {
        console.log(`[Pump.fun] Progress: ${processed}/${Math.min(limit, wallets.length)}, Twitter found: ${twitterFound.length}`);
      }

      // Rate limiting: wait between requests
      const delay = 1000 + Math.random() * 1000; // 1-2 seconds
      await sleep(delay);

      // Back off if hitting rate limits
      if (this.rateLimitHits >= 3) {
        console.warn('[Pump.fun] Too many rate limits. Stopping early.');
        break;
      }
    }

    // Save results
    await this.save();

    // Update Supabase with new Twitter handles
    if (twitterFound.length > 0) {
      await this.updateSupabase(twitterFound);
    }

    await this.browser.close();

    // Summary
    console.log('\n=== PUMP.FUN SCRAPE COMPLETE ===');
    console.log(`Processed: ${processed}`);
    console.log(`Profiles found: ${this.profiles.size}`);
    console.log(`New Twitter handles: ${twitterFound.length}`);
  }

  async save() {
    const profileArray = Array.from(this.profiles.entries()).map(([address, data]) => ({
      address,
      ...data,
    }));

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(profileArray, null, 2));
    console.log(`\n[Pump.fun] Saved ${profileArray.length} profiles to ${OUTPUT_FILE}`);
  }
}

// CLI
const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 && args[limitArg + 1] 
  ? parseInt(args[limitArg + 1]) 
  : 200;

const scraper = new PumpFunScraper();
scraper.run(limit).catch(err => {
  console.error('[Pump.fun] Fatal error:', err);
  process.exit(1);
});
