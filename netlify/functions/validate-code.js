// ═══════════════════════════════════════════════════════════════
// TEAMLY — validate-code
// Valide un code saisi manuellement à l'écran de paiement.
// Cherche d'abord dans promo_codes (codes promo du owner), puis dans
// referral_codes (codes d'affiliation). Utilise SERVICE_KEY pour pouvoir
// lire les codes de N'IMPORTE QUELLE org (RLS le bloquerait côté client).
//
// GET ?code=XXX -> { valid, type:'promo'|'referral', code, discount_pct, self? }
// ═══════════════════════════════════════════════════════════════
const { requireUser, getProfile } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;
const REFERRAL_DISCOUNT_PCT = 30; // remise filleul (doit matcher le front)

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };
  const profile = await getProfile(user.id, SERVICE_KEY);
  const callerOrg = profile?.org_id || null;

  try {
    const code = String(event.queryStringParameters?.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
    if (code.length < 3) return { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };

    // 1) Code promo (owner)
    const pr = await fetch(`${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&select=*&limit=1`, { headers: sbHeaders });
    const promoRows = await pr.json().catch(() => []);
    const promo = Array.isArray(promoRows) && promoRows[0] ? promoRows[0] : null;
    if (promo) {
      const now = Date.now();
      const expired = promo.expires_at && new Date(promo.expires_at).getTime() < now;
      const usedUp  = promo.max_uses != null && (promo.uses_count || 0) >= promo.max_uses;
      if (promo.active && !expired && !usedUp) {
        return { statusCode: 200, headers, body: JSON.stringify({ valid: true, type: "promo", code, discount_pct: promo.discount_pct }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };
    }

    // 2) Code d'affiliation (parrainage)
    const rr = await fetch(`${SB_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}&select=org_id&limit=1`, { headers: sbHeaders });
    const refRows = await rr.json().catch(() => []);
    const ref = Array.isArray(refRows) && refRows[0] ? refRows[0] : null;
    if (ref) {
      if (callerOrg && ref.org_id === callerOrg) {
        // Son propre code — pas de remise pour soi-même
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, self: true }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ valid: true, type: "referral", code, discount_pct: REFERRAL_DISCOUNT_PCT }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };
  } catch (e) {
    console.error("validate-code error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ valid: false, error: "Erreur serveur" }) };
  }
};
