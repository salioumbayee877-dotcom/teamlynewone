"use strict";

// Bundle parsers — detectan apps de bundles en webhooks y expanden el line_item
// "parent" en sus componentes hijos para que el resto del webhook procese cada
// producto individualmente (1 order_item por hijo).
//
// Estrategia: cascada. Cada parser devuelve null si no detecta su firma; el
// primero que detecta gana. Si ninguno detecta, devolvemos los line_items tal
// cual (con detección heurística "Pack de N" que ya hace parsePackQuantity).
//
// Cada parser devuelve un array de line_items en el MISMO shape que Shopify
// (title, variant_title, quantity, price, discount_allocations, properties)
// para no romper el código existente del webhook.

// ── Helpers ────────────────────────────────────────────────────────────────
const propsOf = (it) => Array.isArray(it.properties) ? it.properties : [];
const metaOf  = (it) => Array.isArray(it.meta_data)   ? it.meta_data   : [];
const propVal = (it, regex) => {
  const p = propsOf(it).find(x => typeof x.name === "string" && regex.test(x.name));
  return p ? p.value : null;
};
const metaVal = (it, regex) => {
  const m = metaOf(it).find(x => typeof x.key === "string" && regex.test(x.key));
  return m ? m.value : null;
};
const tryJSON = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };

// ── Releasit Upsell & Bundles (Shopify) ────────────────────────────────────
// Releasit pone marcadores en line_item.properties con prefijos como:
//   `_RoBundle`, `_releasit_bundle`, `_ro_components`, `_ro_bundle_main`.
// Dos patrones observados:
//   A) Parent compactado: 1 line_item con propiedad `_ro_components`
//      conteniendo JSON con los hijos {title, qty, price, variant}.
//   B) Expandido: N line_items (1 por hijo) + 1 "main" marcador a saltar
//      (marcado con _ro_bundle_main = 1).
function parseReleasit(lineItems) {
  const sig = /^_?(releasit|ro[_-]?bundle|ro[_-]?components?)/i;
  const hasReleasit = lineItems.some(it => propsOf(it).some(p => sig.test(p.name||"")));
  if (!hasReleasit) return null;

  // Patrón A: componentes en JSON
  for (const it of lineItems) {
    const raw = propVal(it, /components?$/i) || propVal(it, /_ro[_-]?items?$/i);
    if (raw) {
      const comps = tryJSON(raw);
      if (Array.isArray(comps) && comps.length > 0) {
        const parentQty = parseInt(it.quantity) || 1;
        return comps.map(c => ({
          title:           c.title || c.name || "Bundle item",
          variant_title:   c.variant_title || c.variant || null,
          quantity:        (parseInt(c.quantity || c.qty)||1) * parentQty,
          price:           c.price || c.unit_price || 0,
          discount_allocations: [],
          properties:      [{name:"_bundle_source",value:"releasit"}],
          _bundleSource:   "releasit",
        }));
      }
    }
  }

  // Patrón B: ya expandido. Filtramos el line_item "main" si existe.
  const expanded = lineItems.filter(it => {
    const isMain = propsOf(it).some(p =>
      /(main|parent|header)$/i.test(p.name||"") && /^(1|true|yes)$/i.test(String(p.value||""))
    );
    return !isMain;
  });
  return expanded.length ? expanded : lineItems;
}

