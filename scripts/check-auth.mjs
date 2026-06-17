// Verify the authenticated read path + RLS: sign in as a coach and a student,
// print how many rows each can see. Run: node scripts/check-auth.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

async function probe(email) {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: authErr } = await sb.auth.signInWithPassword({ email, password: 'skilltree123' });
  if (authErr) { console.log(`\n${email}: ❌ login — ${authErr.message}`); return; }
  const tables = ['profiles', 'trees', 'enrollments', 'progress', 'attempts', 'messages'];
  const counts = {};
  for (const t of tables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    counts[t] = error ? `err:${error.message}` : count;
  }
  console.log(`\n${email}:`, JSON.stringify(counts));
}

await probe('mara@skilltree.app');   // coach (instructor)
await probe('alex@mail.com');        // student
