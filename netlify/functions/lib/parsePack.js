// Detecta pack_quantity desde el título de variante o nombre del producto.
// Devuelve { packQuantity, ambiguous } — ambiguous=true cuando el texto
// huele a pack/lot/combo pero no tiene número (caso fallback para pop-up).

const PACK_REGEXES = [
  /\bpack\s*(?:de|of)?\s*(\d+)\b/i,           // "Pack de 3", "Pack 3", "Pack of 3"
  /\blot\s*(?:de)?\s*(\d+)\b/i,                // "Lot de 5"
  /\bbundle\s*(?:de|of)?\s*(\d+)\b/i,          // "Bundle of 3"
  /\bcombo\s*(?:de)?\s*(\d+)\b/i,              // "Combo de 2"
  /\bduo\b/i,                                  // "Duo" → 2 (manejo abajo)
  /\btrio\b/i,                                 // "Trio" → 3
  /\b(\d+)\s*(?:unit[ée]s?|unidades|pcs|pi[èe]ces?|pack)\b/i, // "3 unités", "5 pcs"
  /(?:^|\s|[-_*])x\s*(\d+)\b/i,                // "x2", "X3", "* x 5"
  /(?:^|\s|[-_*])(\d+)\s*x\b/i,                // "3x", "2 X"
];

const AMBIGUOUS_HINTS = /\b(pack|lot|bundle|combo|famille|family|familial|familiale)\b/i;

function parsePackQuantity(...texts) {
  const joined = texts.filter(Boolean).join(" ");
  if (!joined) return { packQuantity: 1, ambiguous: false };

  // 1. Casos literales (duo/trio)
  if (/\bduo\b/i.test(joined))  return { packQuantity: 2, ambiguous: false };
  if (/\btrio\b/i.test(joined)) return { packQuantity: 3, ambiguous: false };

  // 2. Regex con captura numérica
  for (const re of PACK_REGEXES) {
    const m = joined.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n > 1 && n <= 100) return { packQuantity: n, ambiguous: false };
    }
  }

  // 3. Sin match numérico pero contiene palabra sospechosa → ambiguous
  if (AMBIGUOUS_HINTS.test(joined)) {
    return { packQuantity: 1, ambiguous: true };
  }

  return { packQuantity: 1, ambiguous: false };
}

module.exports = { parsePackQuantity };
