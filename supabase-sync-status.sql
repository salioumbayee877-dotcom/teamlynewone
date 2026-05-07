-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Auto-sync shipping rates: orders.sync_status + platform
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sync_status      TEXT NULL,
  ADD COLUMN IF NOT EXISTS unmatched_city   TEXT NULL,
  ADD COLUMN IF NOT EXISTS unmatched_region TEXT NULL,
  ADD COLUMN IF NOT EXISTS platform         TEXT NULL;

-- Index for dashboard banner queries
CREATE INDEX IF NOT EXISTS idx_orders_sync_status
  ON orders(org_id, sync_status)
  WHERE sync_status IN ('awaiting_zone_config','unmatched_zone');

-- Optional CHECK constraint (commented — apply if you want strict values)
-- ALTER TABLE orders ADD CONSTRAINT chk_sync_status
--   CHECK (sync_status IS NULL OR sync_status IN
--   ('synced','awaiting_zone_config','unmatched_zone'));

-- Backfill platform on existing orders based on note pattern
UPDATE orders SET platform = 'shopify'
  WHERE platform IS NULL AND note ILIKE '%Shopify%';
UPDATE orders SET platform = 'woocommerce'
  WHERE platform IS NULL AND note ILIKE '%WooCommerce%';
UPDATE orders SET platform = 'youcan'
  WHERE platform IS NULL AND note ILIKE '%YouCan%';
UPDATE orders SET platform = 'manual'
  WHERE platform IS NULL;

-- Backfill sync_status based on existing frais_liv: assume synced if frais set
UPDATE orders SET sync_status = 'synced'
  WHERE sync_status IS NULL AND frais_liv IS NOT NULL AND frais_liv > 0;
