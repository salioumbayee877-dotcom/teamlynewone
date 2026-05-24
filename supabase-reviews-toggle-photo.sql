-- ============================================================
-- Teamly — Toggle avis par commande + photo produit
-- ============================================================

-- 1) Permet à l'admin de désactiver les avis par commande
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reviews_enabled boolean DEFAULT true;

-- 2) Permet d'attacher une photo au produit (URL Supabase Storage ou externe)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 3) Mise à jour RPC get_order_tracking : inclure reviews_enabled + product_photo
DROP FUNCTION IF EXISTS get_order_tracking(uuid);
CREATE FUNCTION get_order_tracking(p_token uuid)
RETURNS TABLE(
  id              uuid,
  client          text,
  product         text,
  product_photo   text,
  status          text,
  price           numeric,
  address         text,
  livreur         text,
  livreur_phone   text,
  closer          text,
  created_at      timestamptz,
  delivered_at    timestamptz,
  en_camino_at    timestamptz,
  boutique_name   text,
  whatsapp        text,
  rating          int,
  rating_product  int,
  rating_livreur  int,
  rating_closer   int,
  review          text,
  rated_at        timestamptz,
  reviews_enabled boolean
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.client, o.product,
    (SELECT pr.photo_url FROM products pr
       WHERE pr.org_id = o.org_id AND LOWER(pr.name) = LOWER(o.product)
       LIMIT 1) AS product_photo,
    o.status, o.price, o.address,
    o.livreur, p.phone AS livreur_phone, o.closer,
    o.created_at, o.delivered_at, o.en_camino_at,
    org.name AS boutique_name, org.whatsapp,
    o.rating, o.rating_product, o.rating_livreur, o.rating_closer,
    o.review, o.rated_at,
    COALESCE(o.reviews_enabled, true) AS reviews_enabled
  FROM orders o
  LEFT JOIN organizations org ON org.id = o.org_id
  LEFT JOIN profiles p ON p.id = o.livreur_id
  WHERE o.tracking_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_tracking(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
