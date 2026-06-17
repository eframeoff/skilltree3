// Seed the demo into Supabase: creates auth accounts for every persona, then
// loads trees / enrollments / progress / attempts / messages. Idempotent —
// reuses existing accounts and wipes app rows (trees cascade) before reseeding.
//
//   node scripts/seed-supabase.mjs
//
// Needs the SECRET key (admin) — read from .env.seed, never shipped to the client.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { authors, students, enrollments, progressByStudent, videoSubmissions, messagesByThread } from '../src/data/users.js';
import { seedTrees } from '../src/data/trees/index.js';
import { migrateTree } from '../src/data/treeUtils.js';

const parseEnv = (rel) => Object.fromEntries(
  readFileSync(new URL(rel, import.meta.url), 'utf8')
    .split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const local = parseEnv('../.env.local');
const seed = parseEnv('../.env.seed');
const PASSWORD = 'skilltree123';

const supabase = createClient(local.VITE_SUPABASE_URL, seed.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// 1. Accounts → uuid map (reuse existing by email).
const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const byEmail = new Map(list.users.map((u) => [u.email, u.id]));
const idMap = {};
for (const u of [...authors, ...students]) {
  let uuid = byEmail.get(u.email);
  if (!uuid) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { name: u.name },
    });
    if (error) {
      console.error('createUser error detail:', JSON.stringify(error, Object.getOwnPropertyNames(error)), '| status:', error.status, '| code:', error.code);
      throw new Error(`createUser ${u.email}`);
    }
    uuid = data.user.id;
  }
  idMap[u.id] = uuid;
  await supabase.from('profiles').update({
    role: u.role, name: u.name, avatar_color: u.avatarColor, headline: u.headline ?? null,
  }).eq('id', uuid);
}
console.log(`✓ accounts: ${Object.keys(idMap).length} (password: ${PASSWORD})`);

// 2. Wipe app data — deleting trees cascades to everything tree-scoped.
await supabase.from('trees').delete().neq('id', '00000000-0000-0000-0000-000000000000');

// 3. Trees (migrated to current shape).
const treeIdMap = {};
for (const t of Object.values(seedTrees)) {
  const m = migrateTree(t);
  const { data, error } = await supabase.from('trees').insert({
    author_id: idMap[m.authorId], title: m.title, category: m.category, emoji: m.emoji,
    color: m.color, description: m.description, status: m.status, gating: m.gating,
    levels: m.levels, nodes: m.nodes, published: m.published ?? null,
  }).select('id').single();
  if (error) throw new Error(`tree ${t.id}: ${error.message}`);
  treeIdMap[t.id] = data.id;
}
console.log(`✓ trees: ${Object.keys(treeIdMap).length}`);

// 4. Enrollments.
const enr = enrollments.map((e) => ({ student_id: idMap[e.studentId], tree_id: treeIdMap[e.treeId], coach_id: idMap[e.coachId] }));
if (enr.length) { const { error } = await supabase.from('enrollments').insert(enr); if (error) throw error; }
console.log(`✓ enrollments: ${enr.length}`);

// 5. Progress facts.
const prog = [];
for (const [sid, byTree] of Object.entries(progressByStudent)) {
  for (const [tid, nodes] of Object.entries(byTree)) {
    for (const [nodeId, fact] of Object.entries(nodes)) {
      if (fact.status === 'completed' || fact.status === 'in_progress') {
        prog.push({ student_id: idMap[sid], tree_id: treeIdMap[tid], node_id: nodeId, status: fact.status, rating: fact.rating ?? null });
      }
    }
  }
}
if (prog.length) { const { error } = await supabase.from('progress').insert(prog); if (error) throw error; }
console.log(`✓ progress facts: ${prog.length}`);

// 6. Attempts.
const att = videoSubmissions.map((v) => ({
  student_id: idMap[v.studentId], tree_id: treeIdMap[v.treeId], node_id: v.nodeId,
  type: v.type, status: v.status, rating: v.rating ?? null, feedback: v.feedback ?? null,
  label: v.label ?? null, thumb: v.thumb ?? null, duration: v.duration ?? null,
  compilation_ready: !!v.compilation_ready, is_featured: !!v.is_featured,
}));
if (att.length) { const { error } = await supabase.from('attempts').insert(att); if (error) throw error; }
console.log(`✓ attempts: ${att.length}`);

// 7. Messages.
const msgs = [];
for (const [key, thread] of Object.entries(messagesByThread)) {
  const [tid, sid, nodeId] = key.split(':');
  for (const m of thread) {
    msgs.push({ tree_id: treeIdMap[tid], student_id: idMap[sid], node_id: nodeId, sender_id: idMap[m.senderId], body: m.body });
  }
}
if (msgs.length) { const { error } = await supabase.from('messages').insert(msgs); if (error) throw error; }
console.log(`✓ messages: ${msgs.length}`);

console.log('\n✅ Seed complete.');
