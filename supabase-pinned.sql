-- ─────────────────────────────────────────────────────────────────────────
-- Épinglage global des commandes (admin/closer)
-- Auto-pin pour interurbain quand le livreur passe en "en_route"
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS orders_pinned_idx ON orders (org_id, pinned) WHERE pinned = true;
