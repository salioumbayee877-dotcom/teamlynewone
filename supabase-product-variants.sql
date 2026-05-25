-- ============================================================
-- Teamly — Variantes de producto (tallas, colores, matière, etc.)
-- ============================================================
-- Estructura JSONB:
-- {
--   "axes": ["Couleur", "Taille"],
--   "values": [
--     { "axes": { "Couleur": "Rouge", "Taille": "M" }, "stock": 12, "sku": "ABC-R-M" },
--     { "axes": { "Couleur": "Bleu",  "Taille": "L" }, "stock": 5  }
--   ]
-- }

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT NULL;

-- Index GIN para búsquedas dentro del JSON (match webhook futuro)
CREATE INDEX IF NOT EXISTS products_variants_gin_idx ON products USING gin (variants);

NOTIFY pgrst, 'reload schema';
