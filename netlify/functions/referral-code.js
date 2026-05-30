// ═══════════════════════════════════════════════════════════════
// TEAMLY — referral-code
// Lecture / personnalisation du code d'affiliation d'une organisation.
// Utilise SERVICE_KEY (bypasse RLS) pour garantir l'unicité GLOBALE du code
// (sur toutes les orgs) sans exposer les codes des autres, et pour faire un
// upsert fiable (insert si absent, update sinon) sans dépendre des policies.
//
// GET  -> { code }                  (code actuel de l'org, ou "")
// POST { code } -> { ok, code }     (enregistre/personnalise ; 409 si pris)
// ═══════════════════════════════════════════════════════════════
const { requireUser, getProfile } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin(origin),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };

  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile?.org_id) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profil introuvable" }) };
  if (profile.role !== "admin") return { statusCode: 403, headers, body: JSON.stringify({ error: "Réservé à l'admin" }) };
  const orgId = profile.org_id;

  try {
    // GET — code actuel de l'org
    if (event.httpMethod === "GET") {
      const r = await fetch(`${SB_URL}/rest/v1/referral_codes?org_id=eq.${orgId}&select=code&limit=1`, { headers: sbHeaders });
      const rows = await r.json().catch(() => []);
      return { statusCode: 200, headers, body: JSON.stringify({ code: rows?.[0]?.code || "" }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
      if (code.length < 3 || code.length > 20) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "format" }) };
      }

      // Unicité globale: le code est-il déjà pris par une AUTRE org ?
      const taken = await fetch(`${SB_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}&select=org_id&limit=1`, { headers: sbHeaders });
      const takenRows = await taken.json().catch(() => []);
      if (Array.isArray(takenRows) && takenRows[0] && takenRows[0].org_id !== orgId) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: "taken" }) };
      }

      // Upsert: update si l'org a déjà une ligne, insert sinon
      const existing = await fetch(`${SB_URL}/rest/v1/referral_codes?org_id=eq.${orgId}&select=id&limit=1`, { headers: sbHeaders });
      const exRows = await existing.json().catch(() => []);
      let res;
      if (Array.isArray(exRows) && exRows[0]) {
        res = await fetch(`${SB_URL}/rest/v1/referral_codes?org_id=eq.${orgId}`, {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ code }),
        });
      } else {
        res = await fetch(`${SB_URL}/rest/v1/referral_codes`, {
          method: "POST",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ org_id: orgId, code }),
        });
      }
      if (!res.ok) {
        const t = await res.text();
        if (/23505|duplicate/i.test(t)) return { statusCode: 409, headers, body: JSON.stringify({ error: "taken" }) };
        return { statusCode: 500, headers, body: JSON.stringify({ error: "save" }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, code }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (e) {
    console.error("referral-code error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
