import { createClient } from '@supabase/supabase-js';

// Client-safe: the publishable/anon key is meant for the browser; access is
// enforced by Postgres RLS (see docs/db/schema.sql). Config lives in .env.local.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Fail loud in dev rather than silently running against nothing.
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — check .env.local');
}

export const supabase = createClient(url, key);
