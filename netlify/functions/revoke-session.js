const { requireUser } = require("./_auth");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

const ALLOWED = ["https://www.teamlyecom.com","https://teamlyecom.com","https://teamly.life","https://www.teamly.life","https://admirable-gingersnap-0038d8.netlify.app","http://localhost:5173"];

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: "Method not allowed" };
  if (origin && !ALLOWED.includes(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };

  try {
    const { session_id, all_others = false, by_fingerprint } = JSON.parse(event.body || "{}");
    const now = new Date().toISOString();

    if (all_others) {
      // Revoke every active session except the one matching by_fingerprint
      if (!by_fingerprint) return { statusCode: 400, headers, body: JSON.stringify({ error: "by_fingerprint requis pour all_others" }) };
      const url = `${SB_URL}/rest/v1/user_sessions?user_id=eq.${user.id}&is_active=eq.true&device_fingerprint=neq.${encodeURIComponent(by_fingerprint)}`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ is_active: false, revoked_at: now, revoked_by_device_fingerprint: by_fingerprint }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error("revoke-session all_others error:", err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur révocation" }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (!session_id) return { statusCode: 400, headers, body: JSON.stringify({ error: "session_id requis" }) };

    const r = await fetch(`${SB_URL}/rest/v1/user_sessions?id=eq.${session_id}&user_id=eq.${user.id}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ is_active: false, revoked_at: now, revoked_by_device_fingerprint: by_fingerprint || null }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("revoke-session error:", err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur révocation" }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("revoke-session error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
