// POST /.netlify/functions/intech-callback
// Webhook appelé par Intech à la fin d'une transaction.
// Doc Intech :
//   • Ressource POST, doit renvoyer HTTP 200 (sinon retry après 1 min).
//   • Authenticité vérifiée via sha256Hash =
//       SHA256(`${transactionId}|${externalTransactionId}|${appKey}`)
// AUCUNE confiance n'est accordée au payload tant que le hash n'est pas validé.
const { verifyCallback } = require("./lib/intech");
const { activateSubscription } = require("./lib/activatePlan");

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

// Statuts terminaux : une fois atteints, on n'écrase pas (idempotence).
const TERMINAL = new Set(["SUCCESS", "FAILLED", "REFUNDED", "CANCELED"]);

exports.handler = async (event) => {
  // Pas de CORS : ce n'est pas appelé par un navigateur mais par Intech.
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // ── 1. Vérification de signature (rejet si invalide) ──────────────────
  if (!verifyCallback(payload)) {
    console.warn("intech-callback: sha256Hash invalide", payload?.transaction?.externalTransactionId);
    // On NE traite PAS un callback non authentifié. 401 → ne pas faire confiance.
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid signature" }) };
  }

  const tx     = payload.transaction || {};
  const extId  = tx.externalTransactionId;
  const status = payload.status || tx.status; // SUCCESS | FAILLED | PENDING | ...
  if (!extId) return { statusCode: 400, headers, body: JSON.stringify({ error: "externalTransactionId manquant" }) };

  try {
    // ── 2. Récupère notre ligne (et son état actuel) ────────────────────
    const cur = await fetch(
      `${SB_URL}/rest/v1/intech_transactions?external_transaction_id=eq.${encodeURIComponent(extId)}&select=id,org_id,status,order_id,amount,purpose,plan,promo_code,ref_code`,
      { headers: sbHeaders }
    ).then(r => r.json()).catch(() => []);
    const row = Array.isArray(cur) ? cur[0] : null;

    // Inconnu chez nous : on accuse réception 200 (évite les retries infinis)
    // mais on log pour investigation.
    if (!row) {
      console.warn("intech-callback: transaction inconnue", extId);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // ── 3. Idempotence : si déjà terminal, on ne ré-applique pas ────────
    if (TERMINAL.has(row.status)) {
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, alreadyFinal: true }) };
    }

    // ── 4. Mise à jour du statut + audit du payload ─────────────────────
    await fetch(`${SB_URL}/rest/v1/intech_transactions?external_transaction_id=eq.${encodeURIComponent(extId)}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        intech_transaction_id: tx.transactionId || null,
        error_code: tx?.errorType?.code || null,
        error_message: tx?.errorType?.message || null,
        callback_payload: payload,
        updated_at: new Date().toISOString(),
      }),
    });

    // ── 5. Effet métier sur SUCCESS ─────────────────────────────────────
    if (status === "SUCCESS") {
      if (row.purpose === "subscription") {
        // Paiement d'abonnement → activer le plan (+ promo + parrainage).
        try {
          await activateSubscription({
            orgId: row.org_id,
            plan: row.plan,
            promoCode: row.promo_code,
            refCode: row.ref_code,
            paidAmount: row.amount,
          });
        } catch (e) {
          console.error("intech-callback: activation plan échouée", e.message);
          // 500 → Intech réessaiera : on ne perd pas l'activation.
          return { statusCode: 500, headers, body: JSON.stringify({ error: "activation failed" }) };
        }
      } else if (row.order_id) {
        // Paiement lié à une commande (COD) → marquer encaissée.
        await fetch(`${SB_URL}/rest/v1/orders?id=eq.${row.order_id}`, {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ amount_collected: row.amount, updated_at: new Date().toISOString() }),
        }).catch(e => console.error("intech-callback: maj order échouée", e.message));
      }
    }

    // 200 obligatoire pour stopper les retries Intech.
    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (e) {
    console.error("intech-callback error:", e.message);
    // 500 → Intech réessaiera dans 1 min (comportement voulu en cas de panne DB).
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
