-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — influencer_applications
-- Ejecutar en: Supabase → SQL Editor → New query
--
-- Captura candidaturas de influencers/creators desde el formulario
-- público en https://teamlyecom.com/influenceurs.
--
-- RLS:
--  - INSERT: cualquiera (anon role) → para que el form público funcione.
--  - SELECT/UPDATE/DELETE: bloqueado en cliente. Solo accesible vía
--    SUPABASE_SERVICE_KEY desde Netlify Functions (panel admin futuro).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS influencer_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Informations personnelles
  nom_complet       TEXT NOT NULL,
  email             TEXT NOT NULL,
  whatsapp          TEXT NOT NULL,

  -- Profil créateur
  instagram         TEXT,
  pays              TEXT,
  niche             TEXT,

  -- Expérience & motivation
  experience_payee  BOOLEAN,
  message           TEXT,

  -- Workflow interno
  status            TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','contacted','accepted','rejected')),
  admin_notes       TEXT,

  -- Anti-spam / metadata
  user_agent        TEXT,
  referrer          TEXT
);

CREATE INDEX IF NOT EXISTS idx_influencer_apps_created_at ON influencer_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_apps_status     ON influencer_applications(status, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE influencer_applications ENABLE ROW LEVEL SECURITY;

-- INSERT abierto: el formulario público usa la anon key.
-- (No exponemos SELECT/UPDATE/DELETE, solo se leen vía SERVICE_KEY.)
DROP POLICY IF EXISTS "influencer_apps_insert_anon" ON influencer_applications;
CREATE POLICY "influencer_apps_insert_anon" ON influencer_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