// ── FastBundle / Easy Bundles (Shopify) ────────────────────────────────────
// FastBundle marca con `_fb_*`, `_fastbundle_*`. Easy Bundles con `_eb_*`.
// Patrones similares a Releasit.
function parseFastBundle(lineItems) {
  const sig = /^_?(fb[_-]|fastbundle|eb[_-]|easybundle)/i;
  const hasFB = lineItems.some(it => propsOf(it).some(p => sig.test(p.name||"")));
  if (!hasFB) return null;

  for (const it of lineItems) {
    const raw = propVal(it, /(components?|children|items?)$/i);
    if (raw) {
      const comps = tryJSON(raw);
      if (Array.isArray(comps) && comps.length > 0) {
        const parentQty = parseInt(it.quantity) || 1;
        return comps.map(c => ({
          title:           c.title || c.name || "Bundle item",
          variant_title:   c.variant_title || c.variant || null,
          quantity:        (parseInt(c.quantity || c.qty)||1) * parentQty,
          price:           c.price || c.unit_price || 0,
          discount_allocations: [],
          properties:      [{name:"_bundle_source",value:"fastbundle"}],
          _bundleSource:   "fastbundle",
        }));
      }
    }
  }

  // Expandido: saltar parent si marcado
  const expanded = lineItems.filter(it => {
    const isMain = propsOf(it).some(p =>
      /(main|parent|wrapper)$/i.test(p.name||"") && /^(1|true|yes)$/i.test(String(p.value||""))
    );
    return !isMain;
  });
  return expanded.length ? expanded : lineItems;
}

// ── Shopify Bundles (nativo, gratis) ───────────────────────────────────────
// El line_item parent tiene un array `bundle_components` con los hijos.
function parseShopifyNative(lineItems) {
  const parent = lineItems.find(it => Array.isArray(it.bundle_components) && it.bundle_components.length > 0);
  if (!parent) return null;

  const parentQty = parseInt(parent.quantity) || 1;
  return parent.bundle_components.map(c => ({
    title:           c.title || c.name || "Bundle item",
    variant_title:   c.variant_title || null,
    quantity:        (parseInt(c.quantity)||1) * parentQty,
    price:           c.price || 0,
    discount_allocations: [],
    properties:      [{name:"_bundle_source",value:"shopify_native"}],
    _bundleSource:   "shopify_native",
  }));
}

// ── WooCommerce Product Bundles ────────────────────────────────────────────
// El plugin pone en line_item.meta_data:
//   - parent: meta_data con key `_bundled_items` (lista de cart_keys hijos)
//   - children: meta_data con key `_bundled_by` (apunta al cart_key del parent)
// El parent suele tener price=0 (es solo el wrapper); los hijos tienen los
// precios reales. Estrategia: filtramos a los hijos y los devolvemos.
function parseWCProductBundles(lineItems) {
  const hasBundle = lineItems.some(it => metaOf(it).some(m => /^_?bundled_(by|items)$/i.test(m.key||"")));
  if (!hasBundle) return null;

  // Si hay hijos explícitos (con _bundled_by), devolvemos solo esos
  const children = lineItems.filter(it => metaVal(it, /^_?bundled_by$/i));
  if (children.length > 0) {
    return children.map(it => ({
      ...it,
      properties: [{name:"_bundle_source",value:"wc_product_bundles"}],
      _bundleSource: "wc_product_bundles",
    }));
  }

  // Sin _bundled_by explícito: probamos a parsear _bundled_items del parent
  for (const parent of lineItems) {
    const raw = metaVal(parent, /^_?bundled_items$/i);
    if (raw) {
      // bundled_items suele ser string comma-separated o JSON; no podemos
      // expandir sin la info de cada hijo. Si no aparecen como line_items,
      // devolvemos null para que caiga al fallback heurístico.
      return null;
    }
  }
  return null;
}

// ── Cascada principal ─────────────────────────────────────────────────────
function expandBundles(lineItems, platform) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return { items: lineItems || [], source: null };

  let detectors;
  if (platform === "woocommerce") {
    detectors = [parseWCProductBundles];
  } else {
    // Shopify y YouCan comparten estructura similar (line_items + properties)
    detectors = [parseShopifyNative, parseReleasit, parseFastBundle];
  }

  for (const detector of detectors) {
    try {
      const result = detector(lineItems);
      if (Array.isArray(result) && result.length > 0) {
        const source = result[0]?._bundleSource || detector.name.replace(/^parse/, "").toLowerCase();
        return { items: result, source };
      }
    } catch (e) {
      console.error(`[bundleParser] ${detector.name} error:`, e.message);
    }
  }

  return { items: lineItems, source: null };
}

module.exports = { expandBundles };
