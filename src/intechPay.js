// ─────────────────────────────────────────────────────────────────────────
// Intech CASHIN — helper frontend (React / Vite)
// Le frontend ne voit JAMAIS la clé API : il appelle nos Netlify Functions,
// qui détiennent la clé et parlent à Intech.
//
// En production (Netlify) les chemins /.netlify/functions/* sont servis.
// En local, lancez `netlify dev` (pas seulement `vite`) pour que ces routes
// existent.
// ─────────────────────────────────────────────────────────────────────────

const FN = "/.netlify/functions";

// Statuts terminaux (alignés sur la doc Intech).
export const INTECH_TERMINAL = ["SUCCESS", "FAILLED", "REFUNDED", "CANCELED"];

// codeService CASHIN actifs sur le compte (vérifiés via /api-services/services).
export const CASHIN_CODES = {
  WAVE:     "WAVE_SN_API_CASH_IN",
  ORANGE:   "ORANGE_SN_API_CASH_IN",
  FREE:     "FREE_SN_WALLET_CASH_IN",
  EXPRESSO: "EXPRESSO_SN_WALLET_CASH_IN",
  BANK:     "BANK_TRANSFER_SN_API_CASH_IN",
};

// Lance un encaissement. `token` = le JWT Supabase de l'utilisateur connecté
// (dans App.jsx : la variable `sbToken` / `_authToken`).
export async function startCashin({ token, phone, amount, codeService, orderId = null, sender }) {
  const res = await fetch(`${FN}/intech-cashin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phone, amount, codeService, orderId, sender }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.msg || data.error || "Échec de l'encaissement");
  return data; // { externalTransactionId, deepLinkUrl, authLinkUrl, status, ... }
}

// Lit le statut DEPUIS NOTRE BASE (mise à jour par le callback). Pas de
// sondage de l'API Intech → aucun risque de blacklist d'IP.
export async function fetchStatus({ token, externalTransactionId }) {
  const res = await fetch(
    `${FN}/intech-status?externalTransactionId=${encodeURIComponent(externalTransactionId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Statut indisponible");
  return res.json(); // { status, amount, code_service, error_message, ... }
}

// Sonde notre backend jusqu'à un statut terminal (ou timeout).
// onUpdate(status) est appelé à chaque tick. Renvoie le statut final.
export async function pollUntilFinal({ token, externalTransactionId, onUpdate, intervalMs = 4000, timeoutMs = 180000 }) {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let row;
    try { row = await fetchStatus({ token, externalTransactionId }); } catch { row = null; }
    if (row?.status) { onUpdate?.(row.status, row); if (INTECH_TERMINAL.includes(row.status)) return row.status; }
    if (Date.now() > deadline) return row?.status || "PENDING";
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

/* ───────────────────────── EXEMPLE D'USAGE (React) ─────────────────────────
import { startCashin, pollUntilFinal, CASHIN_CODES } from "./intechPay";

function PayButton({ token, order }) {
  const [state, setState] = React.useState("idle"); // idle|pending|SUCCESS|FAILLED...
  async function pay() {
    try {
      setState("pending");
      const r = await startCashin({
        token,
        phone: order.phone,
        amount: order.price,
        codeService: CASHIN_CODES.WAVE,   // ou ORANGE / FREE selon le choix client
        orderId: order.id,
        sender: "Teamly",                 // optionnel (Wave/Orange)
      });
      // Wave renvoie souvent un deepLinkUrl à ouvrir pour confirmer le paiement :
      if (r.deepLinkUrl) window.open(r.deepLinkUrl, "_blank");
      // Puis on attend le statut final (mis à jour par le callback) :
      const final = await pollUntilFinal({
        token, externalTransactionId: r.externalTransactionId,
        onUpdate: (s) => setState(s),
      });
      setState(final);
    } catch (e) {
      setState("FAILLED");
      // addToast(e.message, "error")  // votre helper existant
    }
  }
  return <button onClick={pay} disabled={state==="pending"}>
    {state==="pending" ? "Paiement en cours…" : state==="SUCCESS" ? "Payé ✓" : "Encaisser"}
  </button>;
}
──────────────────────────────────────────────────────────────────────────── */
