-- Frais de transport interurbain porté par chaque commande.
-- Pour les commandes hors zone principale (region_type='other'), ce montant
-- (la casilla "Frais transport interurbain" de la zone) s'AJOUTE au prix
-- produit pour donner le total que le client doit payer. La livraison locale
-- est déjà incluse dans le prix produit, donc elle ne s'ajoute pas.
-- Commandes zone principale : interurbain_fee = 0.
--
-- À exécuter manuellement dans Supabase → SQL Editor. Additif, non destructif.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS interurbain_fee integer DEFAULT 0;
