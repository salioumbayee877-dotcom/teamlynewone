-- ============================================================
-- Teamly — Téléphone du transporteur (livraisons interurbaines)
-- ============================================================
-- Quand le livreur remet le colis au transporteur, il saisit son numéro.
-- Le client peut alors appeler le transporteur depuis la page de suivi.
-- Run in Supabase SQL Editor.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS transporter_phone TEXT,
  ADD COLUMN IF NOT EXISTS transported_at    TIMESTAMPTZ;

-- Met à jour la RPC tracking pour exposer transporter_phone au client
DROP FUNCTION IF EXISTS get_order_tracking(uuid);
CREATE FUNCTION get_order_tracking(p_token uuid)
RETURNS TABLE(
  id                uuid,
  client            text,
  product           text,
  product_photo     text,
  status            text,
  price             numeric,
  address           text,
  livreur           text,
  livreur_phone     text,
  closer            text,
  created_at        timestamptz,
  delivered_at      timestamptz,
  en_camino_at      timestamptz,
  transporter_phone text,
  transported_at    timestamptz,
  boutique_name     text,
  whatsapp          text,
  rating            int,
  rating_product    int,
  rating_livreur    int,
  rating_closer     int,
  review            text,
  rated_at          timestamptz,
  reviews_enabled   boolean
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
    o.transporter_phone, o.transported_at,
    org.name AS boutique_name, org.whatsapp,
    o.rating, o.rating_product, o.rating_livreur, o.rating_closer,
    o.review, o.rated_at,
    COALESCE(
      (org.settings->>'reviewsEnabled')::boolean,
      true
    ) AND COALESCE(o.reviews_enabled, true) AS reviews_enabled
  FROM orders o
  LEFT JOIN organizations org ON org.id = o.org_id
  LEFT JOIN profiles p ON p.id = o.livreur_id
  WHERE o.tracking_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_tracking(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
