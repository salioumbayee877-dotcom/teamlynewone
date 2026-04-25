const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = "https://rddtislrbbkjpoqpdcry.supabase.co";
const WAVE_API_KEY = process.env.WAVE_API_KEY;

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

const ALLOWED = ["https://teamly.life","https://www.teamly.life","https://admirable-gingersnap-0038d8.netlify.app"];

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (origin && !ALLOWED.includes(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { orgId, sessionId } = JSON.parse(event.body || "{}");
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: "orgId requis" }) };

    // Verify payment with Wave API
    if (WAVE_API_KEY && sessionId) {
      const check = await fetch(`https://api.wave.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${WAVE_API_KEY}` },
      });
      if (check.ok) {
        const session = await check.json();
        if (session.payment_status !== "succeeded") {
          return { statusCode: 402, headers, body: JSON.stringify({ error: "Paiement non confirmé" }) };
        }
      }
    }

    // Update org plan (pro or scale) for 31 days
    const { plan = "pro" } = JSON.parse(event.body || "{}");
    const validPlan = ["pro","scale"].includes(plan) ? plan : "pro";
    const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ plan: "pro", plan_expires_at: expiresAt }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase error: " + err }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, expiresAt }) };
  } catch (e) {
    console.error("wave-success error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
