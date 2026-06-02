// GET /.netlify/functions/intech-status?externalTransactionId=...
// Renvoie le statut d'une transaction DEPUIS NOTRE BASE (mise à jour par le
// callback). On NE sonde PAS l'API Intech ici : la doc avertit qu'appeler
// get-transaction-status plus de 3x/min pour la même transaction peut faire
// blacklister l'IP. La réconciliation via l'API Intech doit se faire côté
// serveur (cron), pas à chaque rafraîchissement du frontend.
const { isOriginAllowed, corsOrigin } = require("./lib/cors");
const { requireUser, getProfile } = require("./_auth");

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin(origin),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  if (origin && !isOriginAllowed(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Non authentifié" }) };
  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile?.org_id) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profil sans organisation" }) };

  const extId = event.queryStringParameters?.externalTransactionId;
  if (!extId) return { statusCode: 400, headers, body: JSON.stringify({ error: "externalTransactionId requis" }) };

  try {
    // Filtrage par org_id : un utilisateur ne voit que les transactions de sa propre org.
    const rows = await fetch(
      `${SB_URL}/rest/v1/intech_transactions?external_transaction_id=eq.${encodeURIComponent(extId)}&org_id=eq.${profile.org_id}&select=external_transaction_id,status,amount,code_service,error_message,updated_at`,
      { headers: sbHeaders }
    ).then(r => r.json()).catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { statusCode: 404, headers, body: JSON.stringify({ error: "Transaction introuvable" }) };

    return { statusCode: 200, headers, body: JSON.stringify(row) };
  } catch (e) {
    console.error("intech-status error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
