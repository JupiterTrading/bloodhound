-- ============================================================
-- BLOODHOUND — Migration 003: Add source column to known_wallets
-- Run in Supabase SQL editor: https://supabase.com/dashboard
-- ============================================================
-- Tracks where a wallet label came from so we can:
--   - Filter by source when re-running seeders
--   - Show provenance in the UI ("Labeled by KOLscan")
--   - Audit confidence levels per source
-- ============================================================

ALTER TABLE known_wallets
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN known_wallets.source IS
  'Origin of the wallet label. Examples: manual_verified, kolscan_leaderboard, dune_query, helius_identity, solscan_label, user_submitted';

-- Backfill existing rows
UPDATE known_wallets
  SET source = 'manual_verified'
  WHERE source IS NULL AND category IN ('protocol_team', 'exchange');

UPDATE known_wallets
  SET source = 'kolscan_leaderboard'
  WHERE source IS NULL AND category = 'kol';
