// ═══════════════════════════════════════════════════════════════
// TEAMLY — recordReferral
// Atribuye un filleul recién creado a su parrain (programa de parrainage).
// Llamado por bootstrap-org / google-onboard tras crear la org del filleul.
//
// Best-effort: NUNCA lanza — un fallo de parrainage no debe bloquear el
// registro. Usa SERVICE_KEY (bypasa RLS) para leer referral_codes e insertar
// la fila pending en referrals. La unicidad de referred_org_id en BD evita
// duplicados (un filleul se atribuye una sola vez).
// ═══════════════════════════════════════════════════════════════
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

async function recordReferral({ refCode, referredOrgId, referredEmail, referredName }) {
  try {
    const code = String(refCode || "").trim().toUpperCase();
    if (!code || !referredOrgId) return;

    // 1. Resolver el código → org del parrain
    const lookup = await fetch(
      `${SB_URL}/rest/v1/referral_codes?code=eq.${encodeURIComponent(code)}&select=org_id&limit=1`,
      { headers: sbHeaders }
    );
    const rows = await lookup.json().catch(() => []);
    const referrerOrgId = Array.isArray(rows) && rows[0] ? rows[0].org_id : null;
    if (!referrerOrgId) return;                       // código inexistente
    if (referrerOrgId === referredOrgId) return;      // auto-parrainage ignorado

    // 2. Insertar atribución pending (ignore-duplicates por referred_org_id unique)
    await fetch(`${SB_URL}/rest/v1/referrals`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({
        code,
        referrer_org_id: referrerOrgId,
        referred_org_id: referredOrgId,
        referred_email: referredEmail || null,
        referred_name: referredName || null,
        status: "pending",
      }),
    });
  } catch (e) {
    console.error("recordReferral error (ignored):", e?.message);
  }
}

module.exports = { recordReferral };
