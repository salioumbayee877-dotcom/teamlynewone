const { matchDeliveryZone } = require('./lib/matchDeliveryZone');
const { deriveSyncStatus }  = require('./lib/syncStatus');
const { extractCityFromAddress } = require('./lib/senegalCities');
const { corsOrigin } = require('./lib/cors');
const { parsePackQuantity } = require('./lib/parsePack');
const { ensureProduct } = require('./lib/ensureProduct');
const { notifyPlanLimit } = require('./lib/notifyPlanLimit');
const { expandBundles } = require('./lib/bundleParser');
const { sendPush } = require('./lib/sendPush');

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

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin(origin),
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
    const addressParts = addr ? [addr.address1, addr.address2, addr.city, addr.province].filter(Boolean) : [];
    const address = addressParts.join(", ") || "";
    // Resolve the actual Sénégal city from the full address (handles cases
    // where Shopify's `city` field is "-", empty, or just a quartier).
    const extracted = extractCityFromAddress(address) || extractCityFromAddress(addr?.city);
    const isJunkCity = (s) => { const t = (s||"").trim(); return !t || t === "-" || t === "—" || t.length < 2; };
    // city: lo mejor que tengamos para mostrar / guardar como hint
    const city     = extracted?.city || (isJunkCity(addr?.city) ? "" : addr?.city) || "";
    // citySearch: lo que pasamos al matcher. Si city es junk, usa la dirección
    // completa para que matchDeliveryZone tokenice y aplique fuzzy.
    const citySearch = city || address || addr?.address1 || "";
    const cityIsDakar = extracted?.isDakar === true;
    const provinceForMeta = extracted?.region || addr?.province || null;

    // ── Products ──────────────────────────────────────────────────────────
    const rawLineItems   = order.line_items || [];
    const bundleResult   = expandBundles(rawLineItems, "shopify");
    const lineItems      = bundleResult.items;
    if (bundleResult.source) console.log(`[TEAMLY] Shopify bundle detected: ${bundleResult.source} → ${lineItems.length} children`);
    const shopifyProduct = lineItems.map(i=>`${i.title||i.name} x${i.quantity||1}`).join(" + ") || "Produit Shopify";
    const totalQty       = lineItems.reduce((s,i)=>s+(parseInt(i.quantity)||1),0);
    const price          = parseFloat(order.total_price || 0);
    const shopifyRef     = `#${order.order_number || order.id}`;

    // ── Plan limit check (bypass para OWNER) ──────────────────────────────
    const LIMITS = {gratuit:30, starter:30, trial:30, basic:100, pro:200, scale:999999};
    const OWNER_EMAILS = ["salioumbayee877@gmail.com","salioumbayeee261@gmail.com"];
    try {
      // Verifica si la org pertenece al OWNER → skip limit
      const adminRes = await fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&role=eq.admin&select=email&limit=5`, { headers: sbHeaders });
      const admins   = await adminRes.json();
      const isOwnerOrg = Array.isArray(admins) && admins.some(a => OWNER_EMAILS.includes((a.email||"").toLowerCase()));

      if (!isOwnerOrg) {
        const orgRes  = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=plan&limit=1`, { headers: sbHeaders });
        const orgData = await orgRes.json();
        const plan    = orgData?.[0]?.plan || "gratuit";
        const limit   = LIMITS[plan] ?? 30;
        const month   = new Date().toISOString().slice(0,7);
        const cntRes  = await fetch(`${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&created_at=gte.${month}-01&select=id`, { headers: sbHeaders });
        const cnt     = (await cntRes.json())?.length || 0;
        // Notificación al 80% (1 sola vez por mes)
        await notifyPlanLimit({ orgId, cnt, limit, plan, sbHeaders, SB_URL });
        if (cnt >= limit)
          return { statusCode: 429, headers, body: JSON.stringify({ error: `Limite ${limit} commandes/mois atteinte (plan ${plan})` }) };
      }
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
      const result   = matchDeliveryZone(citySearch, main, others);
      fraisAmount    = result.fee;
      matchType      = result.matchType;
      matchedZone    = result.zone;
      matchedCity    = result.matchedCity || null;
      syncMeta       = deriveSyncStatus(result, main, others, citySearch, provinceForMeta, settings, { isDakar: cityIsDakar || matchedZone?._type === "main" });
    } catch(e) { console.error("Zone matching error:", e.message); }

    const fraisBlocked = matchType === "fallback";
    const regionType   = matchedZone?._type === "other" ? "other" : matchedZone?._type === "main" ? "main" : null;
    const paymentType  = regionType === "other" ? "prepaid" : regionType === "main" ? "cod" : null;

    // ── Product catalog matching (por línea) ──────────────────────────────
    // Si no hay match automático (score ≥ 0.5), dejar producto vacío para
    // que el admin lo seleccione manualmente. No auto-crear productos.
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

    // Construir order_items (1 por línea Shopify)
    const itemsForDb = [];
    let totalDiscount = 0;
    let anyMatched = false;
    let firstMatchedName = null;
    let anyAmbiguous = false;
    for (const it of lineItems) {
      const rawName    = it.title || it.name || "Produit";
      const variant    = it.variant_title || null;
      const qty        = parseInt(it.quantity) || 1;
      const unitPrice  = parseFloat(it.price || 0);
      const lineGross  = qty * unitPrice;
      const lineDisc   = Array.isArray(it.discount_allocations)
        ? it.discount_allocations.reduce((s,d)=>s + parseFloat(d.amount || 0), 0)
        : 0;
      totalDiscount += lineDisc;
      const matchTarget = [rawName, variant].filter(Boolean).join(" ");
      let matchedP = matchLine(matchTarget);
      if (!matchedP) {
        // Auto-crear producto en catálogo (cost=0, a configurar por admin)
        matchedP = await ensureProduct({ orgId, rawName, unitPrice, sbHeaders, SB_URL, catalog });
      }
      if (matchedP) {
        anyMatched = true;
        if (!firstMatchedName) firstMatchedName = matchedP.name;
      }
      const { packQuantity, ambiguous } = parsePackQuantity(variant, rawName);
      if (ambiguous) anyAmbiguous = true;
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
    // Fallback orden-level discount si Shopify no lo desglosó por línea
    if (totalDiscount === 0) {
      const orderDisc = parseFloat(order.total_discounts || order.current_total_discounts || 0);
      if (orderDisc > 0 && itemsForDb.length > 0) {
        // prorratear sobre primera línea (caso simple, 1 producto)
        itemsForDb[0].discount_amount = orderDisc;
        totalDiscount = orderDisc;
      }
    }
    const finalProduct  = firstMatchedName;
    const matched       = anyMatched;
    const rawProductName = shopifyProduct;

    const prodFlag = matched ? " ✓" : ` ❓${rawProductName}`;
    const zoneFlag = fraisBlocked ? ` ⚠️🏙️${city}` : matchType === "fuzzy" ? ` ~🏙️${city}` : ` 🏙️${city}`;
    const note     = `Commande Shopify ${shopifyRef}${prodFlag}${zoneFlag}`;

    // ── Auto-asignación de livreur si solo hay uno en la org ─────────────
    let autoLivreurId = null, autoLivreurNom = null;
    try {
      const livs = await (await fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&role=eq.livreur&select=id,nom`, { headers: sbHeaders })).json();
      if (Array.isArray(livs) && livs.length === 1) {
        autoLivreurId = livs[0].id; autoLivreurNom = livs[0].nom;
      }
    } catch(e) { console.error("Livreur auto-assign error:", e.message); }

    // ── Insert order ──────────────────────────────────────────────────────
    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        tracking_token: require('crypto').randomUUID(),
        org_id: orgId, client: clientName, phone, address,
        city: matchedCity || (matchedZone?.name) || city || null,
        delivery_zone_name: matchedZone?.name || null,
        delivery_zone_type: regionType,
        product: finalProduct, price,
        status: "boutique",
        note, archived: false,
        is_bundle: totalQty > 1 || lineItems.length > 1,
        frais_liv: syncMeta.frais_liv,
        livreur: autoLivreurNom, livreur_id: autoLivreurId, closer: null, closer_id: null,
        sync_status: syncMeta.sync_status,
        unmatched_city:   syncMeta.unmatched_city,
        unmatched_region: syncMeta.unmatched_region,
        platform: "shopify",
        region_type:  regionType,
        payment_type: paymentType,
        total_discount: totalDiscount,
        items_count:    itemsForDb.length || 1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", err);
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    // ── Insert order_items (1 fila por línea Shopify) ────────────────────
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

    // ── OS push (notification shade) ──────────────────────────────────────
    try {
      const bodyTxt = `${clientName} — ${shopifyProduct} · ${Math.round(price).toLocaleString("fr-FR")} CFA`;
      await sendPush({
        orgId,
        roles: ["admin", "closer"],
        title: "🛒 Nouvelle commande Shopify",
        body: bodyTxt,
        tag: `order-${insertedOrderId||shopifyRef}`,
        url: "/?tab=commandes",
      });
    } catch (e) { console.error("Push error:", e.message); }

    const zoneName = matchedZone?.name || "";
    console.log(`[TEAMLY] Shopify ${shopifyRef} — city="${city}" matchType=${matchType} zone="${zoneName}" frais=${fraisAmount} CFA`);
    if (fraisBlocked) console.log(`  WARN: city "${city}" not found in zones — admin review needed`);

    return { statusCode: 200, headers, body: JSON.stringify({
      success: true, ref: shopifyRef, matched, finalProduct,
      zone: { matchType, name: zoneName, frais: fraisAmount, blocked: fraisBlocked },
    })};
  } catch (e) {
    console.error("Webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
