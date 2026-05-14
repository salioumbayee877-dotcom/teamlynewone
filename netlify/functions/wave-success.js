const { requireUser, getProfile } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;
const WAVE_API_KEY = process.env.WAVE_API_KEY;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin(origin),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  // Authentication required
  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const { orgId, sessionId, plan = "pro" } = body;
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: "orgId requis" }) };

    // Verify the user belongs to this org and is admin
    const profile = await getProfile(user.id, SERVICE_KEY);
    if (!profile || profile.org_id !== orgId) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Accès refusé — cette organisation n'est pas la vôtre" }) };
    }
    if (profile.role !== "admin") {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Réservé à l'admin de l'organisation" }) };
    }

    // Verify payment with Wave API if sessionId provided (best-effort)
    if (WAVE_API_KEY && sessionId) {
      const check = await fetch(`https://api.wave.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${WAVE_API_KEY}` },
      });
      if (!check.ok) {
        return { statusCode: 402, headers, body: JSON.stringify({ error: "Vérification paiement échouée" }) };
      }
      const session = await check.json();
      if (session.payment_status !== "succeeded") {
        return { statusCode: 402, headers, body: JSON.stringify({ error: "Paiement non confirmé" }) };
      }
    }

    const validPlan = ["pro","scale"].includes(plan) ? plan : "pro";
    const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ plan: validPlan, plan_expires_at: expiresAt }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase error: " + err }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, plan: validPlan, expiresAt }) };
  } catch (e) {
    console.error("wave-success error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
