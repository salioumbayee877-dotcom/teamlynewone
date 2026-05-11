-- Single-session enforcement helper.
-- Returns true if the current request's JWT corresponds to an active session
-- in auth.sessions. Used by the client to poll session validity, since
-- /auth/v1/user only validates the JWT signature and not session state.

CREATE OR REPLACE FUNCTION public.is_my_session_active()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  -- session_id is included in Supabase Auth JWTs (newer versions)
  BEGIN
    sid := (current_setting('request.jwt.claims', true)::json ->> 'session_id')::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF sid IS NULL THEN
    -- Old JWT without session_id claim — treat as invalid so the user is forced
    -- to re-login and get a fresh JWT with session_id.
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM auth.sessions
    WHERE id = sid
      AND (not_after IS NULL OR not_after > now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_my_session_active() TO authenticated;
