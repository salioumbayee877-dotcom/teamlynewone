const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL;

const LIMITS = { gratuit: 2, starter: 3, basic: 3, pro: 5, scale: 999, business: null };

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers, body: "Method not allowed" };

  const orgId = event.queryStringParameters?.org;
  if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing ?org=" }) };

  try {
    const [orgRes, membersRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}&select=plan&limit=1`, { headers: sbHeaders }),
      fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&select=id`,           { headers: sbHeaders }),
    ]);

    const orgData     = await orgRes.json();
    const membersData = await membersRes.json();

    const plan  = orgData?.[0]?.plan || "starter";
    const max   = LIMITS[plan] ?? 3;
    const count = Array.isArray(membersData) ? membersData.length : 0;
    const ok    = max === null || count < max;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok, plan, count, max }),
    };
  } catch (e) {
    console.error("check-member-limit error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
