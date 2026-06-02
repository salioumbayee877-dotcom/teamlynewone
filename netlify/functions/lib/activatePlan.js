// Activation d'abonnement après paiement confirmé.
// Logique portée de wave-success.js (plan + promo uses_count + parrainage)
// pour être réutilisée par le callback Intech.
const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

// Prix de référence côté serveur (source de vérité — jamais le client).
const PLAN_PRICES = { basic: 13000, pro: 20000, scale: 36000 };
const VALID_PLANS = new Set(["basic", "pro", "scale"]);
const REFERRAL_COMMISSION_PCT = 30;

function planPrice(plan) {
  return PLAN_PRICES[plan] || 0;
}

// Active le plan d'une org + gère promo et parrainage (best-effort).
// `paidAmount` = montant réellement payé (pour la commission de parrainage).
async function activateSubscription({ orgId, plan, promoCode, refCode, paidAmount }) {
  const validPlan = VALID_PLANS.has(plan) ? plan : "pro";
  const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Activer le plan
  const res = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ plan: validPlan, plan_expires_at: expiresAt }),
  });
  if (!res.ok) throw new Error("Activation plan échouée: " + (await res.text()));

  // 2) Incrémenter uses_count du code promo (best-effort)
  if (promoCode) {
    try {
      const code = String(promoCode).toUpperCase().trim();
      const lookup = await fetch(`${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&select=id,uses_count&limit=1`, { headers: sbHeaders });
      const rows = await lookup.json();
      if (Array.isArray(rows) && rows[0]) {
        await fetch(`${SB_URL}/rest/v1/promo_codes?id=eq.${rows[0].id}`, {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ uses_count: (rows[0].uses_count || 0) + 1 }),
        });
      }
    } catch (e) { /* ne pas bloquer */ }
  }

  // 3) Parrainage : créditer la commission au parrain sur la 1re conversion (best-effort)
  try {
    const paid = Number(paidAmount) > 0 ? Number(paidAmount) : planPrice(validPlan);
    const commission = Math.round(paid * REFERRAL_COMMISSION_PCT / 100);
    const convertedAt = new Date().toISOString();

    const ref = await fetch(
      `${SB_URL}/rest/v1/referrals?referred_org_id=eq.${orgId}&status=eq.pending&select=id&limit=1`,
      { headers: sbHeaders }
    );
    const refRows = await ref.json().catch(() => []);

    if (Array.isArray(refRows) && refRows[0]) {
      await fetch(`${SB_URL}/rest/v1/referrals?id=eq.${refRows[0].id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "converted", plan: validPlan, first_payment_cfa: paid, commission_cfa: commission, converted_at: convertedAt }),
      });
    } else if (refCode) {
      const code = String(refCode).toUpperCase().trim();
      const rc = await fetch(`${SB_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}&select=org_id&limit=1`, { headers: sbHeaders });
      const rcRows = await rc.json().catch(() => []);
      const referrerOrgId = Array.isArray(rcRows) && rcRows[0] ? rcRows[0].org_id : null;
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
  } catch (e) { /* ne pas bloquer le paiement si le parrainage échoue */ }

  return { plan: validPlan, expiresAt };
}

module.exports = { activateSubscription, planPrice, PLAN_PRICES, VALID_PLANS };
