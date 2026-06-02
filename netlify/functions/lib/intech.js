// ─────────────────────────────────────────────────────────────────────────
// Intech API V2 — shared helper for Netlify Functions
// Source of truth (ONLY):
//   - https://doc.intech.sn/doc_intech_api.php
//   - https://doc.intech.sn/Intech%20API%20V2.postman_collection.json
//
// Facts taken verbatim from those sources:
//   • Base URL ........... https://api.intech.sn        (no separate sandbox host documented)
//   • Auth (POST) ........ apiKey is sent IN THE JSON BODY (not a header)
//   • Auth (GET) ......... "Secretkey: <apiKey>" header
//   • Operation .......... POST /api-services/operation
//   • Status ............. POST /api-services/get-transaction-status  (max 3x/min/transaction)
//   • Balance ............ GET  /api-services/balance
//   • Success ............ response.code === 2000 && error === false
//   • Callback hash ...... SHA256(`${transactionId}|${externalTransactionId}|${appKey}`)
//   • HTTP client timeout. doc requires "minimum 60 secondes"
// ─────────────────────────────────────────────────────────────────────────
const crypto = require("crypto");

const INTECH_BASE_URL = process.env.INTECH_BASE_URL || "https://api.intech.sn";
const INTECH_API_KEY  = process.env.INTECH_API_KEY;

// CASHIN service codes ACTIVE on this account (vérifiés via GET /api-services/services).
// (Wizall/KPAY CASHIN ne sont PAS activés sur ce compte → exclus.)
// Pour la Côte d'Ivoire, ajoutez: ORANGE_CI_API_CASH_IN, MTN_CI_API_CASH_IN, MOOV_CI_API_CASH_IN.
const CASHIN_SERVICES = new Set([
  "ORANGE_SN_API_CASH_IN",
  "WAVE_SN_API_CASH_IN",
  "FREE_SN_WALLET_CASH_IN",
  "EXPRESSO_SN_WALLET_CASH_IN",
  "BANK_TRANSFER_SN_API_CASH_IN",
]);

// ── POST /api-services/operation ────────────────────────────────────────
// `extra` carries service-specific fields (e.g. { sender } for Wave/Orange,
// or the RIB/customer fields for BANK_TRANSFER). `data` is serialized to a
// JSON string per the doc page ("doit être une chaîne JSON sérialisée").
async function doOperation({ phone, amount, codeService, externalTransactionId, callbackUrl, data = {}, extra = {} }) {
  if (!INTECH_API_KEY) throw new Error("INTECH_API_KEY non configurée");

  const body = {
    phone,
    amount,
    codeService,
    externalTransactionId,
    callbackUrl,
    apiKey: INTECH_API_KEY,
    data: typeof data === "string" ? data : JSON.stringify(data),
    ...extra,
  };

  // Intech asks for a client timeout >= 60s. Initiation normally returns fast
  // with status PENDING; the final result arrives on the callback.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${INTECH_BASE_URL}/api-services/operation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    return json; // { code, msg, error, data: { transactionId, status, deepLinkUrl?, authLinkUrl?, ... } }
  } finally {
    clearTimeout(t);
  }
}

// ── POST /api-services/get-transaction-status ───────────────────────────
// Caller MUST NOT poll more than 3x/min for the same transaction (doc warning:
// IP blacklist). Prefer reading the status your callback already persisted.
async function getTransactionStatus(externalTransactionId) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${INTECH_BASE_URL}/api-services/get-transaction-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Secretkey": INTECH_API_KEY },
      body: JSON.stringify({ externalTransactionId }),
      signal: ctrl.signal,
    });
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(t);
  }
}

// ── Callback authenticity check ─────────────────────────────────────────
// Doc formula: SHA256(`${transactionId}|${externalTransactionId}|${appKey}`)
// `appKey` is the same apiKey used to create the transaction (INTECH_API_KEY).
function computeCallbackHash(transactionId, externalTransactionId, appKey = INTECH_API_KEY) {
  return crypto
    .createHash("sha256")
    .update(`${transactionId}|${externalTransactionId}|${appKey}`)
    .digest("hex");
}

function verifyCallback(payload) {
  const tx = payload?.transaction || {};
  const expected = computeCallbackHash(tx.transactionId, tx.externalTransactionId);
  const received = String(payload?.sha256Hash || "");
  if (received.length !== expected.length) return false;
  // timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

module.exports = {
  INTECH_BASE_URL,
  CASHIN_SERVICES,
  doOperation,
  getTransactionStatus,
  computeCallbackHash,
  verifyCallback,
};
