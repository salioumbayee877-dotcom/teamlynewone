-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Parrainage / Afiliación
-- Ejecutar en: Supabase → SQL Editor → New query
-- Requiere la función auth_org_id() ya creada en supabase-rls.sql
-- ═══════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- referral_codes — un código por organización (el parrain)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_codes_code_idx ON referral_codes (code);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Ver / crear: solo el código de tu propia org.
-- El lookup por `code` al registrar un filleul lo hacen las Netlify
-- Functions con SERVICE_KEY (bypasa RLS).
CREATE POLICY "referral_codes_select" ON referral_codes
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "referral_codes_insert" ON referral_codes
  FOR INSERT WITH CHECK (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- referrals — una fila por filleul atribuido
-- status: 'pending' → 'converted' → 'paid'
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL,
  referrer_org_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referred_org_id   uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  referred_email    text,
  referred_name     text,
  status            text NOT NULL DEFAULT 'pending',
  plan              text,
  commission_cfa    integer NOT NULL DEFAULT 0,
  first_payment_cfa integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  converted_at      timestamptz,
  paid_at           timestamptz,
  paid_note         text
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_org_id);
CREATE INDEX IF NOT EXISTS referrals_referred_idx ON referrals (referred_org_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx   ON referrals (status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- El parrain ve sus propias atribuciones (saldo y estado).
-- Insert/update los hacen las Netlify Functions con SERVICE_KEY:
--   · recordReferral (bootstrap-org / google-onboard) → INSERT pending
--   · wave-success → UPDATE a 'converted' al primer pago
--   · super-admin  → UPDATE a 'paid' (gestión del propriétaire)
CREATE POLICY "referrals_select" ON referrals
  FOR SELECT USING (referrer_org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- NOTA: Las Netlify Functions usan SUPABASE_SERVICE_KEY → bypasan RLS.
-- Defaults económicos del programa (en el código, no en BD):
--   REFERRAL_COMMISSION_PCT = 30 % del primer pago para el parrain
--   REFERRAL_DISCOUNT_PCT   = 30 % de descuento al filleul (1er pago)
-- ════════════════════════════════════════════════════════════════
