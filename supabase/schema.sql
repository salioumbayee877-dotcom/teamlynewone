-- ============================================================
-- Teamly – Schema Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Tabla pedidos (orders)
CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  client     TEXT        NOT NULL,
  phone      TEXT,
  prod_id    INTEGER,
  qty        INTEGER     DEFAULT 1,
  price      INTEGER     DEFAULT 0,
  city       TEXT,
  status     TEXT        DEFAULT 'pending'
               CHECK (status IN ('pending','confirmed','shipped','delivered','returned','cancelled')),
  closer     TEXT,
  livreur    TEXT,
  date       TEXT,
  ad_spend   INTEGER     DEFAULT 0,
  is_bundle  BOOLEAN     DEFAULT false,
  note       TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla productos (products)
CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  sku        TEXT        UNIQUE,
  price      INTEGER     DEFAULT 0,
  cost       INTEGER     DEFAULT 0,
  stock      INTEGER     DEFAULT 0,
  bundles    JSONB       DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security – permitir acceso anon (demo / MVP)
-- En producción usar auth.uid() por rol
-- ============================================================
ALTER TABLE orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_all"   ON orders   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_all" ON products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Datos iniciales de productos
-- ============================================================
INSERT INTO products (name, sku, price, cost, stock, bundles) VALUES
  ('Bouton de volant',     'BV-001', 8500, 2200, 45, '[{"qty":2,"price":15000}]'),
  ('Organisateur bijoux',  'OB-002', 6000, 1500, 30, '[{"qty":3,"price":15000}]'),
  ('Vernis à ongles (set)','VN-003', 4500, 1200, 80, '[{"qty":4,"price":16000}]'),
  ('Ceinture LED',         'CL-004', 7000, 1800, 20, '[]')
ON CONFLICT (sku) DO NOTHING;
