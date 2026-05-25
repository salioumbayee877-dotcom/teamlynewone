-- ============================================================
-- Teamly — Protección de columnas de reseña
-- ============================================================
-- Solo el RPC submit_order_rating puede modificar rating_*, review, rated_at.
-- Cualquier UPDATE directo desde admin/closer/livreur queda revertido.
--
-- Mecanismo: el RPC setea una variable de sesión local
-- `app.allow_rating_update = on` antes del UPDATE. El trigger comprueba
-- esa variable; si no está, revierte los valores nuevos a los antiguos.

CREATE OR REPLACE FUNCTION protect_order_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el RPC autorizó el update, dejar pasar.
  IF current_setting('app.allow_rating_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Caso contrario (equipo, cliente con anon, llamada directa): revertir.
  NEW.rating_product := OLD.rating_product;
  NEW.rating_livreur := OLD.rating_livreur;
  NEW.rating_closer  := OLD.rating_closer;
  NEW.rating         := OLD.rating;
  NEW.review         := OLD.review;
  NEW.rated_at       := OLD.rated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_ratings ON orders;
CREATE TRIGGER trg_protect_order_ratings
  BEFORE UPDATE OF rating_product, rating_livreur, rating_closer, rating, review, rated_at
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION protect_order_ratings();

-- ── Actualizar submit_order_rating para activar la variable de sesión ──
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
  IF v_row.rated_at IS NOT NULL THEN RETURN false; END IF;

  v_avg := ROUND((p_rating_product + p_rating_livreur + p_rating_closer)::numeric / 3);

  -- Autorizar el UPDATE protegido por trigger SOLO para esta transacción.
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
