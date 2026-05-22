-- ============================================================
-- Teamly — Tracking público de pedidos para clientes finales
-- ============================================================
-- Añade tracking_token a cada pedido + función segura para que
-- el cliente pueda consultar SOLO su pedido (no expone otros).
-- Ejecutar en Supabase Dashboard → SQL Editor → Run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1) Columna tracking_token con UUID por defecto ───────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_token uuid DEFAULT gen_random_uuid();

-- Rellenar tokens en pedidos existentes que no tienen uno
UPDATE orders SET tracking_token = gen_random_uuid() WHERE tracking_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token);

-- ── 2) Función SECURITY DEFINER que devuelve SOLO los campos
--      seguros del pedido que coincide con el token. RLS no se
--      aplica dentro de SECURITY DEFINER, por eso es seguro
--      exponerla a 'anon'.
CREATE OR REPLACE FUNCTION get_order_tracking(p_token uuid)
RETURNS TABLE(
  id            uuid,
  client        text,
  product       text,
  status        text,
  price         numeric,
  address       text,
  livreur       text,
  livreur_phone text,
  created_at    timestamptz,
  delivered_at  timestamptz,
  boutique_name text,
  whatsapp      text
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.client, o.product, o.status, o.price, o.address, o.livreur,
    p.phone AS livreur_phone,
    o.created_at, o.delivered_at,
    org.name AS boutique_name,
    org.whatsapp
  FROM orders o
  LEFT JOIN organizations org ON org.id = o.org_id
  LEFT JOIN profiles p ON p.id = o.livreur_id
  WHERE o.tracking_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_tracking(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
