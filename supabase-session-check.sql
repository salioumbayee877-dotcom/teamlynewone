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
  uid uuid;
  most_recent_id uuid;
BEGIN
  -- session_id + sub (user id) come from JWT claims
  BEGIN
    sid := (current_setting('request.jwt.claims', true)::json ->> 'session_id')::uuid;
    uid := (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF sid IS NULL OR uid IS NULL THEN
    RETURN false;
  END IF;

  -- Single-session enforcement: only the most recently created session for
  -- this user is valid. Supabase's "Enforce single session per user" toggle
  -- doesn't reliably set not_after on invalidated rows, so we infer freshness
  -- by ordering on created_at.
  SELECT id INTO most_recent_id
  FROM auth.sessions
  WHERE user_id = uid
  ORDER BY created_at DESC
  LIMIT 1;

  IF most_recent_id IS NULL OR sid <> most_recent_id THEN
    RETURN false;
  END IF;

  -- Also respect explicit expiration if Supabase did set it
  RETURN EXISTS (
    SELECT 1 FROM auth.sessions
    WHERE id = sid
      AND (not_after IS NULL OR not_after > now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_my_session_active() TO authenticated;
