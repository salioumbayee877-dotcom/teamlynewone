-- ============================================================
-- Teamly — Caisse / Rendición de efectivo (COD)
-- ============================================================
-- Chaque livreur encaisse du cash à la livraison (orders.amount_collected,
-- delivered_by, status='entregado'). Cette table enregistre les REMISES :
-- quand un livreur rend l'argent à l'admin. Le solde "à rendre" d'un livreur =
-- total encaissé − total des remises.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS cash_handovers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  livreur_id   uuid NOT NULL,           -- profiles.id du livreur qui rend l'argent
  amount       numeric NOT NULL DEFAULT 0,
  note         text,
  recorded_by  uuid,                    -- profiles.id de l'admin/closer qui a saisi
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_handovers_org     ON cash_handovers(org_id);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_livreur ON cash_handovers(livreur_id);

ALTER TABLE cash_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ch_select" ON cash_handovers;
CREATE POLICY "ch_select" ON cash_handovers FOR SELECT USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "ch_insert" ON cash_handovers;
CREATE POLICY "ch_insert" ON cash_handovers FOR INSERT WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "ch_update" ON cash_handovers;
CREATE POLICY "ch_update" ON cash_handovers FOR UPDATE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "ch_delete" ON cash_handovers;
CREATE POLICY "ch_delete" ON cash_handovers FOR DELETE USING (org_id = auth_org_id());

NOTIFY pgrst, 'reload schema';
