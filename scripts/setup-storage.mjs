// Create the private 'attempts' Storage bucket (idempotent). Uses the admin
// (secret) key from .env.seed. Run: node scripts/setup-storage.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const parseEnv = (rel) => Object.fromEntries(
  readFileSync(new URL(rel, import.meta.url), 'utf8')
    .split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const local = parseEnv('../.env.local');
const seed = parseEnv('../.env.seed');
const supabase = createClient(local.VITE_SUPABASE_URL, seed.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { error } = await supabase.storage.createBucket('attempts', {
  public: false,
  fileSizeLimit: '50MB',
});
if (error && !/already exists/i.test(error.message)) {
  console.error('❌ createBucket:', error.message);
  process.exit(1);
}

// Ensure settings (even if the bucket already existed): allow ANY file type so
// coaches can attach docs/text/etc. to a guide; keep the 50MB cap.
const { error: upErr } = await supabase.storage.updateBucket('attempts', {
  public: false,
  fileSizeLimit: '50MB',
  allowedMimeTypes: null, // null = no mime restriction
});
if (upErr) { console.error('❌ updateBucket:', upErr.message); process.exit(1); }
console.log('✅ bucket "attempts" ready (private, 50MB, any file type)');
