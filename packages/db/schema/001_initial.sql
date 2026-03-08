-- ============================================================
-- BLOODHOUND — Initial Supabase Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,         -- Clerk user ID e.g. "user_2abc..." (not a UUID)
  email         text UNIQUE,
  display_name  text,
  twitter_handle text,
  tier          text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'pro', 'enterprise')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- WALLET GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_groups (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TRACKED WALLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS tracked_wallets (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address     text NOT NULL,
  label       text NOT NULL,
  group_id    uuid REFERENCES wallet_groups(id) ON DELETE SET NULL,
  is_own      boolean NOT NULL DEFAULT false,  -- user's own wallet (private)
  tags        text[],
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, address)
);

CREATE INDEX idx_tracked_wallets_user ON tracked_wallets(user_id);
CREATE INDEX idx_tracked_wallets_address ON tracked_wallets(address);

-- ============================================================
-- KNOWN WALLETS (community-submitted, dev-approved)
-- ============================================================
CREATE TABLE IF NOT EXISTS known_wallets (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  address         text UNIQUE NOT NULL,
  label           text NOT NULL,
  category        text NOT NULL
    CHECK (category IN (
      'kol', 'known_figure', 'profitable_trader',
      'protocol_team', 'exchange', 'suspected_bad_actor'
    )),
  description     text,
  twitter_handle  text,
  telegram_handle text,
  confidence      float NOT NULL DEFAULT 1.0,
  submitted_by    text REFERENCES users(id),
  approved_by     text REFERENCES users(id),
  approved_at     timestamptz,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_known_wallets_address ON known_wallets(address);
CREATE INDEX idx_known_wallets_status ON known_wallets(status);

-- ============================================================
-- KNOWN WALLET HISTORY (version tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS known_wallet_history (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id   uuid NOT NULL REFERENCES known_wallets(id) ON DELETE CASCADE,
  label       text,
  category    text,
  description text,
  changed_by  text REFERENCES users(id),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- KNOWN WALLET SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS known_wallet_submissions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  address         text NOT NULL,
  label           text NOT NULL,
  category        text NOT NULL,
  evidence_text   text,
  evidence_urls   text[],           -- Supabase Storage paths (PNG/JPG max 10MB)
  twitter_handle  text,
  telegram_handle text,
  submitter_id    text NOT NULL REFERENCES users(id),
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
  reviewer_note   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SIDE WALLET CANDIDATES (computed, user-disputable)
-- ============================================================
CREATE TABLE IF NOT EXISTS side_wallet_candidates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_a        text NOT NULL,
  wallet_b        text NOT NULL,
  confidence      float NOT NULL,
  signals         jsonb NOT NULL,       -- array of signal names that triggered flag
  signal_weights  jsonb NOT NULL,       -- {signal_name: weight} breakdown
  user_votes      jsonb NOT NULL DEFAULT '{}',  -- {user_id: 'confirm'|'dispute'}
  community_score float NOT NULL DEFAULT 0.5,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_a, wallet_b)
);

CREATE INDEX idx_side_wallet_a ON side_wallet_candidates(wallet_a);
CREATE INDEX idx_side_wallet_b ON side_wallet_candidates(wallet_b);
CREATE INDEX idx_side_wallet_confidence ON side_wallet_candidates(confidence DESC);

-- ============================================================
-- WALLET CLASSIFICATIONS (cached AI output)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_classifications (
  address     text PRIMARY KEY,
  labels      text[],
  confidence  jsonb,
  signals     jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address  text NOT NULL,
  alert_type      text NOT NULL
    CHECK (alert_type IN (
      'any_tx', 'sends_to', 'receives_from',
      'token_trade', 'balance_threshold', 'inter_tracked'
    )),
  conditions      jsonb NOT NULL,
  delivery        text[] NOT NULL DEFAULT ARRAY['in_app'],
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_wallet ON alerts(wallet_address);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = true;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  content     jsonb NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================
-- WALLET EMBEDDINGS (pgvector — behavioral similarity)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_embeddings (
  address     text PRIMARY KEY,
  embedding   vector(1536),
  model       text NOT NULL DEFAULT 'voyage-large-2',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own record
CREATE POLICY "users_own" ON users
  USING (id = auth.uid());

-- Users can only CRUD their own tracked wallets
CREATE POLICY "tracked_wallets_own" ON tracked_wallets
  USING (user_id = auth.uid());

-- Users can only CRUD their own groups
CREATE POLICY "wallet_groups_own" ON wallet_groups
  USING (user_id = auth.uid());

-- Users can only manage their own alerts
CREATE POLICY "alerts_own" ON alerts
  USING (user_id = auth.uid());

-- Users can only read their own notifications
CREATE POLICY "notifications_own" ON notifications
  USING (user_id = auth.uid());

-- Known wallets are public read for all
CREATE POLICY "known_wallets_public_read" ON known_wallets
  FOR SELECT USING (status = 'approved');
