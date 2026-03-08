-- ============================================================
-- BLOODHOUND — Events Automation Schema
-- Run after 004_known_events.sql
-- ============================================================

-- Extend known_events with automation metadata
ALTER TABLE known_events
  ADD COLUMN IF NOT EXISTS auto_detected  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence  text CHECK (ai_confidence IN ('CONFIRMED','PROBABLE','SUSPECTED','UNKNOWN')),
  ADD COLUMN IF NOT EXISTS review_status  text NOT NULL DEFAULT 'published'
    CHECK (review_status IN ('draft', 'auto_published', 'published', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by   text REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_signals jsonb;  -- snapshot of signals that triggered detection

-- Index for pending review queue
CREATE INDEX IF NOT EXISTS idx_known_events_review
  ON known_events(review_status, created_at DESC)
  WHERE review_status = 'draft';

-- Community event submissions (separate staging table — doesn't pollute known_events)
CREATE TABLE IF NOT EXISTS event_submissions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_id  text REFERENCES users(id) ON DELETE SET NULL,
  slug          text,
  title         text NOT NULL,
  category      text NOT NULL,
  occurred_at   timestamptz NOT NULL,
  token_mint    text,
  token_symbol  text,
  description   text,
  evidence_urls text[],
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_submissions_status ON event_submissions(status, created_at DESC);
