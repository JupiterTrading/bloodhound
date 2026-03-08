-- Sprint B13: API key management for Pro subscribers

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL DEFAULT 'Default',
  key_hash     text NOT NULL UNIQUE,   -- SHA-256 of the raw key (never store plaintext)
  key_prefix   text NOT NULL,          -- First 12 chars of raw key (for display)
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = true;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON api_keys;

-- Users can only see and manage their own keys
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE USING (auth.uid()::text = user_id::text);
