-- ============================================================
-- Add backfill tracking columns to wallet_rankings
-- ============================================================

ALTER TABLE wallet_rankings
ADD COLUMN IF NOT EXISTS backfill_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS backfill_last_run timestamptz,
ADD COLUMN IF NOT EXISTS backfill_trade_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS backfill_error text;

-- Create index for efficient backfill queue queries
CREATE INDEX IF NOT EXISTS idx_wallet_rankings_backfill 
ON wallet_rankings(backfill_status, tier, total_pnl_usd DESC)
WHERE backfill_status IN ('pending', 'partial', 'error');

-- Add comment
COMMENT ON COLUMN wallet_rankings.backfill_status IS 'Backfill status: pending, partial, complete, error';
COMMENT ON COLUMN wallet_rankings.backfill_last_run IS 'Last time backfill worker processed this wallet';
COMMENT ON COLUMN wallet_rankings.backfill_trade_count IS 'Number of trades fetched during backfill';
COMMENT ON COLUMN wallet_rankings.backfill_error IS 'Error message if backfill failed';
