import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DB usa snake_case → React usa camelCase
export const fromDb = (row) => row ? {
  ...row,
  prodId:   row.prod_id   ?? row.prodId,
  adSpend:  row.ad_spend  ?? row.adSpend,
  isBundle: row.is_bundle ?? row.isBundle,
} : row;

// React camelCase → DB snake_case
export const toDb = ({ prodId, adSpend, isBundle, ...rest }) => ({
  ...rest,
  prod_id:   prodId,
  ad_spend:  adSpend,
  is_bundle: isBundle,
});
