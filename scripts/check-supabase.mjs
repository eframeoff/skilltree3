// One-off connectivity check: reads .env.local, hits the DB, prints table counts.
// Run: node scripts/check-supabase.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { count, error } = await supabase.from('trees').select('*', { count: 'exact', head: true });
if (error) {
  console.error('❌ Supabase error:', error.message);
  process.exit(1);
}
console.log('✅ Connected. trees rows:', count ?? 0);
