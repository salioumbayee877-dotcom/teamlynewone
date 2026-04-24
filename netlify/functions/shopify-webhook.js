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

    const firstName  = order.billing_address?.first_name || order.customer?.first_name || "";
    const lastName   = order.billing_address?.last_name  || order.customer?.last_name  || "";
    const clientName = `${firstName} ${lastName}`.trim() || order.email || "Client Shopify";
    const rawPhone   = order.billing_address?.phone || order.shipping_address?.phone || order.phone || "";
    // Keep full digits — preserve country code if present, strip leading 00/+
    const digits     = rawPhone.replace(/\D/g,"").replace(/^00/,"");
    const phone      = digits.startsWith("221") ? digits : digits.startsWith("0") ? "221" + digits.slice(1) : digits.length >= 8 ? "221" + digits.slice(-9) : digits;
    const addr       = order.shipping_address;
    const address    = addr ? [addr.address1, addr.city, addr.country].filter(Boolean).join(", ") : "";

    // Build clean product name from Shopify line items (without size/variant details)
    const lineItems     = order.line_items || [];
    const shopifyProduct = lineItems.map(i=>`${i.title||i.name}${i.quantity>1?` x${i.quantity}`:""}`).join(" + ") || "Produit Shopify";
    const unitPrice      = lineItems.length > 0 ? parseFloat(lineItems[0].price || 0) : parseFloat(order.total_price || 0);
    const price          = parseFloat(order.total_price || 0);
    const shopifyRef     = `#${order.order_number || order.id}`;

    // ── Duplicate check ──────────────────────────────────────────────────
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&note=like.Commande%20Shopify%20${encodeURIComponent(shopifyRef)}*&select=id`,
      { headers: sbHeaders }
    );
    const existing = await checkRes.json();
    if (existing && existing.length > 0)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref: shopifyRef, skipped: true }) };

    // ── Product catalog matching ─────────────────────────────────────────
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
        // Try to find an existing match
        let best = 0, bestName = null;
        for (const p of catalog) {
          const score = matchScore(p.name, shopifyProduct);
          if (score > best) { best = score; bestName = p.name; }
        }
        if (best >= 0.5) {
          finalProduct = bestName;
          matched      = true;
        }
      }

      // No match found → auto-create the product in the catalog
      if (!matched) {
        // Use the first line item title as the clean product name
        const cleanName = (lineItems[0]?.title || shopifyProduct).split(" - ")[0].trim();

        // Check if this exact name already exists (avoid duplicates)
        const existProd = Array.isArray(catalog)
          ? catalog.find(p => norm(p.name) === norm(cleanName))
          : null;

        if (!existProd) {
          await fetch(`${SB_URL}/rest/v1/products`, {
            method: "POST",
            headers: { ...sbHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({
              org_id:        orgId,
              name:          cleanName,
              price:         unitPrice,
              cost:          0,        // owner fills in manually
              stock:         0,
              stock_initial: 0,
              frais_liv:     1500,
              archived:      false,
            }),
          });
          autoCreated  = true;
          finalProduct = cleanName;
        } else {
          // Exact norm match found — use it
          finalProduct = existProd.name;
          matched      = true;
        }
      }
    } catch(e) {
      console.error("Catalog error:", e.message);
      // Fall back to raw Shopify name — order still gets created
    }

    const note = `Commande Shopify ${shopifyRef}${matched ? " ✓" : autoCreated ? " ★" : ""}`;

    // ── Insert order ─────────────────────────────────────────────────────
    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        org_id: orgId, client: clientName, phone, address,
        product: finalProduct, price,
        status: "boutique", note, archived: false, is_bundle: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", err);
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref: shopifyRef, matched, autoCreated, finalProduct }) };
  } catch (e) {
    console.error("Webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
