-- ============================================================
-- BLOODHOUND — Sprint B9: Stripe Customer ID
-- Adds stripe_customer_id to users table.
-- Run in Supabase SQL Editor after 001_initial.sql
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
