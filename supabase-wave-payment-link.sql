-- ============================================================
-- Teamly — Lien de paiement Wave dans la RPC de tracking
-- ============================================================
-- L'admin configure son lien Wave personnel (pay.wave.com/m/...) dans
-- organizations.settings.wave_payment_link. La page publique /pay/{token}
-- lit ce lien via get_order_tracking pour rediriger le client.
-- Run in Supabase SQL Editor.

DROP FUNCTION IF EXISTS get_order_tracking(uuid);
CREATE FUNCTION get_order_tracking(p_token uuid)
RETURNS TABLE(
  id                  uuid,
  client              text,
  product             text,
  product_photo       text,
  status              text,
  price               numeric,
  address             text,
  livreur             text,
  livreur_phone       text,
  closer              text,
  created_at          timestamptz,
  delivered_at        timestamptz,
  en_camino_at        timestamptz,
  transporter_phone   text,
  transported_at      timestamptz,
  boutique_name       text,
  whatsapp            text,
  wave_payment_link   text,
  rating              int,
  rating_product      int,
  rating_livreur      int,
  rating_closer       int,
  review              text,
  rated_at            timestamptz,
  reviews_enabled     boolean
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
    (org.settings->>'wave_payment_link')::text AS wave_payment_link,
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
