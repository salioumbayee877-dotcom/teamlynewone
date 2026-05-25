// Notifica al admin cuando se llega al 80% del límite mensual del plan.
// Dedup: una sola notificación por org y por mes (data.month).

async function notifyPlanLimit({ orgId, cnt, limit, plan, sbHeaders, SB_URL }) {
  if (!Number.isFinite(cnt) || !Number.isFinite(limit) || limit <= 0) return;
  const threshold = Math.floor(limit * 0.8);
  if (cnt < threshold || cnt >= limit) return; // solo entre 80% y <100%

  const month = new Date().toISOString().slice(0, 7); // "2026-05"

  // Dedup: ¿ya notificamos este mes?
  try {
    const url = `${SB_URL}/rest/v1/notifications?org_id=eq.${orgId}&type=eq.plan_limit_warning&data->>month=eq.${month}&select=id&limit=1`;
    const existing = await fetch(url, { headers: sbHeaders });
    const arr = await existing.json();
    if (Array.isArray(arr) && arr.length > 0) return;
  } catch (e) {
    console.error("notifyPlanLimit dedup error:", e.message);
  }

  // Insert
  try {
    await fetch(`${SB_URL}/rest/v1/notifications`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        org_id: orgId,
        type: "plan_limit_warning",
        title: `⚠️ Limite du plan ${plan} bientôt atteinte`,
        body: `${cnt}/${limit} commandes utilisées ce mois. Passe à un plan supérieur pour ne pas perdre de ventes.`,
        role_target: "admin",
        read: false,
        data: { month, cnt, limit, plan },
      }),
    });
  } catch (e) {
    console.error("notifyPlanLimit insert error:", e.message);
  }
}

module.exports = { notifyPlanLimit };
