-- Payments table: records every order (PayPal, Stripe)
CREATE TABLE IF NOT EXISTS payments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_order_id TEXT NOT NULL,
  method        TEXT NOT NULL CHECK (method IN ('paypal','stripe')),
  username      TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  payer_email   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by provider_order_id
CREATE INDEX IF NOT EXISTS idx_payments_provider_order ON payments (provider_order_id);
-- Index for user payment history
CREATE INDEX IF NOT EXISTS idx_payments_username ON payments (username);
-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- RLS: only service_role can access payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (backend uses service_role key)
CREATE POLICY "Service role full access on payments"
  ON payments FOR ALL
  USING (true)
  WITH CHECK (true);
