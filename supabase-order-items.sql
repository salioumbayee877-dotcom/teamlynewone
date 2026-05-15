-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — order_items (Fase 1: schema + backfill)
-- Ejecutar en: Supabase → SQL Editor → New query
--
-- Objetivo: soportar pedidos multi-producto, multi-cantidad y
-- packs (bundles) con descuentos reales por línea, para que
-- Compta calcule revenue/coût/bénéfice correctamente.
--
-- Estrategia: NO se borra ni renombra nada en `orders`. Se añade
-- una tabla hija `order_items` (1 fila por línea del pedido) y
-- se hace backfill 1:1 a partir de los pedidos existentes para
-- mantener compatibilidad con todo el código actual.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Columnas cache en orders (no rompen nada) ────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_discount NUMERIC NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_count    INTEGER NULL DEFAULT 1;

-- ── 2. Tabla order_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Producto del catálogo (nullable: pedidos webhook pueden no matchear)
  product_id         UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  product_name       TEXT NOT NULL,        -- snapshot del nombre al momento del pedido

  -- Cantidades
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  pack_quantity      INTEGER NOT NULL DEFAULT 1 CHECK (pack_quantity > 0),
  -- unidades reales vendidas = quantity * pack_quantity
  -- (lo dejamos como columna generada para queries de stock/compta)
  units_total        INTEGER GENERATED ALWAYS AS (quantity * pack_quantity) STORED,

  -- Precios (CFA, sin decimales pero numeric por seguridad)
  unit_price         NUMERIC NOT NULL DEFAULT 0,   -- precio por "quantity" (pack o unidad)
  line_total         NUMERIC NOT NULL DEFAULT 0,   -- = quantity * unit_price (antes de descuento)
  discount_amount    NUMERIC NOT NULL DEFAULT 0,   -- descuento aplicado a esta línea

  -- Metadatos webhook (para auditar y mejorar regex de pack detection)
  raw_variant_title  TEXT NULL,            -- ej. "Pack de 3", "x2", "Combo familial"
  raw_product_name   TEXT NULL,            -- nombre original del payload (antes del match)

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org_id     ON order_items(org_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(org_id, product_id)
  WHERE product_id IS NOT NULL;

-- ── 4. RLS ──────────────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "order_items_update" ON order_items
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "order_items_delete" ON order_items
  FOR DELETE USING (org_id = auth_org_id());

-- ── 5. Backfill: 1 order_items por pedido existente ─────────────
-- Para pedidos antiguos asumimos quantity=1, pack_quantity=1, sin descuento.
-- Compta seguirá calculando igual que hoy con estos datos.
INSERT INTO order_items (
  order_id, org_id, product_id, product_name,
  quantity, pack_quantity, unit_price, line_total, discount_amount,
  raw_variant_title, raw_product_name, created_at
)
SELECT
  o.id,
  o.org_id,
  p.id,                                  -- match por nombre (puede ser NULL)
  COALESCE(o.product, 'Produit'),        -- snapshot
  1,                                     -- quantity
  1,                                     -- pack_quantity
  COALESCE(o.price, 0),                  -- unit_price = price total (era 1 unidad)
  COALESCE(o.price, 0),                  -- line_total
  0,                                     -- discount_amount
  NULL,                                  -- raw_variant_title
  o.product,                             -- raw_product_name
  COALESCE(o.created_at, NOW())
FROM orders o
LEFT JOIN products p
  ON p.org_id = o.org_id
 AND LOWER(p.name) = LOWER(o.product)
WHERE NOT EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
);

-- ── 6. Backfill items_count en orders ───────────────────────────
UPDATE orders o
SET items_count = (
  SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id
)
WHERE items_count IS NULL OR items_count = 1;

-- ═══════════════════════════════════════════════════════════════
-- Verificación post-migración (queries opcionales para correr a mano):
--
-- 1) Conteo: cada order debe tener al menos 1 order_items
--   SELECT COUNT(*) FROM orders o
--   WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id);
--   -- Esperado: 0
--
-- 2) Sumas: line_total - discount debe coincidir con orders.price (legacy)
--   SELECT o.id, o.price,
--     (SELECT SUM(line_total - discount_amount) FROM order_items WHERE order_id = o.id) AS items_sum
--   FROM orders o LIMIT 20;
--   -- Esperado: price == items_sum
--
-- 3) Match de productos backfilled
--   SELECT COUNT(*) FILTER (WHERE product_id IS NOT NULL) AS matched,
--          COUNT(*) FILTER (WHERE product_id IS NULL)     AS unmatched
--   FROM order_items;
-- ═══════════════════════════════════════════════════════════════
