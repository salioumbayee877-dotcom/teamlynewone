-- ============================================================
-- Teamly — Rellenar tracking_token en pedidos antiguos sin token
-- ============================================================
-- Ejecutar UNA VEZ tras desplegar el fix que asegura que cada
-- pedido nuevo tiene tracking_token. Esto rellena los pedidos
-- viejos para que el enlace de tracking aparezca también en
-- los mensajes WhatsApp de confirmación.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE orders
   SET tracking_token = gen_random_uuid()
 WHERE tracking_token IS NULL;

NOTIFY pgrst, 'reload schema';
