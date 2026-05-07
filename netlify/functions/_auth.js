const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

async function requireUser(event) {
  const auth  = event.headers?.authorization || event.headers?.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

async function getProfile(userId, serviceKey) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${userId}&select=org_id,role,email`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

module.exports = { requireUser, getProfile };
