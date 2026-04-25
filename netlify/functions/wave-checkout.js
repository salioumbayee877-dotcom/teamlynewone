const WAVE_API_KEY   = process.env.WAVE_API_KEY;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const SB_URL         = "https://rddtislrbbkjpoqpdcry.supabase.co";
const APP_URL        = process.env.APP_URL || "https://admirable-gingersnap-0038d8.netlify.app";

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
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };
  if (origin && !ALLOWED.includes(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  if (!WAVE_API_KEY)
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Wave API key non configurée" }) };

  try {
    const { orgId } = JSON.parse(event.body || "{}");
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: "orgId requis" }) };

    const res = await fetch("https://api.wave.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WAVE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: "7500",
        currency: "XOF",
        error_url:   `${APP_URL}/?payment=error&org=${orgId}`,
        success_url: `${APP_URL}/?payment=success&org=${orgId}`,
        client_reference: orgId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Wave error:", err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur Wave: " + err }) };
    }

    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify({ url: data.wave_launch_url }) };
  } catch (e) {
    console.error("wave-checkout error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
