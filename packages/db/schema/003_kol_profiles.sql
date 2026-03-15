-- ============================================================
-- BLOODHOUND — KOL Profiles Schema
-- Run against Supabase PostgreSQL
-- ============================================================

-- KOL Profiles (aggregates multiple wallets per person)
CREATE TABLE IF NOT EXISTS kol_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    text NOT NULL,
  twitter_handle  text UNIQUE,
  twitter_pfp_url text,
  telegram_handle text,
  description     text,
  wallet_type     text NOT NULL DEFAULT 'kol',  -- 'kol' | 'smart_money' | 'whale' | 'tracked'
  source          text NOT NULL,           -- birdeye | dune | arkham | gmgn | axiom | kolscan | dexscreener | pumpfun | fomo | manual
  verified        boolean DEFAULT false,
  -- NOTE: These are CACHED values, recalculated from wallet trades
  total_pnl_usd   float DEFAULT 0,
  win_rate        float DEFAULT 0,
  trade_count     integer DEFAULT 0,
  last_calculated_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- KOL Wallets (links wallets to profiles)
CREATE TABLE IF NOT EXISTS kol_wallets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_profile_id  uuid REFERENCES kol_profiles(id) ON DELETE CASCADE,
  address         text NOT NULL UNIQUE,
  label           text,                    -- "Main", "Side 1", etc.
  is_primary      boolean DEFAULT false,
  discovered_via  text DEFAULT 'scraped',  -- 'scraped' | 'side_wallet_detection' | 'user_submission'
  confidence      float DEFAULT 1.0,
  created_at      timestamptz DEFAULT now()
);

-- User Wallet Submissions (for review)
CREATE TABLE IF NOT EXISTS kol_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text NOT NULL,
  twitter_handle  text,
  display_name    text,
  evidence_text   text,
  evidence_urls   text[],
  submitter_id    text,  -- Clerk user ID (text type)
  status          text DEFAULT 'pending',  -- pending | approved | rejected
  reviewer_id     text,  -- Clerk user ID (text type)
  reviewer_note   text,
  created_at      timestamptz DEFAULT now(),
  reviewed_at     timestamptz
);

-- KOL Daily Stats (for rankings - aggregated from ClickHouse)
CREATE TABLE IF NOT EXISTS kol_daily_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_profile_id  uuid REFERENCES kol_profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  pnl_usd         float DEFAULT 0,
  volume_usd      float DEFAULT 0,
  trade_count     integer DEFAULT 0,
  winning_trades  integer DEFAULT 0,
  UNIQUE(kol_profile_id, date)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_kol_wallets_address ON kol_wallets(address);
CREATE INDEX IF NOT EXISTS idx_kol_wallets_profile ON kol_wallets(kol_profile_id);
CREATE INDEX IF NOT EXISTS idx_kol_profiles_twitter ON kol_profiles(twitter_handle);
CREATE INDEX IF NOT EXISTS idx_kol_profiles_pnl ON kol_profiles(total_pnl_usd DESC);
CREATE INDEX IF NOT EXISTS idx_kol_daily_stats_date ON kol_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_kol_submissions_status ON kol_submissions(status);

-- Function to update kol_profiles.updated_at on changes
CREATE OR REPLACE FUNCTION update_kol_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kol_profiles_updated_at
  BEFORE UPDATE ON kol_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_kol_profile_timestamp();

-- RLS Policies
ALTER TABLE kol_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_daily_stats ENABLE ROW LEVEL SECURITY;

-- Public read access for profiles and wallets
CREATE POLICY "Public read access" ON kol_profiles FOR SELECT USING (true);
CREATE POLICY "Public read access" ON kol_wallets FOR SELECT USING (true);
CREATE POLICY "Public read access" ON kol_daily_stats FOR SELECT USING (true);

-- Authenticated users can submit
CREATE POLICY "Authenticated users can submit" ON kol_submissions 
  FOR INSERT WITH CHECK (auth.uid()::text = submitter_id);

-- Users can view their own submissions
CREATE POLICY "Users view own submissions" ON kol_submissions 
  FOR SELECT USING (auth.uid()::text = submitter_id);
