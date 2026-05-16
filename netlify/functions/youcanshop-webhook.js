const { matchDeliveryZone } = require('./lib/matchDeliveryZone');
const { deriveSyncStatus }  = require('./lib/syncStatus');
const { extractCityFromAddress } = require('./lib/senegalCities');
const { parsePackQuantity } = require('./lib/parsePack');
const { ensureProduct } = require('./lib/ensureProduct');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL = process.env.SUPABASE_URL;

const norm = s => (s||"").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();

const matchScore = (catalogName, str) => {
  const words = norm(catalogName).split(" ").filter(w => w.length > 2);
  if (!words.length) return 0;
  return words.filter(w => norm(str).includes(w)).length / words.length;
};

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

const fmtPhone = (raw) => {
  const digits = (raw||"").replace(/\D/g,"").replace(/^00/,"");
  if (!digits) return "";
  if (digits.startsWith("221")) return digits;
  if (digits.startsWith("0")) return "221" + digits.slice(1);
  if (digits.length >= 8) return "221" + digits.slice(-9);
  return digits;
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const body  = JSON.parse(event.body || "{}");
    const orgId = event.queryStringParameters?.org;
    if (!orgId) return { statusCode: 400, headers, body: "Missing ?org= parameter" };

    // YouCan Shop sends: { order: {...} } or { payload: { order: {...} } } or the order directly
    const order = body.payload?.order || body.order || body;

    const customer   = order.customer || order.billing || {};
    const clientName = customer.fullname || customer.full_name ||
      `${customer.first_name||""} ${customer.last_name||""}`.trim() ||
      customer.name || customer.email || "Client YouCan Shop";

    const phone = fmtPhone(
      customer.phone || customer.telephone ||
      order.shippingAddress?.phone || order.shipping_address?.phone || ""
    );

    const addrObj = order.shippingAddress || order.shipping_address || order.address || {};
    const address = [
      addrObj.address || addrObj.address_1 || addrObj.street,
      addrObj.city,
      addrObj.province || addrObj.state || addrObj.region,
      addrObj.country_code || addrObj.country
    ].filter(Boolean).join(", ");
    const extracted = extractCityFromAddress(address) || extractCityFromAddress(addrObj.city);
    const city      = extracted?.city || addrObj.city || "";
    const cityIsDakar = extracted?.isDakar === true;
    const provinceForMeta = extracted?.region || addrObj.province || addrObj.state || addrObj.region || null;

    const items      = order.products || order.items || order.line_items || [];
    const rawProduct = items.map(i => {
      const name = i.name || i.title || i.product_name || "Produit";
      const qty  = parseInt(i.quantity || i.qty || 1);
      return `${name} x${qty}`;
    }).join(" + ") || "Produit YouCan Shop";
    const totalQty   = items.reduce((s,i) => s + (parseInt(i.quantity || i.qty || 1)), 0);
    const price = parseFloat(order.total || order.amount || order.subtotal || 0);
    const ref   = `#${order.reference || order.ref || order.id || Date.now()}`;

    // ── Plan limit check ────────────────────────────────────────────────
    const LIMITS = {gratuit:30, starter:30, trial:30, basic:100, pro:2000, scale:999999};
    try {
      const orgRes  = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=plan&limit=1`, { headers: sbHeaders });
      const orgData = await orgRes.json();
      const plan    = orgData?.[0]?.plan || "gratuit";
      const limit   = LIMITS[plan] ?? 30;
      const month   = new Date().toISOString().slice(0,7);
      const cntRes  = await fetch(`${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&created_at=gte.${month}-01&select=id`, { headers: sbHeaders });
      const cnt     = (await cntRes.json())?.length || 0;
      if (cnt >= limit)
        return { statusCode: 429, headers, body: JSON.stringify({ error: `Limite ${limit} commandes/mois atteinte (plan ${plan})` }) };
    } catch(e) { console.error("Limit check error:", e.message); }

    // Duplicate check
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&note=like.Commande%20YouCan%20${encodeURIComponent(ref)}*&select=id`,
      { headers: sbHeaders }
    );
    const existing = await checkRes.json();
    if (existing?.length > 0)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref, skipped: true }) };

    // Product matching por línea
    let catalog = [];
    try {
      catalog = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${orgId}&archived=eq.false&select=id,name,price`, { headers: sbHeaders })).json();
      if (!Array.isArray(catalog)) catalog = [];
    } catch(e) { console.error("Catalog error:", e.message); }
    const matchLine = (text) => {
      let best = 0, bestP = null;
      for (const p of catalog) { const s = matchScore(p.name, text); if (s > best) { best = s; bestP = p; } }
      return best >= 0.5 ? bestP : null;
    };

    const itemsForDb = [];
    let totalDiscount = 0;
    let firstMatchedName = null;
    let anyMatched = false;
    for (const it of items) {
      const rawName   = it.name || it.title || it.product_name || "Produit";
      const variant   = it.variant || it.variant_title || it.option || null;
      const qty       = parseInt(it.quantity || it.qty || 1);
      const unitPrice = parseFloat(it.price || it.unit_price || 0);
      const lineGross = qty * unitPrice;
      const lineDisc  = parseFloat(it.discount || it.discount_amount || 0);
      totalDiscount  += lineDisc;
      const matchTarget = [rawName, variant].filter(Boolean).join(" ");
      let matchedP = matchLine(matchTarget);
      if (!matchedP) {
        matchedP = await ensureProduct({ orgId, rawName, unitPrice, sbHeaders, SB_URL, catalog });
      }
      if (matchedP) {
        anyMatched = true;
        if (!firstMatchedName) firstMatchedName = matchedP.name;
      }
      const { packQuantity } = parsePackQuantity(variant, rawName);
      itemsForDb.push({
        product_id:        matchedP?.id || null,
        product_name:      matchedP?.name || rawName,
        quantity:          qty,
        pack_quantity:     packQuantity,
        unit_price:        unitPrice,
        line_total:        lineGross,
        discount_amount:   lineDisc,
        raw_variant_title: variant,
        raw_product_name:  rawName,
      });
    }
    if (totalDiscount === 0) {
      const orderDisc = parseFloat(order.discount || order.total_discount || 0);
      if (orderDisc > 0 && itemsForDb.length > 0) {
        itemsForDb[0].discount_amount = orderDisc;
        totalDiscount = orderDisc;
      }
    }
    const finalProduct = firstMatchedName;
    const matched      = anyMatched;
    const rawProductName = rawProduct;

    // ── Delivery zone matching ──────────────────────────────────────────
    let fraisAmount = 0, matchType = "fallback", matchedZone = null, matchedCity = null;
    let syncMeta = { sync_status: "unmatched_zone", frais_liv: null, unmatched_city: city || null, unmatched_region: provinceForMeta };
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
      matchedCity    = result.matchedCity || null;
      syncMeta       = deriveSyncStatus(result, main, others, city, provinceForMeta, settings, { isDakar: cityIsDakar });
    } catch(e) { console.error("Zone matching error:", e.message); }
    const regionType  = matchedZone?._type === "other" ? "other" : matchedZone?._type === "main" ? "main" : null;
    const paymentType = regionType === "other" ? "prepaid" : regionType === "main" ? "cod" : null;
    const prodFlag = matched ? " ✓" : ` ❓${rawProductName}`;
    const zoneFlag = matchType === "fallback" ? ` ⚠️🏙️${city}` : matchType === "fuzzy" ? ` ~🏙️${city}` : ` 🏙️${city}`;
    const note     = `Commande YouCan ${ref}${prodFlag}${zoneFlag}`;

    // Auto-asignación de livreur si solo hay uno en la org
    let autoLivreurId = null, autoLivreurNom = null;
    try {
      const livs = await (await fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&role=eq.livreur&select=id,nom`, { headers: sbHeaders })).json();
      if (Array.isArray(livs) && livs.length === 1) { autoLivreurId = livs[0].id; autoLivreurNom = livs[0].nom; }
    } catch(e) { console.error("Livreur auto-assign error:", e.message); }

    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ org_id:orgId, client:clientName, phone, address, city: matchedCity || matchedZone?.name || city || null, delivery_zone_name:matchedZone?.name||null, delivery_zone_type:regionType, product:finalProduct, price, status:"boutique", note, archived:false, is_bundle:totalQty>1||items.length>1, frais_liv:syncMeta.frais_liv, livreur:autoLivreurNom, livreur_id:autoLivreurId, closer:null, closer_id:null, sync_status:syncMeta.sync_status, unmatched_city:syncMeta.unmatched_city, unmatched_region:syncMeta.unmatched_region, platform:"youcan", region_type:regionType, payment_type:paymentType, total_discount:totalDiscount, items_count:itemsForDb.length||1 }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    // ── Insert order_items ───────────────────────────────────────────────
    let insertedOrderId = null;
    try {
      const created = await res.json();
      insertedOrderId = Array.isArray(created) ? created[0]?.id : created?.id;
    } catch(e) { console.error("Order parse error:", e.message); }
    if (insertedOrderId && itemsForDb.length > 0) {
      try {
        const itemsRes = await fetch(`${SB_URL}/rest/v1/order_items`, {
          method: "POST",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify(itemsForDb.map(it => ({ ...it, order_id: insertedOrderId, org_id: orgId }))),
        });
        if (!itemsRes.ok) console.error("order_items insert error:", await itemsRes.text());
      } catch(e) { console.error("order_items insert error:", e.message); }
    }

    console.log(`[TEAMLY] YouCan ${ref} — city="${city}" matchType=${matchType} frais=${fraisAmount} CFA`);
    return { statusCode: 200, headers, body: JSON.stringify({ success:true, ref, matched, finalProduct, zone:{matchType,frais:fraisAmount} }) };
  } catch (e) {
    console.error("YouCan Shop webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
