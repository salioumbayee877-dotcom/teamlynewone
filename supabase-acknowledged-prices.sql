-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — acknowledged_prices en product_pricing_rules
-- Permite que el popup recuerde múltiples precios por producto:
-- una vez confirmado un precio, no vuelve a salir popup para ese
-- precio, aunque haya otros precios distintos del mismo producto.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE product_pricing_rules
  ADD COLUMN IF NOT EXISTS acknowledged_prices JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: para reglas existentes, el reference_price_unit (o _bundle)
-- ya está implícitamente "acknowledged" — lo añadimos al array.
UPDATE product_pricing_rules
SET acknowledged_prices =
  CASE
    WHEN type = 'bundle' AND reference_price_bundle IS NOT NULL
      THEN jsonb_build_array(reference_price_unit, reference_price_bundle)
    ELSE jsonb_build_array(reference_price_unit)
  END
WHERE acknowledged_prices = '[]'::jsonb;
