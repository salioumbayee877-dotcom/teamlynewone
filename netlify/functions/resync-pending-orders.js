const { requireUser, getProfile } = require("./_auth");
const { matchDeliveryZone }       = require("./lib/matchDeliveryZone");
const { deriveSyncStatus }        = require("./lib/syncStatus");

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

const ALLOWED = ["https://www.teamlyecom.com","https://teamlyecom.com","https://teamly.life","https://www.teamly.life","https://admirable-gingersnap-0038d8.netlify.app","http://localhost:5173"];

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: "Method not allowed" };
  if (origin && !ALLOWED.includes(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentification requise" }) };

  try {
    const profile = await getProfile(user.id, SERVICE_KEY);
    if (!profile?.org_id) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profile introuvable" }) };
    if (profile.role !== "admin") return { statusCode: 403, headers, body: JSON.stringify({ error: "Réservé à l'admin" }) };
    const orgId = profile.org_id;

    // 1. Fetch zones + settings
    const [mainRes, othRes, setRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/delivery_main_region?org_id=eq.${orgId}&select=id,name,price,cities,aliases&limit=1`, { headers: sbHeaders }),
      fetch(`${SB_URL}/rest/v1/delivery_other_regions?org_id=eq.${orgId}&select=id,name,price,interurbain_price,cities,aliases`, { headers: sbHeaders }),
      fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=settings&limit=1`, { headers: sbHeaders }),
    ]);
    const main     = (await mainRes.json())[0] || null;
    const others   = (await othRes.json()) || [];
    const settings = (await setRes.json())?.[0]?.settings || {};

    // 2. Fetch pending orders
    const pendingRes = await fetch(`${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&sync_status=in.(awaiting_zone_config,unmatched_zone)&select=id,unmatched_city,unmatched_region,status`, { headers: sbHeaders });
    const pending    = await pendingRes.json();
    if (!Array.isArray(pending) || pending.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, resynced: 0, total: 0 }) };
    }

    // 3. Re-match each
    let resynced = 0;
    await Promise.all(pending.map(async (o) => {
      const result = matchDeliveryZone(o.unmatched_city || "", main, others);
      const meta   = deriveSyncStatus(result, main, others, o.unmatched_city, o.unmatched_region, settings);
      if (meta.sync_status === "synced") {
        const regionType  = result.zone?._type === "other" ? "other" : result.zone?._type === "main" ? "main" : null;
        const paymentType = regionType === "other" ? "prepaid" : regionType === "main" ? "cod" : null;
        const patch = {
          sync_status: "synced",
          frais_liv:   meta.frais_liv,
          unmatched_city:   null,
          unmatched_region: null,
          region_type:  regionType,
          payment_type: paymentType,
        };
        // Boutique-imported other-region orders should enter the prepaid flow once matched
        if (regionType === "other" && o.status === "boutique") patch.status = "en_attente_paiement";
        await fetch(`${SB_URL}/rest/v1/orders?id=eq.${o.id}`, {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        resynced++;
      }
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, resynced, total: pending.length }) };
  } catch (e) {
    console.error("resync-pending-orders error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur" }) };
  }
};
