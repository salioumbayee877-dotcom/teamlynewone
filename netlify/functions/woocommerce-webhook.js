const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL = "https://rddtislrbbkjpoqpdcry.supabase.co";

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
    const order = JSON.parse(event.body || "{}");
    const orgId = event.queryStringParameters?.org;
    if (!orgId) return { statusCode: 400, headers, body: "Missing ?org= parameter" };

    // WooCommerce order fields
    const firstName  = order.billing?.first_name || "";
    const lastName   = order.billing?.last_name  || "";
    const clientName = `${firstName} ${lastName}`.trim() || order.billing?.email || "Client WooCommerce";
    const phone      = fmtPhone(order.billing?.phone || order.shipping?.phone || "");
    const addr       = order.shipping || order.billing;
    const address    = addr ? [addr.address_1, addr.city, addr.country].filter(Boolean).join(", ") : "";

    const lineItems    = order.line_items || [];
    const rawProduct   = lineItems.map(i=>`${i.name}${i.quantity>1?` x${i.quantity}`:""}`).join(" + ") || "Produit WooCommerce";
    const unitPrice    = lineItems.length > 0 ? parseFloat(lineItems[0].price || lineItems[0].total || 0) : parseFloat(order.total || 0);
    const price        = parseFloat(order.total || 0);
    const ref          = `#${order.number || order.id}`;

    // ── Plan limit check ────────────────────────────────────────────────
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

    // Duplicate check
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/orders?org_id=eq.${orgId}&note=like.Commande%20WooCommerce%20${encodeURIComponent(ref)}*&select=id`,
      { headers: sbHeaders }
    );
    const existing = await checkRes.json();
    if (existing?.length > 0)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref, skipped: true }) };

    // Product matching
    let finalProduct = rawProduct, matched = false, autoCreated = false;
    try {
      const catalog = await (await fetch(`${SB_URL}/rest/v1/products?org_id=eq.${orgId}&archived=eq.false&select=id,name,price`, { headers: sbHeaders })).json();
      if (Array.isArray(catalog) && catalog.length > 0) {
        let best = 0, bestName = null;
        for (const p of catalog) {
          const score = matchScore(p.name, rawProduct);
          if (score > best) { best = score; bestName = p.name; }
        }
        if (best >= 0.5) { finalProduct = bestName; matched = true; }
      }
      if (!matched) {
        const cleanName = (lineItems[0]?.name || rawProduct).split(" - ")[0].trim();
        const existProd = Array.isArray(catalog) ? catalog.find(p => norm(p.name) === norm(cleanName)) : null;
        if (!existProd) {
          await fetch(`${SB_URL}/rest/v1/products`, {
            method: "POST",
            headers: { ...sbHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({ org_id:orgId, name:cleanName, price:unitPrice, cost:0, stock:0, stock_initial:0, frais_liv:1500, archived:false }),
          });
          autoCreated = true; finalProduct = cleanName;
        } else { finalProduct = existProd.name; matched = true; }
      }
    } catch(e) { console.error("Catalog error:", e.message); }

    const note = `Commande WooCommerce ${ref}${matched?" ✓":autoCreated?" ★":""}`;

    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ org_id:orgId, client:clientName, phone, address, product:finalProduct, price, status:"boutique", note, archived:false, is_bundle:false }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success:true, ref, matched, autoCreated, finalProduct }) };
  } catch (e) {
    console.error("WooCommerce webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
