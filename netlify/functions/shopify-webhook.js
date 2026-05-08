const { matchDeliveryZone } = require('./lib/matchDeliveryZone');
const { deriveSyncStatus }  = require('./lib/syncStatus');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL = process.env.SUPABASE_URL;

const norm = s => (s||"").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();

const matchScore = (catalogName, shopifyStr) => {
  const words = norm(catalogName).split(" ").filter(w => w.length > 2);
  if (!words.length) return 0;
  const target = norm(shopifyStr);
  return words.filter(w => target.includes(w)).length / words.length;
};

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

const ALLOWED = ["https://www.teamlyecom.com","https://teamlyecom.com","https://teamly.life","https://www.teamly.life","https://teamlyofficiell.netlify.app","https://admirable-gingersnap-0038d8.netlify.app"];

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const order = JSON.parse(event.body || "{}");
    const orgId = event.queryStringParameters?.org;
    if (!orgId) return { statusCode: 400, headers, body: "Missing ?org= parameter" };

    // ── Customer info ─────────────────────────────────────────────────────
    const firstName  = order.billing_address?.first_name || order.customer?.first_name || "";
    const lastName   = order.billing_address?.last_name  || order.customer?.last_name  || "";
    const clientName = `${firstName} ${lastName}`.trim() || order.email || "Client Shopify";
    const rawPhone   = order.billing_address?.phone || order.shipping_address?.phone || order.phone || "";
    const digits     = rawPhone.replace(/\D/g,"").replace(/^00/,"");
    const phone      = digits.startsWith("221") ? digits : digits.startsWith("0") ? "221" + digits.slice(1) : digits.length >= 8 ? "221" + digits.slice(-9) : digits;

    // ── Address & city ────────────────────────────────────────────────────
    const addr    = order.shipping_address || order.billing_address;
    const city    = addr?.city || "";
    const addressParts = addr ? [addr.address1, addr.address2, addr.city, addr.province].filter(Boolean) : [];
    const address = addressParts.join(", ") || "";

    // ── Products ──────────────────────────────────────────────────────────
    const lineItems      = order.line_items || [];
    const shopifyProduct = lineItems.map(i=>`${i.title||i.name} x${i.quantity||1}`).join(" + ") || "Produit Shopify";
    const totalQty       = lineItems.reduce((s,i)=>s+(parseInt(i.quantity)||1),0);
    const unitPrice      = lineItems.length > 0 ? parseFloat(lineItems[0].price || 0) : parseFloat(order.total_price || 0);
    const price          = parseFloat(order.total_price || 0);
    const shopifyRef     = `#${order.order_number || order.id}`;

    // ── Plan limit check ──────────────────────────────────────────────────
    const LIMITS = {starter:100, trial:100, pro:200, scale:999999};
    try {
      const orgRes  = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=plan&limit=1`, { headers: sbHeaders });
      const orgData = await orgRes.json();
      const plan    = orgData?.[0]?.plan || "starter";
      const limit   = LIMITS[plan] ?? 100;
      const month   = new Date().toISOString().slice(0,7);
      const cntRes  = await fetch(`${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&created_at=gte.${month}-01&select=id`, { headers: sbHeaders });
      const cnt     = (await cntRes.json())?.length || 0;
      if (cnt >= limit)
        return { statusCode: 429, headers, body: JSON.stringify({ error: `Limite ${limit} commandes/mois atteinte (plan ${plan})` }) };
    } catch(e) { console.error("Limit check error:", e.message); }

    // ── Duplicate check ───────────────────────────────────────────────────
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&note=like.Commande%20Shopify%20${encodeURIComponent(shopifyRef)}*&select=id`,
      { headers: sbHeaders }
    );
    const existing = await checkRes.json();
    if (existing && existing.length > 0)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref: shopifyRef, skipped: true }) };

    // ── Delivery zone matching ────────────────────────────────────────────
    let fraisAmount = 0, matchType = "fallback", matchedZone = null;
    let syncMeta = { sync_status: "unmatched_zone", frais_liv: null, unmatched_city: city || null, unmatched_region: addr?.province || null };
    try {
      const [mainRes, othRes, setRes] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/delivery_main_region?org_id=eq.${orgId}&select=id,name,price,cities,aliases&limit=1`, { headers: sbHeaders }),
        fetch(`${SB_URL}/rest/v1/delivery_other_regions?org_id=eq.${orgId}&select=id,name,price,interurbain_price,cities,aliases`, { headers: sbHeaders }),
        fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=settings&limit=1`, { headers: sbHeaders }),
      ]);
      const main     = (await mainRes.json())[0] || null;
      const others   = (await othRes.json()) || [];
      const settings = (await setRes.json())?.[0]?.settings || {};
      const result   = matchDeliveryZone(city, main, others);
      fraisAmount    = result.fee;
      matchType      = result.matchType;
      matchedZone    = result.zone;
      syncMeta       = deriveSyncStatus(result, main, others, city, addr?.province, settings);
    } catch(e) { console.error("Zone matching error:", e.message); }

    const fraisBlocked = matchType === "fallback";

    // ── Product catalog matching ──────────────────────────────────────────
    let finalProduct = shopifyProduct, matched = false, autoCreated = false;
    try {
      const catalog = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${orgId}&archived=eq.false&select=id,name,price`, { headers: sbHeaders })).json();
      if (Array.isArray(catalog) && catalog.length > 0) {
        let best = 0, bestName = null;
        for (const p of catalog) { const s = matchScore(p.name, shopifyProduct); if (s > best) { best = s; bestName = p.name; } }
        if (best >= 0.5) { finalProduct = bestName; matched = true; }
      }
      if (!matched) {
        const cleanName = (lineItems[0]?.title || shopifyProduct).split(" - ")[0].trim();
        const existProd = Array.isArray(catalog) ? catalog.find(p => norm(p.name) === norm(cleanName)) : null;
        if (!existProd) {
          await fetch(`${SB_URL}/rest/v1/products`, { method:"POST", headers:{...sbHeaders,Prefer:"return=minimal"}, body:JSON.stringify({org_id:orgId,name:cleanName,price:unitPrice,cost:0,stock:0,stock_initial:0,frais_liv:1500,archived:false}) });
          autoCreated = true; finalProduct = cleanName;
        } else { finalProduct = existProd.name; matched = true; }
      }
    } catch(e) { console.error("Catalog error:", e.message); }

    const prodFlag = matched ? " ✓" : autoCreated ? " ★" : "";
    const zoneFlag = fraisBlocked ? ` ⚠️🏙️${city}` : matchType === "fuzzy" ? ` ~🏙️${city}` : ` 🏙️${city}`;
    const note     = `Commande Shopify ${shopifyRef}${prodFlag}${zoneFlag}`;

    // ── Insert order ──────────────────────────────────────────────────────
    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        org_id: orgId, client: clientName, phone, address,
        product: finalProduct, price,
        status: "boutique",
        note, archived: false,
        is_bundle: totalQty > 1 || lineItems.length > 1,
        frais_liv: syncMeta.frais_liv,
        livreur: null, livreur_id: null, closer: null, closer_id: null,
        sync_status: syncMeta.sync_status,
        unmatched_city:   syncMeta.unmatched_city,
        unmatched_region: syncMeta.unmatched_region,
        platform: "shopify",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", err);
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    const zoneName = matchedZone?.name || "";
    console.log(`[TEAMLY] Shopify ${shopifyRef} — city="${city}" matchType=${matchType} zone="${zoneName}" frais=${fraisAmount} CFA`);
    if (fraisBlocked) console.log(`  WARN: city "${city}" not found in zones — admin review needed`);

    return { statusCode: 200, headers, body: JSON.stringify({
      success: true, ref: shopifyRef, matched, autoCreated, finalProduct,
      zone: { matchType, name: zoneName, frais: fraisAmount, blocked: fraisBlocked },
    })};
  } catch (e) {
    console.error("Webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
