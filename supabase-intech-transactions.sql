-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Table des transactions Intech (CASHIN d'abord)
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intech_transactions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL,
  -- notre identifiant unique envoyé à Intech (sert à matcher le callback)
  external_transaction_id  text NOT NULL UNIQUE,
  -- identifiant retourné par Intech
  intech_transaction_id    text,
  code_service             text NOT NULL,          -- ex: WAVE_SN_API_CASH_IN
  type_service             text,                   -- CASHIN | CASHOUT | ...
  amount                   numeric NOT NULL,
  phone                    text,
  -- PENDING | PROCESSING | SUCCESS | FAILLED | REFUNDED | CANCELED
  status                   text NOT NULL DEFAULT 'PENDING',
  order_id                 uuid,                   -- lien optionnel vers orders
  error_code               text,
  error_message            text,
  init_response            jsonb,                  -- réponse brute de /operation
  callback_payload         jsonb,                  -- dernier callback reçu (audit)
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Index alignés sur les accès (org + recherche par identifiants)
CREATE INDEX IF NOT EXISTS idx_intech_tx_org        ON intech_transactions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intech_tx_ext        ON intech_transactions(external_transaction_id);
CREATE INDEX IF NOT EXISTS idx_intech_tx_order      ON intech_transactions(order_id);

-- RLS : même modèle que le reste de l'app (org_id = auth_org_id()).
-- Les écritures côté serveur (Netlify Functions) utilisent la SERVICE_KEY
-- qui bypasse RLS — ces policies protègent seulement l'accès client (anon).
ALTER TABLE intech_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intech_tx_select ON intech_transactions;
CREATE POLICY intech_tx_select ON intech_transactions
  FOR SELECT USING (org_id = auth_org_id());

-- Pas de policy INSERT/UPDATE pour le client : seules les Netlify Functions
-- (service key) créent/mettent à jour ces lignes. Ajoutez-en une seulement
-- si le frontend doit écrire directement (déconseillé pour des paiements).

NOTIFY pgrst, 'reload schema';
