// POST /.netlify/functions/intech-cashin
// Initie un encaissement (CASHIN) via Intech. Authentifié : l'appelant doit
// être connecté ; l'org_id est dérivé de son profil (jamais du client).
const crypto = require("crypto");
const { isOriginAllowed, corsOrigin } = require("./lib/cors");
const { requireUser, getProfile } = require("./_auth");
const { doOperation, CASHIN_SERVICES } = require("./lib/intech");

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// URL publique du site (Netlify expose process.env.URL en prod).
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

  // ── Auth : utilisateur connecté + org dérivée du profil ───────────────
  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Non authentifié" }) };
  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile?.org_id) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profil sans organisation" }) };
  const orgId = profile.org_id;

  try {
    const { phone, amount, codeService, orderId = null, sender } = JSON.parse(event.body || "{}");

    // ── Validation d'entrée ─────────────────────────────────────────────
    if (!phone)                          return { statusCode: 400, headers, body: JSON.stringify({ error: "phone requis" }) };
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return { statusCode: 400, headers, body: JSON.stringify({ error: "amount invalide" }) };
    if (!CASHIN_SERVICES.has(codeService)) return { statusCode: 400, headers, body: JSON.stringify({ error: "codeService CASHIN invalide" }) };

    // Identifiant unique côté nous (sert à matcher le callback). Doit être unique.
    const externalTransactionId = `TLY-${orgId.slice(0, 8)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // L'URL de callback DOIT être publique et renvoyer 200 (doc Intech).
    const callbackUrl = `${SITE_URL}/.netlify/functions/intech-callback`;

    // ── Enregistre la transaction en PENDING AVANT d'appeler Intech ──────
    // (idempotence + audit : on a une trace même si le réseau coupe après.)
    await fetch(`${SB_URL}/rest/v1/intech_transactions`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        org_id: orgId,
        external_transaction_id: externalTransactionId,
        code_service: codeService,
        type_service: "CASHIN",
        amount: amt,
        phone,
        order_id: orderId,
        status: "PENDING",
      }),
    });

    // ── Appel Intech ────────────────────────────────────────────────────
    // `sender` est un champ optionnel documenté pour Wave/Orange CASH_IN.
    const extra = sender ? { sender } : {};
    const result = await doOperation({
      phone, amount: amt, codeService, externalTransactionId, callbackUrl, data: {}, extra,
    });

    const ok    = result?.code === 2000 && result?.error === false;
    const txData = result?.data || {};

    // Met à jour notre ligne avec la réponse d'initiation.
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
      return { statusCode: 400, headers, body: JSON.stringify({
        ok: false, msg: result?.msg || "Échec de l'opération", code: result?.code, externalTransactionId,
      }) };
    }

    // On renvoie au frontend ce dont il a besoin pour finir le paiement :
    //  - deepLinkUrl (Wave) ou authLinkUrl (3DS) si présents
    //  - l'externalTransactionId pour suivre le statut
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      msg: result?.msg,
      externalTransactionId,
      transactionId: txData.transactionId,
      status: txData.status,
      deepLinkUrl: txData.deepLinkUrl || null,
      authLinkUrl: txData.authLinkUrl || null,
      notificationMessage: txData.notificationMessage || null,
    }) };
  } catch (e) {
    console.error("intech-cashin error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
