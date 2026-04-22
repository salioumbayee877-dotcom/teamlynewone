const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZHRpc2xyYmJranBvcXBkY3J5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMzNzAwMiwiZXhwIjoyMDkxOTEzMDAyfQ.qEXeYxoxqgyTr0-603bCxNBEFQOKlV7CfOF5RdijPWo";
const SB_URL = "https://rddtislrbbkjpoqpdcry.supabase.co";

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

    const product = (order.line_items || []).map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(" + ") || "Produit Shopify";
    const price   = parseFloat(order.total_price || 0);
    const shopifyRef = `#${order.order_number || order.id}`;

    const res = await fetch(`${SB_URL}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        org_id: orgId,
        client: clientName,
        phone,
        address,
        product,
        price,
        status: "boutique",
        note: `Commande Shopify ${shopifyRef}`,
        archived: false,
        is_bundle: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", err);
      return { statusCode: 500, headers, body: `Supabase error: ${err}` };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ref: shopifyRef }) };
  } catch (e) {
    console.error("Webhook error:", e.message);
    return { statusCode: 500, headers, body: `Error: ${e.message}` };
  }
};
