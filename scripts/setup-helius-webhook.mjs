/**
 * BLOODHOUND — Helius Webhook Setup Script
 *
 * Creates (or re-syncs) the Helius webhook via REST API.
 * Seeds it with up to 25 high-priority addresses (exchange hot wallets +
 * top KOLs) — Helius plan limit is 25 addresses.
 *
 * All user-tracked wallets are handled by the backend polling service
 * (wallet_poller.py) rather than webhook slots.
 *
 * Run ONCE after Railway is deployed:
 *   RAILWAY_URL=https://your-api.up.railway.app node scripts/setup-helius-webhook.mjs
 *
 * To resync (e.g. after adding known wallets):
 *   RAILWAY_URL=... WEBHOOK_ID=xxx node scripts/setup-helius-webhook.mjs
 */

const SUPABASE_URL   = 'https://ndstmcyrgljnyqxbwgct.supabase.co';
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kc3RtY3lyZ2xqbnlxeGJ3Z2N0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1NjcyOSwiZXhwIjoyMDg3ODMyNzI5fQ.KimFRKrPDEwC6zeio42dMD9eFcGi1D0vImBwnlgvANg';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '62930a03-3c1a-4cfb-9f7b-d911682bddeb';
const RAILWAY_URL    = process.env.RAILWAY_URL || '';
const EXISTING_WEBHOOK_ID = process.env.WEBHOOK_ID || '';

// Priority order for the 25 webhook slots.
// Exchange hot wallets first (key for exchange detection signals),
// then funds, then KOLs.
const CATEGORY_PRIORITY = { exchange: 0, cex: 0, fund: 1, whale: 2, kol: 3, other: 4 };
const WEBHOOK_SLOT_LIMIT = 25;

const HELIUS_BASE = 'https://api.helius.xyz/v0';

// ---------------------------------------------------------------------------
// Fetch known wallets from Supabase, ordered by priority
// ---------------------------------------------------------------------------

async function fetchPriorityAddresses() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/known_wallets?select=address,category&limit=1000`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`);
  const rows = await res.json();

  // Sort by category priority, then take top WEBHOOK_SLOT_LIMIT
  return rows
    .filter(r => r.address)
    .sort((a, b) => {
      const pa = CATEGORY_PRIORITY[a.category?.toLowerCase()] ?? 99;
      const pb = CATEGORY_PRIORITY[b.category?.toLowerCase()] ?? 99;
      return pa - pb;
    })
    .slice(0, WEBHOOK_SLOT_LIMIT)
    .map(r => r.address);
}

// ---------------------------------------------------------------------------
// Generate a random webhook secret (we set this, Helius uses it to sign)
// ---------------------------------------------------------------------------

function generateSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ---------------------------------------------------------------------------
// Helius API calls
// ---------------------------------------------------------------------------

async function createWebhook(webhookURL, addresses, secret) {
  const res = await fetch(`${HELIUS_BASE}/webhooks?api-key=${HELIUS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookURL,
      transactionTypes: ['SWAP', 'TRANSFER'],
      accountAddresses: addresses,
      webhookType: 'enhanced',
      authHeader: secret,
    }),
  });
  if (!res.ok) throw new Error(`Helius create error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function updateWebhook(webhookId, webhookURL, addresses, secret) {
  const res = await fetch(`${HELIUS_BASE}/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookURL,
      transactionTypes: ['SWAP', 'TRANSFER'],
      accountAddresses: addresses,
      webhookType: 'enhanced',
      authHeader: secret,
    }),
  });
  if (!res.ok) throw new Error(`Helius update error: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log('\n🐕 BLOODHOUND — Helius Webhook Setup\n');

  if (!RAILWAY_URL) {
    console.error('❌  Set RAILWAY_URL env var first:');
    console.error('    RAILWAY_URL=https://bloodhound-api-production.up.railway.app node scripts/setup-helius-webhook.mjs\n');
    process.exit(1);
  }

  console.log('Fetching top 25 known wallets from Supabase (by priority)...');
  const addresses = await fetchPriorityAddresses();
  console.log(`  Selected ${addresses.length} addresses (exchanges first, then KOLs)\n`);

  if (addresses.length === 0) {
    console.error('❌  No known wallets found. Run seed-known-wallets.mjs first.\n');
    process.exit(1);
  }

  const webhookURL = `${RAILWAY_URL}/webhooks/helius`;
  const secret = generateSecret();

  let result;
  if (EXISTING_WEBHOOK_ID) {
    console.log(`Updating existing webhook ${EXISTING_WEBHOOK_ID}...`);
    result = await updateWebhook(EXISTING_WEBHOOK_ID, webhookURL, addresses, secret);
    console.log('  ✓ Webhook updated\n');
  } else {
    console.log(`Creating webhook → ${webhookURL}`);
    result = await createWebhook(webhookURL, addresses, secret);
    console.log('  ✓ Webhook created\n');
  }

  const webhookId = result.webhookID || result.webhook_id || result.id || EXISTING_WEBHOOK_ID;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Add these to Railway environment variables:\n');
  console.log(`  HELIUS_WEBHOOK_ID     = ${webhookId}`);
  console.log(`  HELIUS_WEBHOOK_SECRET = ${secret}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\nWebhook URL:  ${webhookURL}`);
  console.log(`Addresses:    ${addresses.length} slots used (${WEBHOOK_SLOT_LIMIT} max)`);
  console.log('\nNote: user-tracked wallets are handled by the backend polling');
  console.log('service (wallet_poller.py) — no webhook slots needed for them.\n');
  console.log('Done. ✓\n');
})();
