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
    const { orgId, sessionId, plan = "pro", promoCode, refCode, amount } = body;
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: "orgId requis" }) };

    // Verify the user belongs to this org and is admin
    const profile = await getProfile(user.id, SERVICE_KEY);
    if (!profile || profile.org_id !== orgId) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Accès refusé — cette organisation n'est pas la vôtre" }) };
    }
    if (profile.role !== "admin") {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Réservé à l'admin de l'organisation" }) };
    }

    const validPlan = ["basic","pro","scale"].includes(plan) ? plan : "pro";

    // ── SEC-4: payment verification is MANDATORY (no skip path) ───────────
    if (!WAVE_API_KEY) {
      console.error("wave-success: WAVE_API_KEY non configurée — activation refusée");
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Vérification paiement indisponible" }) };
    }
    if (!sessionId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Référence de paiement manquante" }) };
    }

    const check = await fetch(`https://api.wave.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "Authorization": `Bearer ${WAVE_API_KEY}` },
    });
    if (!check.ok) {
      return { statusCode: 402, headers, body: JSON.stringify({ error: "Vérification paiement échouée" }) };
    }
    const session = await check.json();

    // 1) Must be a succeeded payment.
    if (session.payment_status !== "succeeded") {
      return { statusCode: 402, headers, body: JSON.stringify({ error: "Paiement non confirmé" }) };
    }
    // 2) The session must belong to THIS org (wave-checkout sets client_reference = orgId).
    if (session.client_reference !== orgId) {
      console.warn("wave-success: client_reference mismatch", { sessionId, expected: orgId, got: session.client_reference });
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Ce paiement n'appartient pas à votre organisation" }) };
    }
    // 3) Amount paid must cover the server-side plan price (minus any legitimate discount).
    const PLAN_BASE_PRICE = { basic: 13000, pro: 20000, scale: 36000 };
    const basePrice = PLAN_BASE_PRICE[validPlan] || 0;
    let discountPct = 0;
    // Referral: filleul gets up to 30% off the first payment.
    if (refCode || amount != null) {
      try {
        const ref = await fetch(`${SB_URL}/rest/v1/referrals?referred_org_id=eq.${orgId}&status=in.(pending,converted)&select=id&limit=1`, { headers: sbHeaders });
        const refRows = await ref.json().catch(() => []);
        if (Array.isArray(refRows) && refRows[0]) discountPct = Math.max(discountPct, 30);
      } catch (e) { /* ignore — no discount credited */ }
    }
    // Promo code: use its configured discount_percentage if it exists.
    if (promoCode) {
      try {
        const code = String(promoCode).toUpperCase().trim();
        const pr = await fetch(`${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&select=discount_percentage&limit=1`, { headers: sbHeaders });
        const rows = await pr.json().catch(() => []);
        const pct = Array.isArray(rows) && rows[0] ? Number(rows[0].discount_percentage) || 0 : 0;
        if (pct > 0) discountPct = Math.max(discountPct, Math.min(pct, 100));
      } catch (e) { /* ignore — treat as no promo */ }
    }
    const minAmount = Math.round(basePrice * (1 - discountPct / 100));
    const paidAmount = Number(session.amount);
    if (!(paidAmount >= minAmount - 1)) { // -1 tolerates rounding
      console.warn("wave-success: amount too low", { sessionId, paidAmount, minAmount, validPlan, discountPct });
      return { statusCode: 402, headers, body: JSON.stringify({ error: "Montant payé insuffisant pour ce plan" }) };
    }
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

    // Incrementar uses_count del código promo aplicado (best-effort)
    if (promoCode) {
      try {
        const code = String(promoCode).toUpperCase().trim();
        const lookup = await fetch(`${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&select=id,uses_count&limit=1`, { headers: sbHeaders });
        const rows = await lookup.json();
        if (Array.isArray(rows) && rows[0]) {
          const row = rows[0];
          await fetch(`${SB_URL}/rest/v1/promo_codes?id=eq.${row.id}`, {
            method: "PATCH",
            headers: { ...sbHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({ uses_count: (row.uses_count || 0) + 1 }),
          });
        }
      } catch (e) { /* no bloquear pago si falla */ }
    }

    // Parrainage: acreditar comisión al parrain en la PRIMERA conversión del filleul.
    // % del primer pago (una sola vez). Best-effort — no bloquear el pago si falla.
    try {
      const REFERRAL_COMMISSION_PCT = 30;
      const PLAN_BASE_PRICE = { basic: 13000, pro: 20000, scale: 36000 };
      const ref = await fetch(
        `${SB_URL}/rest/v1/referrals?referred_org_id=eq.${orgId}&status=eq.pending&select=id&limit=1`,
        { headers: sbHeaders }
      );
      const refRows = await ref.json().catch(() => []);
      const paid = Number(amount) > 0 ? Number(amount) : (PLAN_BASE_PRICE[validPlan] || 0);
      const commission = Math.round(paid * REFERRAL_COMMISSION_PCT / 100);
      const convertedAt = new Date().toISOString();

      if (Array.isArray(refRows) && refRows[0]) {
        // Atribución ya creada al registrarse (vino por el enlace ?ref=)
        await fetch(`${SB_URL}/rest/v1/referrals?id=eq.${refRows[0].id}`, {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ status: "converted", plan: validPlan, first_payment_cfa: paid, commission_cfa: commission, converted_at: convertedAt }),
        });
      } else if (refCode) {
        // El filleul escribió el código a mano (no pasó por el enlace): resolver
        // el código → parrain y crear la atribución ya convertida, si procede.
        const code = String(refCode).toUpperCase().trim();
        const rc = await fetch(`${SB_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}&select=org_id&limit=1`, { headers: sbHeaders });
        const rcRows = await rc.json().catch(() => []);
        const referrerOrgId = Array.isArray(rcRows) && rcRows[0] ? rcRows[0].org_id : null;
        // verificar que el filleul no tenga ya una atribución (cualquier estado)
        const any = await fetch(`${SB_URL}/rest/v1/referrals?referred_org_id=eq.${orgId}&select=id&limit=1`, { headers: sbHeaders });
        const anyRows = await any.json().catch(() => []);
        if (referrerOrgId && referrerOrgId !== orgId && !(Array.isArray(anyRows) && anyRows[0])) {
          await fetch(`${SB_URL}/rest/v1/referrals`, {
            method: "POST",
            headers: { ...sbHeaders, Prefer: "return=minimal,resolution=ignore-duplicates" },
            body: JSON.stringify({ code, referrer_org_id: referrerOrgId, referred_org_id: orgId, status: "converted", plan: validPlan, first_payment_cfa: paid, commission_cfa: commission, converted_at: convertedAt }),
          });
        }
      }
    } catch (e) { /* no bloquear pago si falla parrainage */ }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, plan: validPlan, expiresAt }) };
  } catch (e) {
    console.error("wave-success error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
