-- Simplify the interurbain (other-region) status flow from 5 to 3 progression steps.
-- Old: en_attente_paiement → paiement_confirme → colis_en_main → en_route → remis_transporteur → entregado
-- New: en_attente_paiement → paiement_confirme → remis_transporteur → entregado
--
-- Any in-flight order in colis_en_main or en_route is fast-forwarded to remis_transporteur
-- (closest equivalent — colis was already on its way to the transporter).
-- Run in Supabase SQL Editor.

UPDATE orders
   SET status = 'remis_transporteur'
 WHERE status IN ('colis_en_main', 'en_route')
   AND region_type = 'other';
