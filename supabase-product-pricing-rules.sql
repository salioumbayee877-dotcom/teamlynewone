-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — product_pricing_rules
-- Tabla que guarda las reglas de precio identificadas por el usuario
-- en el popup ProductAnalysisPopup. Una vez guardada la regla,
-- los siguientes pedidos del mismo producto + mismo precio NO
-- vuelven a disparar el popup.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_pricing_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_name            TEXT NOT NULL,

  -- "unit" | "bundle" | "discount"
  type                    TEXT NOT NULL DEFAULT 'unit',

  -- bundle
  bundle_quantity         INTEGER NULL,
  reference_price_unit    NUMERIC NULL,
  reference_price_bundle  NUMERIC NULL,

  -- discount (baisse)
  discount_percentage     INTEGER NULL,
  discount_type           TEXT NULL,   -- 'ponctuel' | 'permanent'

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_org      ON product_pricing_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_org_name ON product_pricing_rules(org_id, product_name);

-- RLS (idempotente)
ALTER TABLE product_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_select" ON product_pricing_rules;
DROP POLICY IF EXISTS "pricing_insert" ON product_pricing_rules;
DROP POLICY IF EXISTS "pricing_update" ON product_pricing_rules;
DROP POLICY IF EXISTS "pricing_delete" ON product_pricing_rules;

CREATE POLICY "pricing_select" ON product_pricing_rules
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "pricing_insert" ON product_pricing_rules
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "pricing_update" ON product_pricing_rules
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "pricing_delete" ON product_pricing_rules
  FOR DELETE USING (org_id = auth_org_id());
