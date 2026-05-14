const { randomUUID } = require("crypto");
const { requireUser } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Prefer": "return=representation,resolution=merge-duplicates",
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin(origin),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: "Method not allowed" };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Body JSON invalide" }) }; }
  const boutique = (body.boutique || "").trim();
  const phone    = (body.phone || "").trim();
  const nom      = (body.nom || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Admin").slice(0,60);
  if (!boutique || !phone) return { statusCode: 400, headers, body: JSON.stringify({ error: "boutique et phone obligatoires" }) };

  // If user already has an org via existing profile, don't overwrite
  try {
    const pr = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${user.id}&select=org_id&limit=1`, { headers: sbHeaders });
    const rows = await pr.json().catch(()=>[]);
    if (Array.isArray(rows) && rows[0]?.org_id) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orgId: rows[0].org_id, alreadyExists: true }) };
    }
  } catch {}

  const orgId = randomUUID();

  try {
    const orgRes = await fetch(`${SB_URL}/rest/v1/organizations`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ id: orgId, name: boutique, whatsapp: phone }),
    });
    if (!orgRes.ok) {
      const t = await orgRes.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: `organizations: ${orgRes.status} ${t.slice(0,200)}` }) };
    }
    const profRes = await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ id: user.id, org_id: orgId, nom, phone, email: user.email || "", role: "admin" }),
    });
    if (!profRes.ok) {
      const t = await profRes.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: `profiles: ${profRes.status} ${t.slice(0,200)}` }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orgId, role: "admin", nom }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e?.message || "unknown" }) };
  }
};
