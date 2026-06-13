// ═══════════════════════════════════════════════════════════════
// TEAMLY — signup-invite
// Inscription d'un membre (closer/livreur) via un lien d'invitation,
// SANS code email. Le lien d'invitation (single-use, expirant) EST la
// preuve d'autorisation par l'Admin : on crée donc directement le compte
// Auth avec email auto-confirmé (service key), puis le profil avec le
// rôle/org figés par l'invite. Le client se connecte ensuite par mot de
// passe pour obtenir une session.
//
// POST /.netlify/functions/signup-invite
//   Body: { token, email, password, nom?, phone?, adresse? }
//   Response: { ok: true, orgId, role, nom }
// ═══════════════════════════════════════════════════════════════
const { isOriginAllowed, corsOrigin } = require("./lib/cors");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

// Mêmes limites que join-org / check-member-limit (sièges par plan).
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

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Body JSON invalide" }) }; }

  const token    = (body.token || "").trim();
  const email    = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!token)                   return { statusCode: 400, headers, body: JSON.stringify({ error: "Lien d'invitation manquant" }) };
  if (!email || !password)      return { statusCode: 400, headers, body: JSON.stringify({ error: "Email et mot de passe requis" }) };
  if (password.length < 6)      return { statusCode: 400, headers, body: JSON.stringify({ error: "Mot de passe trop court (6 min)" }) };

  try {
    // ── 1. Look up the invite (service key — bypasses RLS) ──────────────
    const invRes = await fetch(
      `${SB_URL}/rest/v1/org_invites?token=eq.${encodeURIComponent(token)}&select=id,org_id,role,expires_at,used_at&limit=1`,
      { headers: sbHeaders }
    );
    const invRows = await invRes.json().catch(() => []);
    const invite = Array.isArray(invRows) ? invRows[0] : null;

    if (!invite)        return { statusCode: 404, headers, body: JSON.stringify({ error: "Invitation invalide — demande un nouveau lien à l'Admin" }) };
    if (invite.used_at) return { statusCode: 410, headers, body: JSON.stringify({ error: "Ce lien d'invitation a déjà été utilisé" }) };
    if (new Date(invite.expires_at).getTime() < Date.now())
      return { statusCode: 410, headers, body: JSON.stringify({ error: "Ce lien d'invitation a expiré — demande un nouveau lien" }) };

    const orgId = invite.org_id;
    const role  = invite.role; // figé par l'invite — le client ne choisit jamais

    // ── 2. Enforce the plan's member limit ──────────────────────────────
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

    // ── 3. Claim the invite atomically (single-use guard) ───────────────
    // used_at IS NULL in the filter → a concurrent claim matches 0 rows.
    const claimRes = await fetch(
      `${SB_URL}/rest/v1/org_invites?id=eq.${invite.id}&used_at=is.null`,
      {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      }
    );
    const claimed = await claimRes.json().catch(() => []);
    if (!claimRes.ok || !Array.isArray(claimed) || claimed.length === 0) {
      return { statusCode: 410, headers, body: JSON.stringify({ error: "Ce lien d'invitation a déjà été utilisé" }) };
    }

    const releaseInvite = () =>
      fetch(`${SB_URL}/rest/v1/org_invites?id=eq.${invite.id}`, {
        method: "PATCH", headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ used_at: null, used_by: null }),
      }).catch(() => {});

    // ── 4. Create the Auth user with email auto-confirmed (no OTP) ──────
    const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const created = await createRes.json().catch(() => ({}));
    const userId  = created?.id;
    if (!createRes.ok || !userId) {
      await releaseInvite();
      const msg = `${created?.msg || created?.message || created?.error_description || ""}`.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exist") || createRes.status === 422 || createRes.status === 409) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: "Cet email a déjà un compte. Connecte-toi avec ton mot de passe." }) };
      }
      console.error("signup-invite create user error:", createRes.status, created);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Création du compte échouée" }) };
    }

    // ── 5. Create the profile (role/org pinned from the invite) ─────────
    const nom     = (body.nom || email.split("@")[0] || "Membre").slice(0, 60);
    const phone   = (body.phone || "").slice(0, 30);
    const adresse = (body.adresse || "").slice(0, 200);

    const profRes = await fetch(`${SB_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify({ id: userId, org_id: orgId, nom, phone, email, adresse, role }),
    });
    if (!profRes.ok) {
      const err = await profRes.text();
      console.error("signup-invite profile insert error:", err);
      // Roll back the Auth user and the invite claim so the link can be retried.
      await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: sbHeaders }).catch(() => {});
      await releaseInvite();
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Création du profil échouée" }) };
    }

    // Record who used the invite (best effort).
    await fetch(`${SB_URL}/rest/v1/org_invites?id=eq.${invite.id}`, {
      method: "PATCH", headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ used_by: userId }),
    }).catch(() => {});

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orgId, role, nom }) };
  } catch (e) {
    console.error("signup-invite error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
