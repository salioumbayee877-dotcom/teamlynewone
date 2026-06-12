// ═══════════════════════════════════════════════════════════════
// TEAMLY — delete-member  (SEC-7)
// Removes a team member. The caller's identity is re-derived from their
// access token (never trusted from the body), and we assert the caller is
// an ADMIN of the SAME org as the target before deleting anything.
// ═══════════════════════════════════════════════════════════════
const { getProfile } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;
const SB_ANON     = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

const svcHeaders = {
  "Content-Type":  "application/json",
  "apikey":        SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

// Resolve the authenticated user from a raw access token (header or body).
async function userFromToken(token) {
  if (!token) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? u : null;
  } catch { return null; }
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const cors = {
    "Access-Control-Allow-Origin": corsOrigin(origin),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "Method not allowed" };

  try {
    const { memberId, adminJwt } = JSON.parse(event.body || "{}");
    if (!memberId) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing memberId" }) };

    // 1. Re-derive the caller from their token (header preferred, body fallback).
    const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
    const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const caller = await userFromToken(headerToken || adminJwt);
    if (!caller) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Authentification requise" }) };

    // 2. Assert the CALLER is an admin (their own profile, read with service key).
    const callerProfile = await getProfile(caller.id, SERVICE_KEY);
    if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.org_id) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Réservé à l'admin de l'organisation" }) };
    }
    const orgId = callerProfile.org_id; // authoritative — derived from the caller, not the body

    // 3. A caller cannot delete themselves through this endpoint.
    if (memberId === caller.id) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Impossible de supprimer votre propre compte ici" }) };
    }

    // 4. Confirm the target belongs to the caller's org and is not an admin.
    const memberRes = await fetch(
      `${SB_URL}/rest/v1/profiles?id=eq.${memberId}&org_id=eq.${orgId}&select=id,role`,
      { headers: svcHeaders }
    );
    const members = await memberRes.json();
    if (!Array.isArray(members) || members.length === 0)
      return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Member not found in org" }) };
    if (members[0].role === "admin")
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Cannot remove admin account" }) };

    // 5. Soft-delete: nullify org_id so the member is locked out immediately.
    const patchRes = await fetch(
      `${SB_URL}/rest/v1/profiles?id=eq.${memberId}&org_id=eq.${orgId}`,
      {
        method:  "PATCH",
        headers: { ...svcHeaders, Prefer: "return=minimal" },
        body:    JSON.stringify({ org_id: null }),
      }
    );

    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("delete-member PATCH error:", err);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Suppression échouée" }) };
    }

    // 6. Hard-delete the profile row (best effort — org_id=null already locked them out).
    await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${memberId}`, {
      method: "DELETE",
      headers: svcHeaders,
    }).catch(() => {});

    // 7. Hard-delete the Supabase auth user so they can't log back in.
    await fetch(`${SB_URL}/auth/v1/admin/users/${memberId}`, {
      method:  "DELETE",
      headers: svcHeaders,
    }).catch(() => {});

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };

  } catch (e) {
    console.error("delete-member error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
