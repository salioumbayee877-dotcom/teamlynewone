-- Add pinned_at timestamp to sort pinned orders by the moment they were pinned.
-- Run in Supabase SQL Editor.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL;

-- Backfill: existing pinned rows get a deterministic timestamp so they keep showing
UPDATE orders SET pinned_at = COALESCE(updated_at, created_at, NOW())
 WHERE pinned = true AND pinned_at IS NULL;
