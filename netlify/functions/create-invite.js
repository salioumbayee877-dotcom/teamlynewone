// ═══════════════════════════════════════════════════════════════
// TEAMLY — create-invite  (SEC-2)
// An admin creates a stored, single-use, expiring invite for their org.
// The token is generated server-side and the role/org are NOT chosen by
// the joining client — they are pinned to this row.
//
// POST /.netlify/functions/create-invite
//   Headers: Authorization: Bearer <admin_jwt>
//   Body: { role: "closer" | "livreur" }
//   Response: { ok: true, token, role, link, expiresAt }
// ═══════════════════════════════════════════════════════════════
const crypto = require("crypto");
const { requireUser, getProfile } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Body JSON invalide" }) }; }

  const role = body.role === "closer" || body.role === "livreur" ? body.role : null;
  if (!role) return { statusCode: 400, headers, body: JSON.stringify({ error: "role doit être 'closer' ou 'livreur'" }) };

  // Caller must be an admin (identity re-derived from the token, not the body).
  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile || !profile.org_id) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profil introuvable" }) };
  if (profile.role !== "admin") return { statusCode: 403, headers, body: JSON.stringify({ error: "Réservé à l'admin de l'organisation" }) };

  const orgId = profile.org_id;

  try {
    // Strong, unguessable token (vs. the old client-side Math.random()).
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const res = await fetch(`${SB_URL}/rest/v1/org_invites`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ org_id: orgId, role, token, created_by: user.id, expires_at: expiresAt }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("create-invite insert error:", err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Création du lien échouée" }) };
    }

    const base = origin || `https://${event.headers?.host || "teamly.life"}`;
    const link = `${base}?invite=${token}`;
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, token, role, link, expiresAt }) };
  } catch (e) {
    console.error("create-invite error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
