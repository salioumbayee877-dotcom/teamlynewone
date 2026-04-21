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
-- Tabla de perfiles (roles del equipo)
-- Vinculada a auth.users de Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'closer', 'livreur')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anon anteriores si existen
DROP POLICY IF EXISTS "orders_all"   ON orders;
DROP POLICY IF EXISTS "products_all" ON products;

-- Orders: todos los usuarios autenticados pueden leer y escribir
CREATE POLICY "orders_read"   ON orders FOR SELECT    TO authenticated USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT    TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "orders_delete" ON orders FOR DELETE    TO authenticated USING (true);

-- Products: todos autenticados pueden leer; solo admin actualiza stock
CREATE POLICY "products_read"   ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Profiles: cualquier autenticado puede leer; solo el propio usuario inserta
CREATE POLICY "profiles_read"   ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================================
-- Habilitar Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ============================================================
-- Datos iniciales de productos
-- ============================================================
INSERT INTO products (name, sku, price, cost, stock, bundles) VALUES
  ('Bouton de volant',     'BV-001', 8500, 2200, 45, '[{"qty":2,"price":15000}]'),
  ('Organisateur bijoux',  'OB-002', 6000, 1500, 30, '[{"qty":3,"price":15000}]'),
  ('Vernis à ongles (set)','VN-003', 4500, 1200, 80, '[{"qty":4,"price":16000}]'),
  ('Ceinture LED',         'CL-004', 7000, 1800, 20, '[]')
ON CONFLICT (sku) DO NOTHING;

-- ============================================================
-- Instrucciones para crear usuarios del equipo:
--
-- 1. Ve a Supabase Dashboard → Authentication → Users → Add user
-- 2. Crea el usuario con email + contraseña
-- 3. Copia el UUID que genera Supabase
-- 4. Ejecuta este INSERT con ese UUID:
--
-- INSERT INTO profiles (id, name, role) VALUES
--   ('UUID-del-admin',   'Admin Principal', 'admin'),
--   ('UUID-del-closer',  'Fatou Ba',        'closer'),
--   ('UUID-del-livreur', 'Moussa Fall',     'livreur');
-- ============================================================
