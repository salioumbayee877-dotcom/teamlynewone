"use strict";

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function norm(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function parseCity(s) {
  const idx = (s || "").lastIndexOf("|");
  return idx === -1
    ? { name: s || "", price: null }
    : { name: s.slice(0, idx), price: parseInt(s.slice(idx + 1)) || null };
}

/**
 * Match a raw city string to a delivery zone.
 * Order: exact → alias → fuzzy (Levenshtein ≤ 2) → fallback.
 *
 * @param {string}      rawCity      City as received from Shopify/Woo/YouCan
 * @param {object|null} mainRegion   delivery_main_region row (may include .aliases TEXT[])
 * @param {Array}       otherRegions delivery_other_regions rows
 * @returns {{ zone: object|null, matchType: 'exact'|'alias'|'fuzzy'|'fallback', confidence: number, fee: number }}
 */
function matchDeliveryZone(rawCity, mainRegion, otherRegions) {
  const t = norm(rawCity);
  if (!t) return { zone: null, matchType: "fallback", confidence: 0, fee: 0 };

  // ── 1. Exact match ──────────────────────────────────────────────────────
  if (mainRegion) {
    if (norm(mainRegion.name) === t)
      return { zone: { ...mainRegion, _type: "main" }, matchType: "exact", confidence: 1, fee: mainRegion.price ?? 0 };
    for (const cs of (mainRegion.cities || [])) {
      const { name, price } = parseCity(cs);
      if (norm(name) === t)
        return { zone: { ...mainRegion, _type: "main" }, matchType: "exact", confidence: 1, fee: price ?? mainRegion.price ?? 0 };
    }
    for (const alias of (mainRegion.aliases || [])) {
      if (norm(alias) === t)
        return { zone: { ...mainRegion, _type: "main" }, matchType: "alias", confidence: 1, fee: mainRegion.price ?? 0 };
    }
  }

  for (const r of (otherRegions || [])) {
    const itb = r.interurbain_price || 0;
    if (norm(r.name) === t)
      return { zone: { ...r, _type: "other" }, matchType: "exact", confidence: 1, fee: (r.price ?? 0) + itb };
    for (const cs of (r.cities || [])) {
      const { name, price } = parseCity(cs);
      if (norm(name) === t)
        return { zone: { ...r, _type: "other" }, matchType: "exact", confidence: 1, fee: (price ?? r.price ?? 0) + itb };
    }
    for (const alias of (r.aliases || [])) {
      if (norm(alias) === t)
        return { zone: { ...r, _type: "other" }, matchType: "alias", confidence: 1, fee: (r.price ?? 0) + itb };
    }
  }

  // ── 2. Fuzzy match (Levenshtein ≤ 2) ───────────────────────────────────
  let bestDist = Infinity, bestZone = null, bestFee = 0;

  const tryFuzzy = (name, zone, fee) => {
    const n = norm(name);
    if (!n || n.length < 2) return;
    const d = levenshtein(t, n);
    if (d <= 2 && d < bestDist) { bestDist = d; bestZone = zone; bestFee = fee; }
  };

  if (mainRegion) {
    const base = { ...mainRegion, _type: "main" };
    tryFuzzy(mainRegion.name, base, mainRegion.price ?? 0);
    for (const cs of (mainRegion.cities || [])) { const { name, price } = parseCity(cs); tryFuzzy(name, base, price ?? mainRegion.price ?? 0); }
    for (const alias of (mainRegion.aliases || [])) tryFuzzy(alias, base, mainRegion.price ?? 0);
  }
  for (const r of (otherRegions || [])) {
    const itb = r.interurbain_price || 0;
    const base = { ...r, _type: "other" };
    tryFuzzy(r.name, base, (r.price ?? 0) + itb);
    for (const cs of (r.cities || [])) { const { name, price } = parseCity(cs); tryFuzzy(name, base, (price ?? r.price ?? 0) + itb); }
    for (const alias of (r.aliases || [])) tryFuzzy(alias, base, (r.price ?? 0) + itb);
  }

  if (bestZone) {
    const confidence = +(1 - bestDist / Math.max(t.length, 1)).toFixed(2);
    return { zone: bestZone, matchType: "fuzzy", confidence, fee: bestFee };
  }

  // ── 3. Fallback ─────────────────────────────────────────────────────────
  return { zone: null, matchType: "fallback", confidence: 0, fee: 0 };
}

module.exports = { matchDeliveryZone };
