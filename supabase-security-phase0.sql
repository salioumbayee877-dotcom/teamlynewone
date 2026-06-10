-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Security remediation (Phase 0)
-- Closes SEC-1 (profile privilege escalation / cross-tenant takeover)
-- and the DB layer of SEC-2 (self-assigned org/role on join).
--
-- Run in: Supabase → SQL Editor → New query.
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ── Helper: caller's CURRENT role (SECURITY DEFINER bypasses RLS) ──
-- STABLE + reads profiles → sees the statement-start snapshot, i.e. the
-- value BEFORE the row being UPDATEd is changed. That is exactly what we
-- pin against in the WITH CHECK below.
CREATE OR REPLACE FUNCTION auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── Helper: does this org already have any member? (bypasses RLS) ──
-- Used to stop a brand-new user from self-inserting into someone else's org.
CREATE OR REPLACE FUNCTION org_has_members(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE org_id = p_org);
$$;

-- ════════════════════════════════════════════════════════════════
-- SEC-1 — profiles UPDATE: pin role + org_id to their existing values
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role   IS NOT DISTINCT FROM auth_role()
    AND org_id IS NOT DISTINCT FROM auth_org_id()
  );

-- ════════════════════════════════════════════════════════════════
-- SEC-2 (DB layer) — profiles INSERT: a user may only create their
-- own profile, and only into an org that has no members yet.
-- All legitimate creation paths (bootstrap-org, google-onboard,
-- join-org) run with the SERVICE_KEY and bypass RLS, so this does not
-- affect them — it only blocks the client self-insert exploit.
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND NOT org_has_members(org_id)
  );

-- ════════════════════════════════════════════════════════════════
-- SEC-2 — single-use, expiring invites (server-validated)
-- Created by create-invite.js, consumed by join-org.js (both service key).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS org_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('closer','livreur')),
  token       text NOT NULL UNIQUE,
  created_by  uuid,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_invites_org_idx ON org_invites (org_id);

ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

-- Members of the org may SEE their org's invites (e.g. to list pending ones).
-- No INSERT/UPDATE/DELETE policy → clients cannot forge or consume invites;
-- only the SERVICE_KEY (server functions) can write.
DROP POLICY IF EXISTS "org_invites_select" ON org_invites;
CREATE POLICY "org_invites_select" ON org_invites
  FOR SELECT USING (org_id = auth_org_id());

-- ════════════════════════════════════════════════════════════════
-- DONE. After running:
--  • A user can no longer change their own role/org_id via the API.
--  • A user can no longer self-insert into another org.
--  • Team members join only through a stored, single-use, expiring invite.
-- ════════════════════════════════════════════════════════════════
