// POST /.netlify/functions/intech-plan-checkout
// Initie le paiement d'un ABONNEMENT Teamly via Intech (CASHIN mobile money).
// - Réservé à l'admin de l'org (comme wave-success).
// - Le MONTANT est calculé CÔTÉ SERVEUR à partir du plan (jamais le client).
// - L'activation du plan se fait dans intech-callback APRÈS confirmation Intech.
const crypto = require("crypto");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");
const { requireUser, getProfile } = require("./_auth");
const { doOperation, CASHIN_SERVICES } = require("./lib/intech");
const { planPrice, VALID_PLANS } = require("./lib/activatePlan");

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL    = process.env.URL || process.env.APP_URL || "https://www.teamlyecom.com";

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
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Non authentifié" }) };
  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile?.org_id) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profil sans organisation" }) };
  if (profile.role !== "admin") return { statusCode: 403, headers, body: JSON.stringify({ error: "Réservé à l'admin de l'organisation" }) };
  const orgId = profile.org_id;

  try {
    const { plan, phone, codeService, promoCode = null, refCode = null } = JSON.parse(event.body || "{}");

    // ── Validation ──────────────────────────────────────────────────────
    if (!VALID_PLANS.has(plan))            return { statusCode: 400, headers, body: JSON.stringify({ error: "Plan invalide" }) };
    if (!phone)                            return { statusCode: 400, headers, body: JSON.stringify({ error: "phone requis" }) };
    if (!CASHIN_SERVICES.has(codeService)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Opérateur (codeService) invalide" }) };

    // PRIX CÔTÉ SERVEUR — on n'accepte JAMAIS un montant venant du client.
    const amount = planPrice(plan);
    if (!amount) return { statusCode: 400, headers, body: JSON.stringify({ error: "Tarif introuvable pour ce plan" }) };

    const externalTransactionId = `TLY-SUB-${orgId.slice(0, 8)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const callbackUrl = `${SITE_URL}/.netlify/functions/intech-callback`;

    // Trace PENDING (purpose=subscription) avant l'appel Intech.
    await fetch(`${SB_URL}/rest/v1/intech_transactions`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        org_id: orgId,
        external_transaction_id: externalTransactionId,
        code_service: codeService,
        type_service: "CASHIN",
        purpose: "subscription",
        plan,
        promo_code: promoCode,
        ref_code: refCode,
        amount,
        phone,
        status: "PENDING",
      }),
    });

    const result = await doOperation({
      phone, amount, codeService, externalTransactionId, callbackUrl,
      data: {}, extra: { sender: "Teamly" },
    });

    const ok     = result?.code === 2000 && result?.error === false;
    const txData = result?.data || {};

    await fetch(`${SB_URL}/rest/v1/intech_transactions?external_transaction_id=eq.${encodeURIComponent(externalTransactionId)}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        intech_transaction_id: txData.transactionId || null,
        status: txData.status || (ok ? "PENDING" : "FAILLED"),
        error_code: result?.error ? (txData?.errorType?.code || null) : null,
        error_message: result?.error ? (result?.msg || null) : null,
        init_response: result,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: result?.msg || "Échec de l'opération", externalTransactionId }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      msg: result?.msg,
      externalTransactionId,
      amount,
      plan,
      status: txData.status,
      deepLinkUrl: txData.deepLinkUrl || null,
      authLinkUrl: txData.authLinkUrl || null,
      notificationMessage: txData.notificationMessage || null,
    }) };
  } catch (e) {
    console.error("intech-plan-checkout error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
