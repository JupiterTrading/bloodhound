-- Sprint B11: Side wallet dispute system
-- Users flag incorrect side-wallet relationships → reduces confidence ±0.05 per disputer

CREATE TABLE IF NOT EXISTS side_wallet_disputes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text NOT NULL,
  related_address text NOT NULL,
  user_id         text REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (wallet_address, related_address, user_id)
);

CREATE INDEX IF NOT EXISTS idx_disputes_wallet
  ON side_wallet_disputes (wallet_address, related_address);

ALTER TABLE side_wallet_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select" ON side_wallet_disputes;
DROP POLICY IF EXISTS "disputes_insert" ON side_wallet_disputes;
DROP POLICY IF EXISTS "disputes_delete" ON side_wallet_disputes;

-- Users can read all disputes (for display counts), insert their own, delete their own
CREATE POLICY "disputes_select" ON side_wallet_disputes FOR SELECT USING (true);
CREATE POLICY "disputes_insert" ON side_wallet_disputes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "disputes_delete" ON side_wallet_disputes
  FOR DELETE USING (auth.uid()::text = user_id::text);
