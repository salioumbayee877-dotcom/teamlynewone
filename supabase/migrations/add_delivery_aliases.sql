-- Migration: add aliases column to delivery zone tables for fuzzy-match auto-learning
-- Run in: Supabase Dashboard → SQL Editor

ALTER TABLE delivery_main_region
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

ALTER TABLE delivery_other_regions
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
