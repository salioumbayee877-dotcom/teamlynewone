-- Interurbain (other-region) status flow — 6 progression steps.
-- Flow: en_attente_paiement → paiement_confirme → livreur_en_route → colis_en_main → remis_transporteur → entregado
-- The legacy `en_route` status is dropped — any in-flight order in en_route is bumped to remis_transporteur.
-- Applies to both manual and store (Shopify/Woo/YouCan) orders since both share region_type='other'.
-- Run in Supabase SQL Editor.

UPDATE orders
   SET status = 'remis_transporteur'
 WHERE status = 'en_route'
   AND region_type = 'other';
