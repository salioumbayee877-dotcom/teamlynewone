const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_URL      = "https://rddtislrbbkjpoqpdcry.supabase.co";

const svcHeaders = {
  "Content-Type":  "application/json",
  "apikey":        SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
};

exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "Method not allowed" };

  try {
    const { memberId, orgId, adminJwt } = JSON.parse(event.body || "{}");
    if (!memberId || !orgId || !adminJwt)
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing params" }) };

    // 1. Verify caller is admin of this org (uses their JWT — RLS enforced read)
    const verifyRes = await fetch(
      `${SB_URL}/rest/v1/profiles?org_id=eq.${orgId}&role=eq.admin&select=id&limit=1`,
      { headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${adminJwt}` } }
    );
    const admins = await verifyRes.json();
    if (!Array.isArray(admins) || admins.length === 0)
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Unauthorized — not admin of this org" }) };

    // 2. Confirm member belongs to this org and is not admin (service key read)
    const memberRes = await fetch(
      `${SB_URL}/rest/v1/profiles?id=eq.${memberId}&org_id=eq.${orgId}&select=id,role`,
      { headers: svcHeaders }
    );
    const members = await memberRes.json();
    if (!Array.isArray(members) || members.length === 0)
      return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Member not found in org" }) };
    if (members[0].role === "admin")
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Cannot remove admin account" }) };

    // 3. Soft-delete: nullify org_id so the member is locked out immediately (guaranteed to work)
    const patchRes = await fetch(
      `${SB_URL}/rest/v1/profiles?id=eq.${memberId}`,
      {
        method:  "PATCH",
        headers: { ...svcHeaders, Prefer: "return=minimal" },
        body:    JSON.stringify({ org_id: null }),
      }
    );

    if (!patchRes.ok) {
      const err = await patchRes.text();
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: `Supabase PATCH error: ${err}` }) };
    }

    // 4. Hard-delete the profile row (best effort — org_id=null already did the job)
    await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${memberId}`, {
      method: "DELETE",
      headers: svcHeaders,
    }).catch(() => {});

    // 5. Hard-delete the Supabase auth user so they can't log back in
    await fetch(`${SB_URL}/auth/v1/admin/users/${memberId}`, {
      method:  "DELETE",
      headers: svcHeaders,
    }).catch(() => {});

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };

  } catch (e) {
    console.error("delete-member error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
