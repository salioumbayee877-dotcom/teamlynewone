// Asegura que un producto existe en el catálogo de la org.
// 1) Busca match exacto case-insensitive en el catalog ya cargado.
// 2) Si no existe, lo crea con cost=0 y price del webhook (a configurar después).
// Devuelve el producto (con id) o null si la creación falla.
// Muta el array `catalog` para que la próxima línea del mismo webhook lo reuse.
async function ensureProduct({ orgId, rawName, unitPrice, sbHeaders, SB_URL, catalog }) {
  const name = (rawName || "").trim();
  if (!name) return null;
  const exact = catalog.find(p => (p.name || "").toLowerCase() === name.toLowerCase());
  if (exact) return exact;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/products`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        org_id:        orgId,
        name,
        cost:          0,                              // a configurar por el admin
        price:         parseFloat(unitPrice) || 0,
        stock:         0,
        stock_initial: 0,
        niche:         "Non configuré",
        archived:      false,
      }),
    });
    if (!res.ok) {
      console.error("ensureProduct create error:", await res.text().catch(()=>""));
      return null;
    }
    const created = await res.json();
    const p = Array.isArray(created) ? created[0] : created;
    if (p) catalog.push(p);
    return p || null;
  } catch (e) {
    console.error("ensureProduct exception:", e.message);
    return null;
  }
}

module.exports = { ensureProduct };
