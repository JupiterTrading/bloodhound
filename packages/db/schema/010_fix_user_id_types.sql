-- ============================================================
-- BLOODHOUND — Fix user_id types (Clerk IDs are text, not uuid)
-- Clerk user IDs look like "user_2abc123..." — not valid UUIDs.
-- Must drop all RLS policies before ALTER TYPE, then recreate them.
-- ============================================================

-- ── Step 1: Drop all RLS policies that reference user id columns ─────────────

DROP POLICY IF EXISTS "users_own"            ON users;
DROP POLICY IF EXISTS "tracked_wallets_own"  ON tracked_wallets;
DROP POLICY IF EXISTS "wallet_groups_own"    ON wallet_groups;
DROP POLICY IF EXISTS "alerts_own"           ON alerts;
DROP POLICY IF EXISTS "notifications_own"    ON notifications;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='side_wallet_disputes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "disputes_select" ON side_wallet_disputes';
    EXECUTE 'DROP POLICY IF EXISTS "disputes_insert" ON side_wallet_disputes';
    EXECUTE 'DROP POLICY IF EXISTS "disputes_delete" ON side_wallet_disputes';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_keys') THEN
    EXECUTE 'DROP POLICY IF EXISTS "api_keys_select" ON api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "api_keys_insert" ON api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "api_keys_update" ON api_keys';
  END IF;
END $$;

-- ── Step 2: Drop all FK constraints that reference users(id) ─────────────────

ALTER TABLE tracked_wallets          DROP CONSTRAINT IF EXISTS tracked_wallets_user_id_fkey;
ALTER TABLE wallet_groups            DROP CONSTRAINT IF EXISTS wallet_groups_user_id_fkey;
ALTER TABLE alerts                   DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE notifications            DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE known_wallets            DROP CONSTRAINT IF EXISTS known_wallets_submitted_by_fkey;
ALTER TABLE known_wallets            DROP CONSTRAINT IF EXISTS known_wallets_approved_by_fkey;
ALTER TABLE known_wallet_history     DROP CONSTRAINT IF EXISTS known_wallet_history_changed_by_fkey;
ALTER TABLE known_wallet_submissions DROP CONSTRAINT IF EXISTS known_wallet_submissions_submitter_id_fkey;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='side_wallet_disputes') THEN
    EXECUTE 'ALTER TABLE side_wallet_disputes DROP CONSTRAINT IF EXISTS side_wallet_disputes_user_id_fkey';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_keys') THEN
    EXECUTE 'ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='known_events' AND column_name='submitted_by') THEN
    EXECUTE 'ALTER TABLE known_events DROP CONSTRAINT IF EXISTS known_events_submitted_by_fkey';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='event_submissions') THEN
    EXECUTE 'ALTER TABLE event_submissions DROP CONSTRAINT IF EXISTS event_submissions_submitter_id_fkey';
  END IF;
END $$;

-- ── Step 3: Change column types from uuid to text ────────────────────────────

ALTER TABLE users                    ALTER COLUMN id           TYPE text;
ALTER TABLE tracked_wallets          ALTER COLUMN user_id      TYPE text;
ALTER TABLE wallet_groups            ALTER COLUMN user_id      TYPE text;
ALTER TABLE alerts                   ALTER COLUMN user_id      TYPE text;
ALTER TABLE notifications            ALTER COLUMN user_id      TYPE text;
ALTER TABLE known_wallets            ALTER COLUMN submitted_by TYPE text;
ALTER TABLE known_wallets            ALTER COLUMN approved_by  TYPE text;
ALTER TABLE known_wallet_history     ALTER COLUMN changed_by   TYPE text;
ALTER TABLE known_wallet_submissions ALTER COLUMN submitter_id TYPE text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='side_wallet_disputes') THEN
    EXECUTE 'ALTER TABLE side_wallet_disputes ALTER COLUMN user_id TYPE text';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_keys') THEN
    EXECUTE 'ALTER TABLE api_keys ALTER COLUMN user_id TYPE text';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='known_events' AND column_name='submitted_by') THEN
    EXECUTE 'ALTER TABLE known_events ALTER COLUMN submitted_by TYPE text';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='event_submissions') THEN
    EXECUTE 'ALTER TABLE event_submissions ALTER COLUMN submitter_id TYPE text';
  END IF;
END $$;

-- ── Step 4: Re-add FK constraints ────────────────────────────────────────────

ALTER TABLE tracked_wallets
  ADD CONSTRAINT tracked_wallets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE wallet_groups
  ADD CONSTRAINT wallet_groups_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE known_wallets
  ADD CONSTRAINT known_wallets_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES users(id);

ALTER TABLE known_wallets
  ADD CONSTRAINT known_wallets_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users(id);

ALTER TABLE known_wallet_history
  ADD CONSTRAINT known_wallet_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES users(id);

ALTER TABLE known_wallet_submissions
  ADD CONSTRAINT known_wallet_submissions_submitter_id_fkey
  FOREIGN KEY (submitter_id) REFERENCES users(id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='side_wallet_disputes') THEN
    EXECUTE 'ALTER TABLE side_wallet_disputes ADD CONSTRAINT side_wallet_disputes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_keys') THEN
    EXECUTE 'ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='known_events' AND column_name='submitted_by') THEN
    EXECUTE 'ALTER TABLE known_events ADD CONSTRAINT known_events_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='event_submissions') THEN
    EXECUTE 'ALTER TABLE event_submissions ADD CONSTRAINT event_submissions_submitter_id_fkey FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE SET NULL';
  END IF;
END $$;

-- ── Step 5: Recreate RLS policies ────────────────────────────────────────────

CREATE POLICY "users_own" ON users
  USING (id = auth.uid()::text);

CREATE POLICY "tracked_wallets_own" ON tracked_wallets
  USING (user_id = auth.uid()::text);

CREATE POLICY "wallet_groups_own" ON wallet_groups
  USING (user_id = auth.uid()::text);

CREATE POLICY "alerts_own" ON alerts
  USING (user_id = auth.uid()::text);

CREATE POLICY "notifications_own" ON notifications
  USING (user_id = auth.uid()::text);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='side_wallet_disputes') THEN
    EXECUTE 'CREATE POLICY "disputes_select" ON side_wallet_disputes FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "disputes_insert" ON side_wallet_disputes FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "disputes_delete" ON side_wallet_disputes FOR DELETE USING (auth.uid()::text = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_keys') THEN
    EXECUTE 'CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
    EXECUTE 'CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE USING (auth.uid()::text = user_id)';
  END IF;
END $$;
