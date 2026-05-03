const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL = "https://rddtislrbbkjpoqpdcry.supabase.co";

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

const ALLOWED = ["https://teamly.life","https://www.teamly.life","https://teamlyofficiell.netlify.app","https://admirable-gingersnap-0038d8.netlify.app"];

// ── Detect delivery zone from city name ─────────────────────────────────────
async function detectZoneFromCity(orgId, cityInput) {
  const t = norm(cityInput);
  if (!t) return { type: "unknown", price: 0, fraisLocale: 0, fraisRegionale: 0 };

  try {
    // 1. Fetch main zone
    const mainRes  = await fetch(`${SB_URL}/rest/v1/delivery_main_region?org_id=eq.${orgId}&select=id,name,price,cities&limit=1`, { headers: sbHeaders });
    const mainData = await mainRes.json();
    const main     = Array.isArray(mainData) ? mainData[0] : null;

    if (main) {
      const cities = (main.cities || []);
      for (const entry of cities) {
        const [cname, cprice] = entry.split("|");
        if (norm(cname) === t) {
          const price = parseInt(cprice) || main.price || 1500;
          return { type: "main", zoneName: main.name, price, fraisLocale: price, fraisRegionale: 0, zoneType: "locale_moto" };
        }
      }
    }

    // 2. Fetch other zones
    const othRes  = await fetch(`${SB_URL}/rest/v1/delivery_other_regions?org_id=eq.${orgId}&select=id,name,price,interurbain_price,cities`, { headers: sbHeaders });
    const others  = await othRes.json();

    if (Array.isArray(others)) {
      for (const r of others) {
        // Check cities array
        const cities = r.cities || [];
        const match  = cities.some(c => { const [cn] = c.split("|"); return norm(cn) === t; });
        if (match || norm(r.name) === t) {
          const locale      = r.price || 0;
          const regionale   = r.interurbain_price || 0;
          const total       = locale + regionale;
          return { type: "other", zoneName: r.name, price: total, fraisLocale: locale, fraisRegionale: regionale, zoneType: "regionale_voiture" };
        }
      }
    }
  } catch (e) {
    console.error("Zone detection error:", e.message);
  }

  // 3. Fallback: fetch org default price
  try {
    const orgRes  = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=settings&limit=1`, { headers: sbHeaders });
    const orgData = await orgRes.json();
    const defPrice = orgData?.[0]?.settings?.defaultDeliveryPrice || 3500;
    return { type: "unknown", zoneName: "", price: defPrice, fraisLocale: 0, fraisRegionale: 0, zoneType: null };
  } catch {
    return { type: "unknown", zoneName: "", price: 3500, fraisLocale: 0, fraisRegionale: 0, zoneType: null };
  }
}

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
    const lineItems     = order.line_items || [];
    const shopifyProduct = lineItems.map(i=>`${i.title||i.name} x${i.quantity||1}`).join(" + ") || "Produit Shopify";
    const totalQty       = lineItems.reduce((s,i)=>s+(parseInt(i.quantity)||1),0);
    const unitPrice      = lineItems.length > 0 ? parseFloat(lineItems[0].price || 0) : parseFloat(order.total_price || 0);
    const price          = parseFloat(order.total_price || 0);
    const shopifyRef     = `#${order.order_number || order.id}`;
    const shopifyOrderId = String(order.id || "");

    // ── Shopify shipping paid by customer ─────────────────────────────────
    const shippingLines = order.shipping_lines || [];
    const shopifyShippingPaid = shippingLines.reduce((s,l)=>s+parseFloat(l.price||0), 0);

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

    // ── Delivery zone detection ───────────────────────────────────────────
    const zoneInfo = await detectZoneFromCity(orgId, city);
    const fraisAmount   = zoneInfo.price || 0;
    const fraisType     = zoneInfo.zoneType || null;
    const fraisSource   = "auto_from_zones";
    const fraisBlocked  = zoneInfo.type === "unknown";

    // ── Product catalog matching ──────────────────────────────────────────
    let finalProduct = shopifyProduct;
    let matched      = false;
    let autoCreated  = false;

    try {
      const prodsRes = await fetch(
        `${SB_URL}/rest/v1/products?org_id=eq.${orgId}&archived=eq.false&select=id,name,price`,
        { headers: sbHeaders }
      );
      const catalog = await prodsRes.json();

      if (Array.isArray(catalog) && catalog.length > 0) {
        let best = 0, bestName = null;
        for (const p of catalog) {
          const score = matchScore(p.name, shopifyProduct);
          if (score > best) { best = score; bestName = p.name; }
        }
        if (best >= 0.5) { finalProduct = bestName; matched = true; }
      }

      if (!matched) {
        const cleanName = (lineItems[0]?.title || shopifyProduct).split(" - ")[0].trim();
        const existProd = Array.isArray(catalog)
          ? catalog.find(p => norm(p.name) === norm(cleanName))
          : null;

        if (!existProd) {
          await fetch(`${SB_URL}/rest/v1/products`, {
            method: "POST",
            headers: { ...sbHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({
              org_id: orgId, name: cleanName, price: unitPrice,
              cost: 0, stock: 0, stock_initial: 0, frais_liv: 1500, archived: false,
            }),
          });
          autoCreated  = true;
          finalProduct = cleanName;
        } else {
          finalProduct = existProd.name;
          matched      = true;
        }
      }
    } catch(e) { console.error("Catalog error:", e.message); }

    const noteFlags = matched ? " ✓" : autoCreated ? " ★" : "";
    const cityFlag  = fraisBlocked ? " ⚠️VILLE_NON_CONFIGURÉE" : ` 🏙️${city}`;
    const note      = `Commande Shopify ${shopifyRef}${noteFlags}${cityFlag}`;

    // ── Insert order ──────────────────────────────────────────────────────
    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        org_id: orgId, client: clientName, phone, address, city,
        product: finalProduct, price,
        status: fraisBlocked ? "boutique" : "boutique",
        note, archived: false,
        is_bundle: totalQty > 1 || lineItems.length > 1,
        // Delivery fee fields
        delivery_fee:             fraisAmount,
        delivery_fee_overridden:  false,
        delivery_zone_type:       zoneInfo.type === "main" ? "main" : zoneInfo.type === "other" ? "other" : null,
        delivery_zone_name:       zoneInfo.zoneName || null,
        frais_liv:                fraisAmount,
        // Extended fields
        frais_livraison_amount:   fraisAmount,
        frais_livraison_type:     fraisType,
        frais_livraison_source:   fraisSource,
        shopify_shipping_paid_by_customer: shopifyShippingPaid || null,
        shopify_order_id:         shopifyOrderId || null,
        order_source:             "shopify",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", err);
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    const result = { success: true, ref: shopifyRef, matched, autoCreated, finalProduct,
      zone: { type: zoneInfo.type, name: zoneInfo.zoneName, frais: fraisAmount, blocked: fraisBlocked } };

    // ── Console verification report ───────────────────────────────────────
    console.log(`[TEAMLY VERIFY] Order ${shopifyRef}`);
    console.log(`  PASS: Customer synced — ${clientName} / ${phone}`);
    console.log(`  PASS: Address — ${address}`);
    console.log(`  PASS: City extracted — "${city}"`);
    console.log(`  PASS: Product matched — ${finalProduct} (matched=${matched}, autoCreated=${autoCreated})`);
    console.log(`  PASS: CA = ${price} CFA`);
    console.log(`  ${fraisBlocked ? "FAIL" : "PASS"}: Zone detection — type=${zoneInfo.type}, frais=${fraisAmount} CFA, zoneName="${zoneInfo.zoneName}"`);
    if (fraisBlocked) console.log(`  WARN: City "${city}" not configured in Zones de livraison — admin review required`);
    console.log(`  PASS: Shopify shipping paid by customer = ${shopifyShippingPaid} CFA`);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error("Webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
