-- ============================================================
-- BLOODHOUND — KOL Persons & Multi-Wallet Grouping
-- Groups multiple wallets under a single identity (person)
-- ============================================================

-- KOL Persons table - represents a single person/entity
CREATE TABLE IF NOT EXISTS kol_persons (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name    text NOT NULL,                    -- Primary display name (e.g., "Frank DeGods")
  twitter_handle  text UNIQUE,                      -- Primary Twitter handle
  telegram_handle text,                             -- Telegram handle
  profile_image   text,                             -- Profile image URL
  bio             text,                             -- Short bio
  aliases         text[] DEFAULT '{}',              -- Alternative names for search (e.g., ["FrankDeGods", "Frank", "frankdegods"])
  tags            text[] DEFAULT '{}',              -- Tags like ["NFT", "DeFi", "Meme coins"]
  verified        boolean NOT NULL DEFAULT false,   -- Manually verified identity
  confidence      float NOT NULL DEFAULT 0.8,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast name/alias search
CREATE INDEX idx_kol_persons_name_search ON kol_persons USING gin(to_tsvector('english', display_name || ' ' || array_to_string(aliases, ' ')));
CREATE INDEX idx_kol_persons_twitter ON kol_persons(twitter_handle);

-- Link table: associates wallets with persons
CREATE TABLE IF NOT EXISTS kol_person_wallets (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id       uuid NOT NULL REFERENCES kol_persons(id) ON DELETE CASCADE,
  wallet_address  text NOT NULL,
  wallet_label    text,                             -- Label for this specific wallet (e.g., "Main", "KOLscan", "Side wallet")
  wallet_source   text,                             -- Where this association came from
  is_primary      boolean NOT NULL DEFAULT false,   -- Is this the primary wallet?
  confidence      float NOT NULL DEFAULT 0.8,
  notes           text,                             -- Notes about this wallet
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, wallet_address)
);

CREATE INDEX idx_kol_person_wallets_address ON kol_person_wallets(wallet_address);
CREATE INDEX idx_kol_person_wallets_person ON kol_person_wallets(person_id);

-- Function to search KOL persons by name (fuzzy)
CREATE OR REPLACE FUNCTION search_kol_persons(search_query text)
RETURNS TABLE (
  id uuid,
  display_name text,
  twitter_handle text,
  telegram_handle text,
  aliases text[],
  confidence float,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.twitter_handle,
    p.telegram_handle,
    p.aliases,
    p.confidence,
    ts_rank(
      to_tsvector('english', p.display_name || ' ' || array_to_string(p.aliases, ' ')),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM kol_persons p
  WHERE 
    to_tsvector('english', p.display_name || ' ' || array_to_string(p.aliases, ' ')) 
    @@ plainto_tsquery('english', search_query)
    OR p.display_name ILIKE '%' || search_query || '%'
    OR p.twitter_handle ILIKE '%' || search_query || '%'
    OR EXISTS (SELECT 1 FROM unnest(p.aliases) AS alias WHERE alias ILIKE '%' || search_query || '%')
  ORDER BY rank DESC, p.confidence DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get all wallets for a person
CREATE OR REPLACE FUNCTION get_person_wallets(person_uuid uuid)
RETURNS TABLE (
  wallet_address text,
  wallet_label text,
  wallet_source text,
  is_primary boolean,
  confidence float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pw.wallet_address,
    pw.wallet_label,
    pw.wallet_source,
    pw.is_primary,
    pw.confidence
  FROM kol_person_wallets pw
  WHERE pw.person_id = person_uuid
  ORDER BY pw.is_primary DESC, pw.confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_kol_person_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kol_persons_updated_at
  BEFORE UPDATE ON kol_persons
  FOR EACH ROW EXECUTE FUNCTION update_kol_person_timestamp();

-- Add search_aliases column to known_wallets for backward compatibility
ALTER TABLE known_wallets ADD COLUMN IF NOT EXISTS search_aliases text[] DEFAULT '{}';
ALTER TABLE known_wallets ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES kol_persons(id);

-- Index for name search on known_wallets
CREATE INDEX IF NOT EXISTS idx_known_wallets_label_search ON known_wallets USING gin(to_tsvector('english', label));
CREATE INDEX IF NOT EXISTS idx_known_wallets_twitter ON known_wallets(twitter_handle);

-- Function to search known wallets by name
CREATE OR REPLACE FUNCTION search_known_wallets(search_query text)
RETURNS TABLE (
  address text,
  label text,
  twitter_handle text,
  telegram_handle text,
  category text,
  confidence float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kw.address,
    kw.label,
    kw.twitter_handle,
    kw.telegram_handle,
    kw.category,
    kw.confidence
  FROM known_wallets kw
  WHERE 
    kw.status = 'approved'
    AND (
      to_tsvector('english', kw.label) @@ plainto_tsquery('english', search_query)
      OR kw.label ILIKE '%' || search_query || '%'
      OR kw.twitter_handle ILIKE '%' || search_query || '%'
      OR EXISTS (SELECT 1 FROM unnest(kw.search_aliases) AS alias WHERE alias ILIKE '%' || search_query || '%')
    )
  ORDER BY kw.confidence DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
