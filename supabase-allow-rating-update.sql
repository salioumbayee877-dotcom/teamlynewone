-- ============================================================
-- Teamly — Permitir al cliente actualizar su propia reseña
-- ============================================================
-- Antes: rated_at != null bloqueaba cualquier re-envío.
-- Ahora: el cliente con su tracking_token puede actualizar su reseña
-- las veces que quiera. El trigger sigue bloqueando al equipo
-- (admin/closer/livreur).

DROP FUNCTION IF EXISTS submit_order_rating(uuid, int, int, int, text);
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
  IF p_rating_product NOT BETWEEN 1 AND 5
     OR p_rating_livreur NOT BETWEEN 1 AND 5
     OR p_rating_closer NOT BETWEEN 1 AND 5 THEN
    RETURN false;
  END IF;
  SELECT * INTO v_row FROM orders WHERE tracking_token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.status <> 'entregado' THEN RETURN false; END IF;
  -- Antes había: IF v_row.rated_at IS NOT NULL THEN RETURN false; END IF;
  -- Eliminado para permitir al cliente modificar su reseña.

  v_avg := ROUND((p_rating_product + p_rating_livreur + p_rating_closer)::numeric / 3);

  PERFORM set_config('app.allow_rating_update', 'on', true);

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
