-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Índices de rendimiento para la tabla `orders`
-- Objetivo: evitar full table scans cuando crecen los pedidos.
-- Ejecutar en: Supabase → SQL Editor → New query
--
-- Seguro de re-ejecutar: todo usa IF NOT EXISTS (idempotente).
-- No borra nada, no modifica datos, solo añade índices.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Feed principal (la consulta más caliente, corre cada 5 s) ──
--   App.jsx: orders?org_id=eq.X&archived=not.is.true&order=created_at.desc
--   Sirve también cualquier consulta que filtre solo por org_id
--   (prefijo izquierdo del índice).
CREATE INDEX IF NOT EXISTS idx_orders_org_created
  ON orders (org_id, created_at DESC)
  WHERE archived IS NOT TRUE;

-- ── 2. Pedidos entregados / Compta ──
--   App.jsx: orders?org_id=eq.X&status=eq.entregado&order=delivered_at.desc
--   Cubre filtro por estado + orden por fecha de entrega.
CREATE INDEX IF NOT EXISTS idx_orders_org_status_delivered
  ON orders (org_id, status, delivered_at DESC);

-- ── 3. Búsqueda de cliente por teléfono ──
--   App.jsx: orders?phone=eq.X&order=created_at.desc&limit=1
--   También acelera la pestaña "Mes Clients".
CREATE INDEX IF NOT EXISTS idx_orders_org_phone
  ON orders (org_id, phone);

-- ── 4. Pedidos por livreur (opcional, barato) ──
--   Para "los pedidos de este livreur". Bajo impacto hoy, pero
--   evita scans cuando la asignación de livreurs crece.
CREATE INDEX IF NOT EXISTS idx_orders_livreur
  ON orders (org_id, livreur_id);

-- ── Refrescar el cache de esquema de PostgREST ──
NOTIFY pgrst, 'reload schema';

-- ───────────────────────────────────────────────────────────────
-- NOTA para cuando la tabla sea GRANDE (>100k filas):
-- CREATE INDEX bloquea escrituras mientras construye el índice.
-- Con la base ya muy cargada, usa la variante CONCURRENTLY, que
-- NO bloquea (pero debe ejecutarse FUERA de transacción, una a una):
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_created
--     ON orders (org_id, created_at DESC) WHERE archived IS NOT TRUE;
--
-- Hoy, con pocos datos, la versión normal de arriba es instantánea.
-- ───────────────────────────────────────────────────────────────
