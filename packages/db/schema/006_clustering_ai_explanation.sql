-- ============================================================
-- BLOODHOUND — Sprint B7: Identity Clustering AI Explanation
-- Adds ai_explanation to side_wallet_candidates table.
-- Run in Supabase SQL Editor after 001_initial.sql
-- ============================================================

ALTER TABLE side_wallet_candidates
  ADD COLUMN IF NOT EXISTS ai_explanation text;
