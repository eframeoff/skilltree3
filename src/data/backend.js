// Supabase data layer — the single seam between StoreContext and the DB
// (see docs/db/integration.md). `fetchAll` hydrates the in-memory store after
// login; the `db.*` helpers are fire-and-forget write-through (optimistic local
// update happens in the store, the DB catches up). RLS decides what each user
// can read/write, so these queries are intentionally unfiltered.
import { supabase } from './supabase.js';
import { migrateTree } from './treeUtils.js';

const logErr = (label) => ({ error }) => { if (error) console.error(`[backend] ${label}:`, error.message); };
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

const rowToVideo = (r) => ({
  id: r.id, studentId: r.student_id, treeId: r.tree_id, nodeId: r.node_id,
  type: r.type, status: r.status,
  rating: r.rating ?? undefined, reviewerId: r.reviewer_id ?? undefined, reviewerRole: r.reviewer_role ?? undefined,
  provisional: r.provisional, label: r.label, thumb: r.thumb, duration: r.duration,
  feedback: r.feedback ?? undefined, parts: r.parts || [],
  compilation_ready: r.compilation_ready, is_featured: r.is_featured,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

const videoToRow = (v) => ({
  id: v.id, student_id: v.studentId, tree_id: v.treeId, node_id: v.nodeId,
  type: v.type, status: v.status, rating: v.rating ?? null,
  reviewer_id: v.reviewerId ?? null, reviewer_role: v.reviewerRole ?? null,
  provisional: !!v.provisional, label: v.label ?? null, thumb: v.thumb ?? null,
  duration: v.duration ?? null, feedback: v.feedback ?? null, parts: v.parts || [],
  compilation_ready: !!v.compilation_ready, is_featured: !!v.is_featured,
  created_at: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
});

const treeToRow = (t) => ({
  id: t.id, author_id: t.authorId, title: t.title, category: t.category, emoji: t.emoji,
  color: t.color, description: t.description, status: t.status, gating: t.gating,
  tags: t.tags || [], levels: t.levels, nodes: t.nodes, published: t.published ?? null,
});

// Map a known camelCase attempt patch to snake-case row columns.
const VIDEO_COLS = { status: 'status', rating: 'rating', reviewerId: 'reviewer_id', reviewerRole: 'reviewer_role', provisional: 'provisional', feedback: 'feedback', compilation_ready: 'compilation_ready', is_featured: 'is_featured' };
const videoPatchToRow = (patch) => {
  const row = {};
  for (const [k, v] of Object.entries(patch)) if (k in VIDEO_COLS) row[VIDEO_COLS[k]] = v ?? null;
  return row;
};

export async function fetchAll() {
  const [pf, tr, col, men, en, rev, pr, at, ms, cr] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('trees').select('*'),
    supabase.from('tree_collaborators').select('*'),
    supabase.from('tree_mentors').select('*'),
    supabase.from('enrollments').select('*'),
    supabase.from('enrollment_reviewers').select('*'),
    supabase.from('progress').select('*'),
    supabase.from('attempts').select('*'),
    supabase.from('messages').select('*').order('created_at', { ascending: true }),
    supabase.from('chat_reads').select('*'),
  ]);

  const profiles = (pf.data || []).map((p) => ({
    id: p.id, role: p.role, name: p.name, email: p.email, avatarColor: p.avatar_color, headline: p.headline,
  }));
  const profName = Object.fromEntries(profiles.map((p) => [p.id, p.name]));

  const collabBy = {}; for (const c of col.data || []) (collabBy[c.tree_id] ||= []).push({ userId: c.user_id, role: c.role });
  const mentorBy = {}; for (const m of men.data || []) (mentorBy[m.tree_id] ||= []).push({ userId: m.user_id, scope: m.scope, since: m.since });

  const trees = {};
  for (const r of tr.data || []) {
    trees[r.id] = migrateTree({
      id: r.id, authorId: r.author_id, title: r.title, category: r.category, emoji: r.emoji,
      color: r.color, description: r.description, status: r.status, gating: r.gating,
      tags: r.tags || [], levels: r.levels || [], nodes: r.nodes || [], published: r.published,
      collaborators: collabBy[r.id] || [], mentors: mentorBy[r.id] || [],
    });
  }

  const revBy = {}; for (const r of rev.data || []) (revBy[r.enrollment_id] ||= []).push({ userId: r.user_id, role: r.role, scope: r.scope });
  const enrollments = (en.data || []).map((e) => ({
    id: e.id, studentId: e.student_id, treeId: e.tree_id, coachId: e.coach_id, reviewers: revBy[e.id] || [],
  }));

  const progress = {};
  for (const r of pr.data || []) {
    ((progress[r.student_id] ||= {})[r.tree_id] ||= {})[r.node_id] =
      { status: r.status, rating: r.rating ?? undefined, reviewerId: r.reviewer_id ?? undefined, provisional: r.provisional };
  }

  const videos = (at.data || []).map(rowToVideo);

  const messages = {};
  for (const r of ms.data || []) {
    const key = `${r.tree_id}:${r.student_id}:${r.node_id}`;
    (messages[key] ||= []).push({
      id: r.id, senderId: r.sender_id, name: (profName[r.sender_id] || '').split(' ')[0],
      body: r.body, at: hhmm(r.created_at), ts: r.created_at ? new Date(r.created_at).getTime() : 0, edited: !!r.edited,
    });
  }

  const reads = mapReads(cr.data);

  return { profiles, trees, enrollments, progress, videos, messages, reads };
}

