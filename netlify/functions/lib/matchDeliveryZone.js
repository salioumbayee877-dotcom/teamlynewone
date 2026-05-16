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

// Stopwords típicas en direcciones COD Senegal — se ignoran al tokenizar
const STOPWORDS = new Set([
  "rue","avenue","av","bd","boulevard","quartier","cite","cité","villa",
  "appartement","appt","apt","immeuble","residence","résidence","near",
  "pres","près","derriere","derrière","devant","face","a","à","au","aux",
  "le","la","les","de","du","des","et","ou","en","chez","vers","sur",
  "senegal","sénégal","sn","dakar","region","région"
]);

// Tokeniza + genera ventanas de 1 y 2 palabras (útil para "grand yoff", "guediawaye nord")
function buildCandidates(normStr) {
  const tokens = normStr.split(" ").filter(t => t.length >= 2 && !STOPWORDS.has(t));
  const cands = new Set();
  cands.add(normStr); // cadena completa
  for (let i = 0; i < tokens.length; i++) {
    cands.add(tokens[i]);
    if (i + 1 < tokens.length) cands.add(tokens[i] + " " + tokens[i+1]);
  }
  return [...cands];
}

// Threshold relativo basado en similitud: si la ciudad existe en el sistema
// y la similitud ≥ 60%, hacemos match. Palabras cortas tienen mínimo absoluto.
const MIN_SIMILARITY = 0.6; // 60% — pedido del usuario: 60-70% debe matchear
function fuzzyThreshold(nameLen) {
  if (nameLen <= 3) return 1;
  if (nameLen <= 5) return 2;
  // Para palabras largas, hasta 40% de la longitud puede diferir → 60% similitud mínima
  return Math.ceil(nameLen * 0.4); // 6 → 3, 8 → 4, 10 → 4, 13 → 6
}

/**
 * Match a raw city string to a delivery zone.
 * Order: exact → alias → substring → fuzzy (tokens + ventanas, threshold relativo) → fallback.
 *
 * @param {string}      rawCity      City as received from Shopify/Woo/YouCan
 * @param {object|null} mainRegion   delivery_main_region row (may include .aliases TEXT[])
 * @param {Array}       otherRegions delivery_other_regions rows
 * @returns {{ zone: object|null, matchType: 'exact'|'alias'|'substring'|'fuzzy'|'fallback', confidence: number, fee: number }}
 */
function matchDeliveryZone(rawCity, mainRegion, otherRegions) {
  const t = norm(rawCity);
  if (!t) return { zone: null, matchType: "fallback", confidence: 0, fee: 0 };

  // Lista plana [{name, zone, fee, isAlias}] para iterar una sola vez por estrategia
  // kind: 'city' (fila concreta de cities, devuelve nombre exacto), 'zone' (nombre de la región), 'alias'
  const entries = [];
  if (mainRegion) {
    const base = { ...mainRegion, _type: "main" };
    entries.push({ name: mainRegion.name, zone: base, fee: mainRegion.price ?? 0, kind: "zone" });
    for (const cs of (mainRegion.cities || [])) {
      const { name, price } = parseCity(cs);
      entries.push({ name, zone: base, fee: price ?? mainRegion.price ?? 0, kind: "city" });
    }
    for (const alias of (mainRegion.aliases || [])) {
      entries.push({ name: alias, zone: base, fee: mainRegion.price ?? 0, kind: "alias" });
    }
  }
  for (const r of (otherRegions || [])) {
    const itb = r.interurbain_price || 0;
    const base = { ...r, _type: "other" };
    entries.push({ name: r.name, zone: base, fee: (r.price ?? 0) + itb, kind: "zone" });
    for (const cs of (r.cities || [])) {
      const { name, price } = parseCity(cs);
      entries.push({ name, zone: base, fee: (price ?? r.price ?? 0) + itb, kind: "city" });
    }
    for (const alias of (r.aliases || [])) {
      entries.push({ name: alias, zone: base, fee: (r.price ?? 0) + itb, kind: "alias" });
    }
  }
  const cityOf = (e) => e.kind === "city" ? e.name : null;

  const candidates = buildCandidates(t); // tokens + ventanas + cadena completa

  // ── 1. Exact / Alias contra cualquier candidato ─────────────────────────
  for (const cand of candidates) {
    for (const e of entries) {
      if (norm(e.name) === cand) {
        return {
          zone: e.zone,
          matchType: e.kind === "alias" ? "alias" : "exact",
          confidence: 1,
          fee: e.fee,
          matchedCity: cityOf(e),
        };
      }
    }
  }

  // ── 2. Substring: nombre de zona contenido en rawCity completo ──────────
  // Útil cuando el cliente escribe la dirección entera ("pikine rue 10")
  let subBest = null;
  for (const e of entries) {
    const n = norm(e.name);
    if (n.length < 4) continue; // evita falsos positivos cortos ("yo", "ng")
    // Match por palabra completa (no en medio de otra palabra)
    const re = new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
    if (re.test(t)) {
      if (!subBest || n.length > subBest.nameLen) {
        subBest = { zone: e.zone, fee: e.fee, nameLen: n.length, matchedCity: cityOf(e) };
      }
    }
  }
  if (subBest) {
    return { zone: subBest.zone, matchType: "substring", confidence: 0.95, fee: subBest.fee, matchedCity: subBest.matchedCity };
  }

  // ── 3. Fuzzy: cada candidato vs cada zona, similitud mínima 60% ─────────
  let best = null;
  for (const cand of candidates) {
    if (cand.length < 3) continue;
    for (const e of entries) {
      const n = norm(e.name);
      if (n.length < 3) continue;

      const d = levenshtein(cand, n);
      const threshold = fuzzyThreshold(n.length);
      if (d > threshold) continue;

      const ratio = 1 - d / Math.max(n.length, cand.length);
      if (ratio < MIN_SIMILARITY) continue; // 60% mínimo

      // Anti-falso-positivo suave: si primera letra distinta, exigir mayor similitud
      if (n[0] !== cand[0] && ratio < 0.75) continue;

      if (!best || ratio > best.ratio) {
        best = { zone: e.zone, fee: e.fee, ratio, dist: d, matchedCity: cityOf(e) };
      }
    }
  }
  if (best) {
    return { zone: best.zone, matchType: "fuzzy", confidence: +best.ratio.toFixed(2), fee: best.fee, matchedCity: best.matchedCity };
  }

  // ── 4. Fallback ─────────────────────────────────────────────────────────
  return { zone: null, matchType: "fallback", confidence: 0, fee: 0, matchedCity: null };
}

module.exports = { matchDeliveryZone };
