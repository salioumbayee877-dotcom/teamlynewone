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
    const { device_fingerprint } = JSON.parse(event.body || "{}");
    if (!device_fingerprint) return { statusCode: 400, headers, body: JSON.stringify({ error: "device_fingerprint requis" }) };

    const r = await fetch(`${SB_URL}/rest/v1/user_sessions?user_id=eq.${user.id}&device_fingerprint=eq.${encodeURIComponent(device_fingerprint)}&select=id,is_active`, { headers: sbHeaders });
    if (!r.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur lecture session" }) };
    const rows = await r.json();
    const row = Array.isArray(rows) && rows[0];

    if (!row || !row.is_active) {
      return { statusCode: 200, headers, body: JSON.stringify({ kicked: true }) };
    }

    // Refresh last_active_at — fire-and-forget
    fetch(`${SB_URL}/rest/v1/user_sessions?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ last_active_at: new Date().toISOString() }),
    }).catch(()=>{});

    return { statusCode: 200, headers, body: JSON.stringify({ kicked: false }) };
  } catch (e) {
    console.error("session-heartbeat error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