// chat_reads rows → { `${treeId}:${studentId}`: { readerId: lastReadMs } }
function mapReads(rows) {
  const reads = {};
  for (const r of rows || []) {
    (reads[`${r.tree_id}:${r.student_id}`] ||= {})[r.reader_id] = r.last_read ? new Date(r.last_read).getTime() : 0;
  }
  return reads;
}
export { mapReads };

// Realtime: fire `onChange` on any message insert. No-ops gracefully if the
// `messages` table isn't enabled for replication (polling still covers it).
export function subscribeMessages(onChange) {
  const channel = supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export const db = {
  saveTree: (t) => supabase.from('trees').upsert(treeToRow(t)).then(logErr('saveTree')),
  deleteTree: (id) => supabase.from('trees').delete().eq('id', id).then(logErr('deleteTree')),

  upsertProgress: (sid, tid, nid, fact) => supabase.from('progress').upsert({
    student_id: sid, tree_id: tid, node_id: nid, status: fact.status,
    rating: fact.rating ?? null, reviewer_id: fact.reviewerId ?? null, provisional: !!fact.provisional,
  }).then(logErr('upsertProgress')),
  deleteProgress: (sid, tid, nid) => supabase.from('progress').delete().match({ student_id: sid, tree_id: tid, node_id: nid }).then(logErr('deleteProgress')),

  insertAttempt: (v) => supabase.from('attempts').insert(videoToRow(v)).then(logErr('insertAttempt')),
  updateAttempt: (id, patch) => supabase.from('attempts').update(videoPatchToRow(patch)).eq('id', id).then(logErr('updateAttempt')),

  insertEnrollment: (e) => supabase.from('enrollments').insert({ student_id: e.studentId, tree_id: e.treeId, coach_id: e.coachId }).then(logErr('insertEnrollment')),
  insertMessage: (treeId, studentId, nodeId, m) => supabase.from('messages').insert({ tree_id: treeId, student_id: studentId, node_id: nodeId, sender_id: m.senderId, body: m.body }).then(logErr('insertMessage')),
  updateMessage: (id, body) => supabase.from('messages').update({ body, edited: true }).eq('id', id).then(logErr('updateMessage')),
  fetchMessages: () => supabase.from('messages').select('*').order('created_at', { ascending: true }).then(({ data }) => data || []),
  fetchReads: () => supabase.from('chat_reads').select('*').then(({ data }) => mapReads(data)),
  markRead: (treeId, studentId, readerId) => supabase.from('chat_reads')
    .upsert({ tree_id: treeId, student_id: studentId, reader_id: readerId, last_read: new Date().toISOString() })
    .then(logErr('markRead')),

  upsertMentor: (treeId, userId, scope) => supabase.from('tree_mentors').upsert({ tree_id: treeId, user_id: userId, scope }).then(logErr('upsertMentor')),
  deleteMentor: (treeId, userId) => supabase.from('tree_mentors').delete().match({ tree_id: treeId, user_id: userId }).then(logErr('deleteMentor')),
  upsertCollaborator: (treeId, c) => supabase.from('tree_collaborators').upsert({ tree_id: treeId, user_id: c.userId, role: c.role }).then(logErr('upsertCollaborator')),
  deleteCollaborator: (treeId, userId) => supabase.from('tree_collaborators').delete().match({ tree_id: treeId, user_id: userId }).then(logErr('deleteCollaborator')),
};
