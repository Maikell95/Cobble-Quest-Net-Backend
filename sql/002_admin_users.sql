-- ==========================================
-- Cobble Quest - Admin Users Table
-- Run this in Supabase SQL Editor
-- ==========================================

-- ---- Admin Users ----
CREATE TABLE admin_users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at (reuses existing trigger function)
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write admin users (backend only)
CREATE POLICY "Service role full access on admin_users"
  ON admin_users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ==========================================
-- Insert default admin user
-- Password: changeme  (bcrypt hash)
-- CHANGE THIS PASSWORD after first login!
-- ==========================================
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '$2b$10$S.pahJHxx9Vm8U24OIXWXOcB9eHqW8Vc3NgM/52x1tS1U/8cXqTjq');
