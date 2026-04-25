const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = process.env.SUPABASE_URL || "https://rddtislrbbkjpoqpdcry.supabase.co";
const OWNER_EMAIL = process.env.SUPER_ADMIN_EMAIL || "salioumbayee877@gmail.com";

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  // Verify caller is the owner via Supabase JWT
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: "Non autorisé" }) };

  try {
    // Verify token and get user email
    const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${token}` },
    });
    const userData = await userRes.json();
    if (!userRes.ok || userData.email !== OWNER_EMAIL)
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Accès refusé — réservé au propriétaire" }) };

    const method = event.httpMethod;
    const month  = new Date().toISOString().slice(0, 7);

    // GET — list all orgs with stats
    if (method === "GET") {
      const [orgsRes, profilesRes] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/organizations?select=id,name,plan,plan_expires_at,created_at&order=created_at.desc`, { headers: sbHeaders }),
        fetch(`${SB_URL}/rest/v1/profiles?select=org_id,role`, { headers: sbHeaders }),
      ]);
      const orgs     = await orgsRes.json();
      const profiles = await profilesRes.json();

      // Count members and fetch order counts per org
      const memberCounts = {};
      if (Array.isArray(profiles)) {
        profiles.forEach(p => { memberCounts[p.org_id] = (memberCounts[p.org_id] || 0) + 1; });
      }

      // Fetch orders this month for all orgs
      const ordersRes = await fetch(
        `${SB_URL}/rest/v1/orders?select=org_id&created_at=gte.${month}-01`,
        { headers: sbHeaders }
      );
      const orders = await ordersRes.json();
      const orderCounts = {};
      if (Array.isArray(orders)) {
        orders.forEach(o => { orderCounts[o.org_id] = (orderCounts[o.org_id] || 0) + 1; });
      }

      const result = Array.isArray(orgs) ? orgs.map(o => ({
        ...o,
        memberCount: memberCounts[o.id] || 0,
        ordersThisMonth: orderCounts[o.id] || 0,
      })) : [];

      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // PATCH — update plan for an org
    if (method === "PATCH") {
      const { orgId, plan, plan_expires_at } = JSON.parse(event.body || "{}");
      if (!orgId || !plan) return { statusCode: 400, headers, body: JSON.stringify({ error: "orgId et plan requis" }) };

      const validPlans = ["gratuit", "basic", "pro", "scale"];
      if (!validPlans.includes(plan)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Plan invalide" }) };

      const patch = { plan };
      if (plan_expires_at !== undefined) patch.plan_expires_at = plan_expires_at || null;

      const res = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${orgId}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur Supabase" }) };
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (e) {
    console.error("super-admin error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
