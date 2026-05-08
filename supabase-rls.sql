-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Row Level Security
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- ── Función helper (SECURITY DEFINER = bypasa RLS internamente) ──
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ════════════════════════════════════════════════════════════════
-- profiles
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ver: propio perfil O perfiles del mismo org
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR org_id = auth_org_id()
  );

-- Crear: solo tu propio perfil (signup)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Editar: solo tu propio perfil
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Eliminar: solo tu propio perfil
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- organizations
-- ════════════════════════════════════════════════════════════════
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Ver: solo tu org
CREATE POLICY "orgs_select" ON organizations
  FOR SELECT USING (id = auth_org_id());

-- Crear: cualquier user autenticado (signup crea org antes que el perfil)
CREATE POLICY "orgs_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Editar: solo tu org
CREATE POLICY "orgs_update" ON organizations
  FOR UPDATE USING (id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- orders
-- ════════════════════════════════════════════════════════════════
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "orders_delete" ON orders
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- products
-- ════════════════════════════════════════════════════════════════
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "products_delete" ON products
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- messages (chat)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- notifications
-- ════════════════════════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- stock_movements
-- ════════════════════════════════════════════════════════════════
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_select" ON stock_movements
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "stock_insert" ON stock_movements
  FOR INSERT WITH CHECK (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- delivery_main_region
-- ════════════════════════════════════════════════════════════════
ALTER TABLE delivery_main_region ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_main_select" ON delivery_main_region
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "delivery_main_insert" ON delivery_main_region
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "delivery_main_update" ON delivery_main_region
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "delivery_main_delete" ON delivery_main_region
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- delivery_other_regions
-- ════════════════════════════════════════════════════════════════
ALTER TABLE delivery_other_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_other_select" ON delivery_other_regions
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "delivery_other_insert" ON delivery_other_regions
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "delivery_other_update" ON delivery_other_regions
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "delivery_other_delete" ON delivery_other_regions
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- product_pricing_rules
-- ════════════════════════════════════════════════════════════════
ALTER TABLE product_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_select" ON product_pricing_rules
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "pricing_insert" ON product_pricing_rules
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "pricing_update" ON product_pricing_rules
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "pricing_delete" ON product_pricing_rules
  FOR DELETE USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- NOTA: Las Netlify Functions usan SUPABASE_SERVICE_KEY
-- → bypasan RLS automáticamente (webhooks Shopify/Woo/YouCan OK)
-- ════════════════════════════════════════════════════════════════
