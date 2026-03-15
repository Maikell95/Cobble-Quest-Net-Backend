-- ==========================================
-- Cobble Quest - Database Schema
-- Run this in Supabase SQL Editor
-- ==========================================

-- ---- Store Items ----
CREATE TABLE store_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  image       TEXT NOT NULL DEFAULT '',
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category    TEXT NOT NULL CHECK (category IN ('keys', 'breeding', 'battlepass', 'extras')),
  description TEXT NOT NULL DEFAULT '',
  discount    NUMERIC(5,2) DEFAULT NULL CHECK (discount IS NULL OR (discount >= 0 AND discount <= 100)),
  commands    TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Events ----
CREATE TABLE events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  start_date  TEXT NOT NULL DEFAULT '',
  end_date    TEXT NOT NULL DEFAULT '',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at ----
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER store_items_updated_at
  BEFORE UPDATE ON store_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- Row Level Security ----

-- Store Items: public can read active, service_role can do everything
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active store items"
  ON store_items FOR SELECT
  USING (active = true);

CREATE POLICY "Service role full access to store items"
  ON store_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Events: public can read active, service_role can do everything
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active events"
  ON events FOR SELECT
  USING (active = true);

CREATE POLICY "Service role full access to events"
  ON events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
