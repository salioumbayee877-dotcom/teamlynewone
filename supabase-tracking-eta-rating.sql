-- ============================================================
-- Teamly — ETA + Rating (Calificación post-entrega)
-- ============================================================
-- Añade:
--   • en_camino_at  → timestamp de cuándo el pedido entró en route
--   • rating        → calificación 1-5 estrellas del cliente
--   • review        → comentario opcional del cliente
--   • rated_at      → timestamp de la calificación
-- Y crea RPC submit_order_rating para que el cliente pueda calificar
-- vía la página de tracking (sin login, validado por tracking_token).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS en_camino_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating       int CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS review       text,
  ADD COLUMN IF NOT EXISTS rated_at     timestamptz;

-- ── Actualizar get_order_tracking para incluir los nuevos campos ──
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
  en_camino_at  timestamptz,
  boutique_name text,
  whatsapp      text,
  rating        int,
  review        text,
  rated_at      timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.client, o.product, o.status, o.price, o.address, o.livreur,
    p.phone AS livreur_phone,
    o.created_at, o.delivered_at, o.en_camino_at,
    org.name AS boutique_name,
    org.whatsapp,
    o.rating, o.review, o.rated_at
  FROM orders o
  LEFT JOIN organizations org ON org.id = o.org_id
  LEFT JOIN profiles p ON p.id = o.livreur_id
  WHERE o.tracking_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_order_tracking(uuid) TO anon, authenticated;

-- ── RPC para que el cliente envíe su calificación ──
-- Valida que el token coincida y que el pedido esté entregado.
-- No permite re-calificar si ya hay rating (rated_at set).
CREATE OR REPLACE FUNCTION submit_order_rating(
  p_token  uuid,
  p_rating int,
  p_review text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row orders%ROWTYPE;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN false;
  END IF;
  SELECT * INTO v_row FROM orders WHERE tracking_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_row.status <> 'entregado' THEN
    RETURN false;
  END IF;
  IF v_row.rated_at IS NOT NULL THEN
    RETURN false; -- already rated
  END IF;
  UPDATE orders
    SET rating = p_rating,
        review = LEFT(COALESCE(p_review, ''), 500),
        rated_at = now()
    WHERE id = v_row.id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_order_rating(uuid, int, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
