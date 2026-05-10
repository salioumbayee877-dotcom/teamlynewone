-- Region-aware order flow: prepaid track for non-main delivery zones
-- Run manually in Supabase SQL Editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS region_type  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type TEXT;

-- Optional: index for the livreur filter that excludes en_attente_paiement
CREATE INDEX IF NOT EXISTS idx_orders_region_status ON orders(region_type, status);
