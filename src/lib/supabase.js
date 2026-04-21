import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://rddtislrbbkjpoqpdcry.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZHRpc2xyYmJranBvcXBkY3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzcwMDIsImV4cCI6MjA5MTkxMzAwMn0.2G6eiQyih1h3PTDbYU757hGW7ScRqHhyyqsolEO-Rzc';

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
