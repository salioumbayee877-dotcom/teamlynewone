-- ============================================================
-- Teamly — Columnas de entrega + tabla stock_movements
-- ============================================================
-- Ejecutar en Supabase Dashboard → SQL Editor → Run
-- 100% aditivo: no borra ni modifica datos existentes.

-- ── 1) Añadir columnas a orders ──────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at     timestamptz,
  ADD COLUMN IF NOT EXISTS amount_collected numeric,
  ADD COLUMN IF NOT EXISTS delivered_by     uuid REFERENCES auth.users(id);

-- ── 2) Crear tabla stock_movements ───────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  product_id  uuid REFERENCES products(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES auth.users(id),
  source      text NOT NULL,
  delta       integer NOT NULL,
  reason      text,
  order_id    uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org_id     ON stock_movements(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id   ON stock_movements(order_id);

-- ── 3) RLS — filtrar por org del usuario logueado ────────────
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_select" ON stock_movements;
CREATE POLICY "stock_select" ON stock_movements
  FOR SELECT USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "stock_insert" ON stock_movements;
CREATE POLICY "stock_insert" ON stock_movements
  FOR INSERT WITH CHECK (org_id = auth_org_id());

-- ── 4) Refrescar la cache de schema de PostgREST ─────────────
NOTIFY pgrst, 'reload schema';
