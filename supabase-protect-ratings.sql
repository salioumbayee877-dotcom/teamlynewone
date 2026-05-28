-- ============================================================
-- Teamly — Protección de columnas de reseña
-- ============================================================
-- Solo el RPC submit_order_rating puede modificar rating_*, review, rated_at.
-- Cualquier UPDATE directo desde admin/closer/livreur queda revertido.
--
-- Mecanismo: el RPC setea una variable de sesión local
-- `app.allow_rating_update = on` antes del UPDATE. El trigger comprueba
-- esa variable; si no está, revierte los valores nuevos a los antiguos.


