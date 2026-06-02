-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Colonnes pour le paiement d'ABONNEMENT via Intech
-- (la table intech_transactions doit déjà exister)
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE intech_transactions
  ADD COLUMN IF NOT EXISTS purpose    text NOT NULL DEFAULT 'order',  -- 'order' | 'subscription'
  ADD COLUMN IF NOT EXISTS plan       text,                          -- basic | pro | scale (si subscription)
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS ref_code   text;

NOTIFY pgrst, 'reload schema';
