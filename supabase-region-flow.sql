-- Region-aware order flow: prepaid track for non-main delivery zones
-- Run manually in Supabase SQL Editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS region_type  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type TEXT;

-- Backfill: derive region_type from existing delivery_zone_type when present
UPDATE orders
   SET region_type = delivery_zone_type
 WHERE region_type IS NULL
   AND delivery_zone_type IN ('main','other');

-- Default payment_type from region_type
UPDATE orders
   SET payment_type = CASE WHEN region_type = 'other' THEN 'prepaid' ELSE 'cod' END
 WHERE payment_type IS NULL;

-- Optional: index for the livreur filter that excludes en_attente_paiement
CREATE INDEX IF NOT EXISTS idx_orders_region_status ON orders(region_type, status);
