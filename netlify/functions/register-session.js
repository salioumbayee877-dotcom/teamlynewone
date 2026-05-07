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
    const { device_fingerprint, device_info = {} } = JSON.parse(event.body || "{}");
    if (!device_fingerprint || typeof device_fingerprint !== "string" || device_fingerprint.length < 16) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "device_fingerprint requis" }) };
    }

    const ip = event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || event.headers?.["client-ip"] || null;

    // 1. Fetch active sessions for this user
    const sessRes = await fetch(`${SB_URL}/rest/v1/user_sessions?user_id=eq.${user.id}&is_active=eq.true&order=last_active_at.desc&select=*`, { headers: sbHeaders });
    if (!sessRes.ok) {
      const err = await sessRes.text();
      console.error("register-session fetch error:", err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur lecture sessions" }) };
    }
    const sessions = await sessRes.json();
    const existing = Array.isArray(sessions) ? sessions.find(s => s.device_fingerprint === device_fingerprint) : null;

    // 2. If existing session matches → reactivate / refresh
    if (existing) {
      await fetch(`${SB_URL}/rest/v1/user_sessions?id=eq.${existing.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ last_active_at: new Date().toISOString(), is_active: true, ip_address: ip || existing.ip_address }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, session_id: existing.id, sessions }) };
    }

    // 3. New device — check limit
    if (Array.isArray(sessions) && sessions.length >= 2) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, limit_reached: true, existing_sessions: sessions }) };
    }

    // 4. Insert new session
    const payload = {
      user_id: user.id,
      device_fingerprint,
      device_name: device_info.device_name || null,
      device_type: device_info.device_type || null,
      browser:     device_info.browser     || null,
      os:          device_info.os          || null,
      user_agent:  device_info.user_agent  || null,
      ip_address:  ip,
    };
    const ins = await fetch(`${SB_URL}/rest/v1/user_sessions`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!ins.ok) {
      const err = await ins.text();
      console.error("register-session insert error:", err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur création session" }) };
    }
    const inserted = await ins.json();
    const newSession = Array.isArray(inserted) ? inserted[0] : inserted;
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, session_id: newSession?.id, sessions: [...sessions, newSession] }) };
  } catch (e) {
    console.error("register-session error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
