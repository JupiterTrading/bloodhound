-- ============================================================
-- BLOODHOUND — Known Events Schema (US-B604)
-- Run in Supabase SQL Editor after 003_known_wallets_source.sql
-- ============================================================

-- Known on-chain events: launches, scandals, hacks, airdrops
CREATE TABLE IF NOT EXISTS known_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          text UNIQUE NOT NULL,       -- URL slug: 'trump-coin-launch'
  title         text NOT NULL,             -- "$TRUMP Coin Launch"
  category      text NOT NULL              -- see CHECK below
    CHECK (category IN (
      'token_launch', 'rug_pull', 'hack', 'scandal',
      'airdrop', 'manipulation', 'collapse', 'other'
    )),
  description   text,                      -- narrative paragraph shown on event page
  occurred_at   timestamptz NOT NULL,      -- when the event happened
  token_mint    text,                      -- primary token mint if applicable
  token_symbol  text,                      -- e.g. 'TRUMP', 'BONK'
  chain         text NOT NULL DEFAULT 'solana',
  significance  text NOT NULL DEFAULT 'notable'
    CHECK (significance IN ('historic', 'notable', 'minor')),
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_known_events_slug        ON known_events(slug);
CREATE INDEX IF NOT EXISTS idx_known_events_occurred_at ON known_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_known_events_category    ON known_events(category);
CREATE INDEX IF NOT EXISTS idx_known_events_token_mint  ON known_events(token_mint) WHERE token_mint IS NOT NULL;

-- Junction: wallets involved in an event
CREATE TABLE IF NOT EXISTS event_wallets (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES known_events(id) ON DELETE CASCADE,
  address     text NOT NULL,
  role        text NOT NULL               -- deployer | early_buyer | insider | bundler | recipient | victim | team | suspicious
    CHECK (role IN (
      'deployer', 'early_buyer', 'insider', 'bundler',
      'recipient', 'victim', 'team', 'suspicious', 'other'
    )),
  description text,                       -- "bought 48min before launch tweet", "received 10M tokens day-1"
  amount_usd  numeric,                    -- dollar value of their involvement if known
  UNIQUE(event_id, address)
);

CREATE INDEX IF NOT EXISTS idx_event_wallets_address  ON event_wallets(address);
CREATE INDEX IF NOT EXISTS idx_event_wallets_event_id ON event_wallets(event_id);

-- Enable row-level security (read-only public)
ALTER TABLE known_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "known_events_public_read" ON known_events;
DROP POLICY IF EXISTS "event_wallets_public_read" ON event_wallets;

CREATE POLICY "known_events_public_read"
  ON known_events FOR SELECT USING (is_published = true);

CREATE POLICY "event_wallets_public_read"
  ON event_wallets FOR SELECT USING (true);
