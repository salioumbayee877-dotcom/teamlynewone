-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Device session tracking (max 2 active devices per user)
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_sessions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint            TEXT NOT NULL,
  device_name                   TEXT,
  device_type                   TEXT,
  browser                       TEXT,
  os                            TEXT,
  location                      TEXT,
  user_agent                    TEXT,
  ip_address                    TEXT,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  last_active_at                TIMESTAMPTZ DEFAULT now(),
  is_active                     BOOLEAN DEFAULT true,
  revoked_at                    TIMESTAMPTZ NULL,
  revoked_by_device_fingerprint TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions(user_id, is_active) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_device
  ON user_sessions(user_id, device_fingerprint) WHERE is_active = true;

-- ════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sessions_select" ON user_sessions;
CREATE POLICY "user_sessions_select" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

-- Update only to revoke own sessions (service_role bypasses RLS — used by Edge/Netlify Functions)
DROP POLICY IF EXISTS "user_sessions_update" ON user_sessions;
CREATE POLICY "user_sessions_update" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT only via Netlify Functions using SERVICE_KEY (which bypasses RLS).
-- No INSERT policy for authenticated users — they cannot create sessions directly.
