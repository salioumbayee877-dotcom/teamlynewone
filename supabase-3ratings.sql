-- ============================================================
-- Teamly — 3 notes séparées : produit / livreur / closer
-- ============================================================
-- Au lieu d'une note unique, le client note séparément :
--   • rating_product → la qualité du produit
--   • rating_livreur → la qualité de la livraison
--   • rating_closer  → la qualité de l'appel téléphonique (closer)
-- L'ancienne colonne 'rating' reste pour rétrocompatibilité —
-- elle stocke la moyenne des 3 notes du même avis.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rating_product int CHECK (rating_product BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_livreur int CHECK (rating_livreur BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_closer  int CHECK (rating_closer  BETWEEN 1 AND 5);

-- ── Mise à jour RPC get_order_tracking pour exposer les 3 notes ──
DROP FUNCTION IF EXISTS get_order_tracking(uuid);
CREATE FUNCTION get_order_tracking(p_token uuid)
RETURNS TABLE(
  id              uuid,
  client          text,
  product         text,
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
  rated_at        timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.client, o.product, o.status, o.price, o.address,
    o.livreur, p.phone AS livreur_phone, o.closer,
    o.created_at, o.delivered_at, o.en_camino_at,
    org.name AS boutique_name, org.whatsapp,
    o.rating, o.rating_product, o.rating_livreur, o.rating_closer,
    o.review, o.rated_at
  FROM orders o
  LEFT JOIN organizations org ON org.id = o.org_id
  LEFT JOIN profiles p ON p.id = o.livreur_id
  WHERE o.tracking_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_tracking(uuid) TO anon, authenticated;

-- ── Mise à jour RPC submit_order_rating : accepte les 3 notes ──
DROP FUNCTION IF EXISTS submit_order_rating(uuid, int, text);
CREATE OR REPLACE FUNCTION submit_order_rating(
  p_token          uuid,
  p_rating_product int,
  p_rating_livreur int,
  p_rating_closer  int,
  p_review         text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row orders%ROWTYPE;
  v_avg numeric;
BEGIN
  -- Validation : au moins une note doit être valide
  IF p_rating_product NOT BETWEEN 1 AND 5
     OR p_rating_livreur NOT BETWEEN 1 AND 5
     OR p_rating_closer NOT BETWEEN 1 AND 5 THEN
    RETURN false;
  END IF;
  SELECT * INTO v_row FROM orders WHERE tracking_token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.status <> 'entregado' THEN RETURN false; END IF;
  IF v_row.rated_at IS NOT NULL THEN RETURN false; END IF;
  -- Moyenne arrondie au entier le plus proche pour la colonne 'rating' rétro
  v_avg := ROUND((p_rating_product + p_rating_livreur + p_rating_closer)::numeric / 3);
  UPDATE orders
    SET rating_product = p_rating_product,
        rating_livreur = p_rating_livreur,
        rating_closer  = p_rating_closer,
        rating         = v_avg::int,
        review         = LEFT(COALESCE(p_review,''), 500),
        rated_at       = now()
    WHERE id = v_row.id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_order_rating(uuid, int, int, int, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
