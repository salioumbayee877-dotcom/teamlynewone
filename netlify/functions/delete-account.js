// ═══════════════════════════════════════════════════════════════
// TEAMLY — delete-account  (self-service)
// Lets a user delete THEIR OWN account. The caller's identity is
// re-derived from their access token (never trusted from the body).
//
// Why a function: removing the Supabase Auth user (so they can't log
// back in) requires the service key — impossible from the browser.
// Deleting the auth user cascades the profiles row (ON DELETE CASCADE).
//
//  • admin   → wipe the whole org (data + team auth users + org row)
//  • closer  → detach from orders (closer_id → null), then delete self
//  • livreur → detach from orders (livreur_id → null), then delete self
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

// Resolve the authenticated user from a raw access token.
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

// REST delete by filter (service key — bypasses RLS). Best-effort.
const restDelete = (path) =>
  fetch(`${SB_URL}/rest/v1/${path}`, { method: "DELETE", headers: { ...svcHeaders, Prefer: "return=minimal" } })
    .catch(() => {});

// REST patch by filter (service key). Best-effort.
const restPatch = (path, body) =>
  fetch(`${SB_URL}/rest/v1/${path}`, { method: "PATCH", headers: { ...svcHeaders, Prefer: "return=minimal" }, body: JSON.stringify(body) })
    .catch(() => {});

// Delete a Supabase Auth user → cascades their profiles row. Best-effort.
const deleteAuthUser = (id) =>
  fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svcHeaders })
    .catch(() => {});

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
    // 1. Re-derive the caller from their token (never trust the body).
    const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
    const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const caller = await userFromToken(headerToken);
    if (!caller) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Authentification requise" }) };

    // 2. Load the caller's profile (service key) — authoritative role + org.
    const profile = await getProfile(caller.id, SERVICE_KEY);
    const role  = profile?.role || null;
    const orgId = profile?.org_id || null;

    if (role === "admin" && orgId) {
      // ── Admin: wipe the entire organization ──────────────────────────
      // Order matters for FK safety: data rows → members (auth+profile) → org row.
      const orgFilter = `org_id=eq.${orgId}`;
      await Promise.allSettled([
        restDelete(`order_items?${orgFilter}`),
        restDelete(`orders?${orgFilter}`),
        restDelete(`products?${orgFilter}`),
        restDelete(`messages?${orgFilter}`),
        restDelete(`notifications?${orgFilter}`),
        restDelete(`stock_movements?${orgFilter}`),
        restDelete(`product_pricing_rules?${orgFilter}`),
        restDelete(`delivery_main_region?${orgFilter}`),
        restDelete(`delivery_other_regions?${orgFilter}`),
      ]);

      // Every team member of this org → delete their auth user (cascades profile).
      try {
        const r = await fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&select=id`, { headers: svcHeaders });
        const members = r.ok ? await r.json() : [];
        if (Array.isArray(members)) {
          await Promise.allSettled(members.filter(m => m?.id).map(m => deleteAuthUser(m.id)));
        }
      } catch (_) { /* fall through */ }

      // Finally, the organization row itself.
      await restDelete(`organizations?id=eq.${orgId}`);

      // Safety net: ensure the admin's own auth user is gone.
      await deleteAuthUser(caller.id);

      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, scope: "org" }) };
    }

    // ── Closer / Livreur (or admin without org): delete only this account ──
    if (orgId) {
      // Detach from any orders so nothing dangles after deletion.
      await Promise.allSettled([
        restPatch(`orders?livreur_id=eq.${caller.id}`, { livreur_id: null }),
        restPatch(`orders?closer_id=eq.${caller.id}`,  { closer_id: null }),
      ]);
    }
    // Delete the auth user (cascades the profiles row). Profile fallback in case
    // there is no FK cascade in this project's schema.
    await deleteAuthUser(caller.id);
    await restDelete(`profiles?id=eq.${caller.id}`);

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, scope: "self" }) };

  } catch (e) {
    console.error("delete-account error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
