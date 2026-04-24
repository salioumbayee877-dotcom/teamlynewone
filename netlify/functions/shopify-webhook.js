const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL = "https://rddtislrbbkjpoqpdcry.supabase.co";

// Normalize string for fuzzy matching: lowercase, remove accents + special chars
const norm = s => (s||"").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();

// Score: % of catalog product words found in the Shopify product string
const matchScore = (catalogName, shopifyStr) => {
  const words = norm(catalogName).split(" ").filter(w => w.length > 2);
  if (!words.length) return 0;
  const target = norm(shopifyStr);
  const hits = words.filter(w => target.includes(w)).length;
  return hits / words.length;
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const order = JSON.parse(event.body || "{}");
    const orgId = event.queryStringParameters?.org;

    if (!orgId) return { statusCode: 400, headers, body: "Missing ?org= parameter" };

    const firstName = order.billing_address?.first_name || order.customer?.first_name || "";
    const lastName  = order.billing_address?.last_name  || order.customer?.last_name  || "";
    const clientName = `${firstName} ${lastName}`.trim() || order.email || "Client Shopify";

    const rawPhone = order.billing_address?.phone || order.shipping_address?.phone || order.phone || "";
    const phone = rawPhone.replace(/\D/g, "").slice(-9);

    const addr = order.shipping_address;
    const address = addr ? [addr.address1, addr.city, addr.country].filter(Boolean).join(", ") : "";

    // Raw Shopify product name
    const shopifyProduct = (order.line_items || [])
      .map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`)
      .join(" + ") || "Produit Shopify";
    const price      = parseFloat(order.total_price || 0);
    const shopifyRef = `#${order.order_number || order.id}`;

    // ── Duplicate check ──────────────────────────────────────────────────
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&note=eq.Commande%20Shopify%20${encodeURIComponent(shopifyRef)}&select=id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const existing = await checkRes.json();
    if (existing && existing.length > 0)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref: shopifyRef, skipped: true }) };

    // ── Product matching ─────────────────────────────────────────────────
    // Fetch catalog products for this org
    let matchedName = null;
    let matched = false;
    try {
      const prodsRes = await fetch(
        `${SB_URL}/rest/v1/products?org_id=eq.${orgId}&archived=eq.false&select=id,name`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const catalog = await prodsRes.json();
      if (Array.isArray(catalog) && catalog.length > 0) {
        let best = 0;
        for (const p of catalog) {
          const score = matchScore(p.name, shopifyProduct);
          if (score > best) { best = score; matchedName = p.name; }
        }
        // Require at least 50% word overlap to accept the match
        if (best < 0.5) matchedName = null;
        else matched = true;
      }
    } catch(e) { /* catalog fetch failed — use raw Shopify name */ }

    const finalProduct = matchedName || shopifyProduct;
    // Append a marker so the app can show matched vs unmatched
    const note = matched
      ? `Commande Shopify ${shopifyRef} ✓`
      : `Commande Shopify ${shopifyRef}`;

    // ── Insert order ─────────────────────────────────────────────────────
    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        org_id: orgId,
        client: clientName,
        phone,
        address,
        product: finalProduct,
        price,
        status: "boutique",
        note,
        archived: false,
        is_bundle: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", err);
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref: shopifyRef, matched, matchedName }) };
  } catch (e) {
    console.error("Webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
