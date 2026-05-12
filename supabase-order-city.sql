-- Persist client city on orders so manual & store orders both display the city
-- alongside the address in OCard and order detail.
-- Run in Supabase SQL Editor.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS city               TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_zone_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_zone_type TEXT NULL;

-- Backfill from unmatched_city for webhook orders that already have it
UPDATE orders
   SET city = unmatched_city
 WHERE city IS NULL
   AND unmatched_city IS NOT NULL
   AND length(trim(unmatched_city)) > 0;
