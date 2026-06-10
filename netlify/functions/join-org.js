// ═══════════════════════════════════════════════════════════════
// TEAMLY — join-org  (SEC-2)
// A freshly-signed-up user joins a team using a stored invite token.
// The org_id and role come from the validated invite row — NEVER from
// the client. The invite is single-use and expiring.
//
// POST /.netlify/functions/join-org
//   Headers: Authorization: Bearer <new_user_jwt>
//   Body: { token, nom?, phone?, adresse? }
//   Response: { ok: true, orgId, role, nom }
// ═══════════════════════════════════════════════════════════════
const { requireUser } = require("./_auth");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

// Same limits as check-member-limit.js (member seats per plan).
const MEMBER_LIMITS = { gratuit: 2, starter: 3, basic: 3, pro: 5, scale: 999, business: null };

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

  const token = (body.token || "").trim();
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: "Lien d'invitation manquant" }) };

  try {
    // ── 1. Look up the invite (service key — bypasses RLS) ──────────────
    const invRes = await fetch(
      `${SB_URL}/rest/v1/org_invites?token=eq.${encodeURIComponent(token)}&select=id,org_id,role,expires_at,used_at&limit=1`,
      { headers: sbHeaders }
    );
    const invRows = await invRes.json().catch(() => []);
    const invite = Array.isArray(invRows) ? invRows[0] : null;

    if (!invite)            return { statusCode: 404, headers, body: JSON.stringify({ error: "Invitation invalide — demande un nouveau lien à l'Admin" }) };
    if (invite.used_at)     return { statusCode: 410, headers, body: JSON.stringify({ error: "Ce lien d'invitation a déjà été utilisé" }) };
    if (new Date(invite.expires_at).getTime() < Date.now())
      return { statusCode: 410, headers, body: JSON.stringify({ error: "Ce lien d'invitation a expiré — demande un nouveau lien" }) };

    const orgId = invite.org_id;
    const role  = invite.role; // pinned by the invite — client cannot choose

    // ── 2. If this user already has a profile, refuse (no re-assignment) ─
    const existingRes = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${user.id}&select=org_id&limit=1`, { headers: sbHeaders });
    const existingRows = await existingRes.json().catch(() => []);
    if (Array.isArray(existingRows) && existingRows[0]?.org_id) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: "Ce compte appartient déjà à une équipe" }) };
    }

    // ── 3. Enforce the plan's member limit ──────────────────────────────
    const [orgRes, membersRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=plan&limit=1`, { headers: sbHeaders }),
      fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&select=id`,            { headers: sbHeaders }),
    ]);
    const plan  = (await orgRes.json())?.[0]?.plan || "starter";
    const count = (await membersRes.json())?.length || 0;
    const max   = MEMBER_LIMITS[plan] ?? 3;
    if (max !== null && count >= max) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: `Cette équipe a atteint sa limite (${max} membres).` }) };
    }

    // ── 4. Atomically claim the invite (single-use guard) ───────────────
    // used_at IS NULL in the filter → if a concurrent request already
    // claimed it, this PATCH matches 0 rows and we bail out.
    const claimRes = await fetch(
      `${SB_URL}/rest/v1/org_invites?id=eq.${invite.id}&used_at=is.null`,
      {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ used_at: new Date().toISOString(), used_by: user.id }),
      }
    );
    const claimed = await claimRes.json().catch(() => []);
    if (!claimRes.ok || !Array.isArray(claimed) || claimed.length === 0) {
      return { statusCode: 410, headers, body: JSON.stringify({ error: "Ce lien d'invitation a déjà été utilisé" }) };
    }

    // ── 5. Create the profile with role/org pinned from the invite ──────
    const nom     = (body.nom || user.user_metadata?.full_name || user.email?.split("@")[0] || "Membre").slice(0, 60);
    const phone   = (body.phone || "").slice(0, 30);
    const adresse = (body.adresse || "").slice(0, 200);

    const profRes = await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({ id: user.id, org_id: orgId, nom, phone, email: user.email || "", adresse, role }),
    });
    if (!profRes.ok) {
      const err = await profRes.text();
      console.error("join-org profile insert error:", err);
      // Roll back the invite claim so the link can be retried.
      await fetch(`${SB_URL}/rest/v1/org_invites?id=eq.${invite.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ used_at: null, used_by: null }),
      }).catch(() => {});
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Création du profil échouée" }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orgId, role, nom }) };
  } catch (e) {
    console.error("join-org error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
