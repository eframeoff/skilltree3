import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { fetchAll, db, subscribeMessages } from '../data/backend.js';
import { setRegistry, usersByRole, getUser } from '../data/users.js';
import {
  enrichNodes, treeEdges, treeStats, recomputeProgress,
  createTreeDef, createNodeDef, treeSnapshot, migrateNode, wouldCycle, uid, uuid,
  isEligibleMentor, eligibleMentorLevel, nodeInScope, canDelegate,
} from '../data/treeUtils.js';

const StoreContext = createContext(null);

const THUMBS = ['#1f6feb', '#0d9488', '#7c3aed', '#b45309', '#059669', '#db2777', '#0ea5e9'];

export function StoreProvider({ children }) {
  // State is hydrated from Supabase on login (see fetchAll). Progress holds only
  // facts (completed / in_progress) — locked/available derive at read time.
  // Trees carry an undo/redo history (the builder must feel fearless); mutations
  // write through to the DB (db.*) optimistically.
  const { user } = useAuth();
  const [treeHist, setTreeHist] = useState({ present: {}, past: [], future: [] });
  const trees = treeHist.present;
  const [enrollments, setEnrollments] = useState([]);
  const [progress, setProgress] = useState({});
  const [videos, setVideos] = useState([]);
  const [messages, setMessages] = useState({});
  const [reads, setReads] = useState({}); // `${tree}:${student}` → { readerId: lastReadMs }

  // Hydrate once a user is signed in; clear on logout.
  useEffect(() => {
    if (!user) {
      setTreeHist({ present: {}, past: [], future: [] });
      setEnrollments([]); setProgress({}); setVideos([]); setMessages({}); setReads({});
      return;
    }
    let active = true;
    fetchAll().then((data) => {
      if (!active) return;
      setRegistry(data.profiles);
      setTreeHist({ present: data.trees, past: [], future: [] });
      setEnrollments(data.enrollments);
      setProgress(data.progress);
      setVideos(data.videos);
      setMessages(data.messages);
      setReads(data.reads || {});
    }).catch((e) => console.error('[store] hydrate failed:', e));
    return () => { active = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime chat: refetch messages on any insert (instant if the table is
  // replication-enabled; otherwise the MessengerScreen poll still covers it).
  useEffect(() => {
    if (!user) return undefined;
    return subscribeMessages(() => { refreshMessages(); });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTrees = useCallback((updater) => {
    setTreeHist((h) => {
      const next = typeof updater === 'function' ? updater(h.present) : updater;
      if (next === h.present) return h;
      return { present: next, past: [...h.past.slice(-49), h.present], future: [] };
    });
  }, []);
  // NOTE: undo/redo move the local present only — the DB reflects the last
  // forward edit (acceptable for the prototype builder).
  const undo = useCallback(() => setTreeHist((h) => (h.past.length
    ? { present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future] }
    : h)), []);
  const redo = useCallback(() => setTreeHist((h) => (h.future.length
    ? { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) }
    : h)), []);

  // ── progress fact helpers ─────────────────────────────────────────────────
  function setFact(studentId, treeId, nodeId, fact) {
    setProgress((prev) => {
      const byTree = { ...(prev[studentId] || {}) };
      const prog = { ...(byTree[treeId] || {}) };
      if (fact) prog[nodeId] = fact;
      else delete prog[nodeId];
      byTree[treeId] = prog;
      return { ...prev, [studentId]: byTree };
    });
    if (fact) db.upsertProgress(studentId, treeId, nodeId, fact);
    else db.deleteProgress(studentId, treeId, nodeId);
  }

  // ── learning loop actions ────────────────────────────────────────────────

  // Student passes an auto-checked theory/test node.
  function completeTest(studentId, treeId, nodeId) {
    setFact(studentId, treeId, nodeId, { status: 'completed' });
    postActivity(treeId, studentId, studentId, { kind: 'test', nodeId });
  }

  // Student uploads an attempt (mock recorder). An attempt carries `parts` —
  // one or more {kind,payload} pieces (video+text combos, embeds) — plus a
  // `createdAt` so queues can sort by wait time. `type` is kept for back-compat.
  function submitVideo(studentId, treeId, nodeId, type, parts = []) {
    const count = videos.filter(
      (v) => v.studentId === studentId && v.treeId === treeId && v.nodeId === nodeId
    ).length;
    const attempt = {
      id: uuid(),
      studentId, treeId, nodeId, type,
      status: 'pending',
      thumb: THUMBS[(count + nodeId.length) % THUMBS.length],
      label: type === 'exam' ? 'Попытка зачёта' : `Дубль ${count + 1}`,
      // Real uploaded media parts ({kind, payload:{storagePath,...}}); falls back
      // to an empty video part if a caller submits without a file.
      parts: parts.length ? parts : [{ kind: 'video', payload: {} }],
      createdAt: Date.now(),
    };
    setVideos((prev) => [...prev, attempt]);
    db.insertAttempt(attempt);
    setFact(studentId, treeId, nodeId, { status: 'in_progress' });
    postActivity(treeId, studentId, studentId, { kind: 'submit', nodeId });
  }

  // Rate an attempt's video (1–5★) — does NOT complete the node. Completion is a
  // separate, explicit coach action (markComplete) so grading ≠ зачёт.
  function acceptVideo(videoId, stars, reviewer = null, feedback = '') {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    const { id: reviewerId, role: reviewerRole } = reviewer || {};
    setVideos((prev) => prev.map((v) =>
      v.id === videoId
        ? { ...v, status: 'approved', rating: stars, reviewerId, reviewerRole,
            feedback: feedback || v.feedback, compilation_ready: true }
        : v));
    db.updateAttempt(videoId, { status: 'approved', rating: stars, reviewerId, reviewerRole, compilation_ready: true, feedback: feedback || video.feedback });
  }

  // Explicit "зачесть выполнение" — the coach marks the node passed (optionally
  // with a recorded grade). This is the only thing that completes a video node.
  function markComplete(studentId, treeId, nodeId, { rating = null, reviewer = null } = {}) {
    setFact(studentId, treeId, nodeId,
      { status: 'completed', rating: rating ?? undefined, reviewerId: reviewer?.id, provisional: reviewer?.provisional || false });
    postActivity(treeId, studentId, reviewer?.id || studentId, { kind: 'done', nodeId });
  }

  // Undo a зачёт — reopen the node.
  function clearComplete(studentId, treeId, nodeId, reviewer = null) {
    setFact(studentId, treeId, nodeId, null);
    postActivity(treeId, studentId, reviewer?.id || studentId, { kind: 'cleared', nodeId });
  }

  // A reviewer rejects an attempt with a reason: video → rejected (reason stored
  // as feedback), node reopens. The caller also posts the reason to the node chat.
  function rejectVideo(videoId, reason, reviewer = null) {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    setVideos((prev) => prev.map((v) =>
      v.id === videoId
        ? { ...v, status: 'rejected', feedback: reason, reviewerId: reviewer?.id, reviewerRole: reviewer?.role }
        : v));
    db.updateAttempt(videoId, { status: 'rejected', feedback: reason, reviewerId: reviewer?.id, reviewerRole: reviewer?.role });
    setFact(video.studentId, video.treeId, video.nodeId, null);
    postActivity(video.treeId, video.studentId, reviewer?.id || video.studentId, { kind: 'reject', nodeId: video.nodeId });
  }

  // Head coach confirms a provisional (mentor-given) grade — clears the flag on
  // both the attempt and the progress fact.
  function confirmProvisional(videoId) {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, provisional: false } : v)));
    db.updateAttempt(videoId, { provisional: false });
    setProgress((prev) => {
      const byTree = { ...(prev[video.studentId] || {}) };
      const prog = { ...(byTree[video.treeId] || {}) };
      if (prog[video.nodeId]) prog[video.nodeId] = { ...prog[video.nodeId], provisional: false };
      byTree[video.treeId] = prog;
      return { ...prev, [video.studentId]: byTree };
    });
    const fact = progress[video.studentId]?.[video.treeId]?.[video.nodeId];
    if (fact) db.upsertProgress(video.studentId, video.treeId, video.nodeId, { ...fact, provisional: false });
  }

  // Coach records an in-person (live) attestation — no upload from the student.
  // Optional photo/note parts are kept "for the record"; node → completed.
  function attestLive(studentId, treeId, nodeId, { rating = null, parts = [], reviewer = null } = {}) {
    const attempt = {
      id: uuid(),
      studentId, treeId, nodeId, type: 'live',
      status: 'approved',
      rating: rating ?? undefined,
      reviewerId: reviewer?.id,
      reviewerRole: reviewer?.role,
      label: 'Очная сдача',
      parts,
      createdAt: Date.now(),
    };
    setVideos((prev) => [...prev, attempt]);
    db.insertAttempt(attempt);
    setFact(studentId, treeId, nodeId,
      { status: 'completed', rating: rating ?? undefined, reviewerId: reviewer?.id });
    postActivity(treeId, studentId, reviewer?.id || studentId, { kind: 'done', nodeId });
  }

  function toggleCompilation(videoId) {
    const v = videos.find((x) => x.id === videoId);
    setVideos((prev) => prev.map((x) => (x.id === videoId ? { ...x, compilation_ready: !x.compilation_ready } : x)));
    if (v) db.updateAttempt(videoId, { compilation_ready: !v.compilation_ready });
  }

  // The general per-(student, tree) thread reuses the messages table under a
  // reserved node id, so it carries both free chat and activity events.
  const GENERAL = '__general__';
  const nodeTitle = (treeId, nodeId) => trees[treeId]?.nodes.find((n) => n.id === nodeId)?.title || 'навык';

  function sendMessage(treeId, studentId, nodeId, msg) {
    const key = `${treeId}:${studentId}:${nodeId}`;
    setMessages((prev) => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
    db.insertMessage(treeId, studentId, nodeId, msg);
    // A student's node question also surfaces in the general feed (a pointer).
    if (nodeId !== GENERAL && msg.kind !== 'event' && msg.senderId === studentId) {
      postActivity(treeId, studentId, studentId, { kind: 'question', nodeId });
    }
  }

  // Append an activity event to the general thread. Encoded as
  // `EVT|<kind>|<nodeId>|<title>` so the chat can render a clickable node chip.
  // The actor must be a real profile (FK).
  function postActivity(treeId, studentId, actorId, evt) {
    if (!actorId) return;
    const body = `EVT|${evt.kind}|${evt.nodeId || ''}|${nodeTitle(treeId, evt.nodeId)}`;
    sendMessage(treeId, studentId, GENERAL, {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: actorId, name: (getUser(actorId)?.name || '').split(' ')[0], body,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kind: 'event',
    });
  }

  // Re-pull messages + read-markers (cheap near-live chat without realtime infra).
  async function refreshMessages() {
    const [rows, rd] = await Promise.all([db.fetchMessages(), db.fetchReads()]);
    const next = {};
    for (const r of rows) {
      const key = `${r.tree_id}:${r.student_id}:${r.node_id}`;
      (next[key] ||= []).push({
        id: r.id, senderId: r.sender_id,
        name: (getUser(r.sender_id)?.name || '').split(' ')[0], body: r.body,
        at: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        ts: r.created_at ? new Date(r.created_at).getTime() : 0, edited: !!r.edited,
      });
    }
    setMessages(next);
    setReads(rd || {});
  }

  // Mark the current user as having read a thread up to now (→ ✓✓ for the sender).
  function markChatRead(treeId, studentId) {
    if (!user) return;
    const k = `${treeId}:${studentId}`;
    setReads((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), [user.id]: Date.now() } }));
    db.markRead(treeId, studentId, user.id);
  }

  // Edit a message in the general thread (own messages only — enforced in UI).
  function editGeneral(treeId, studentId, messageId, body) {
    const key = `${treeId}:${studentId}:${GENERAL}`;
    setMessages((prev) => ({ ...prev, [key]: (prev[key] || []).map((m) => (m.id === messageId ? { ...m, body, edited: true } : m)) }));
    db.updateMessage(messageId, body);
  }

  // ── enrollment ───────────────────────────────────────────────────────────
  function enroll(studentId, treeId) {
    if (enrollments.some((e) => e.studentId === studentId && e.treeId === treeId)) return;
    const coachId = trees[treeId]?.authorId;
    setEnrollments((prev) => [...prev, { studentId, treeId, coachId }]);
    db.insertEnrollment({ studentId, treeId, coachId });
  }

  // Reviewers beyond the primary coach: co-coaches / student-mentors with a
  // scope (Phase 5). `coachId` stays the primary reviewer for back-compat.
  function addReviewer(studentId, treeId, reviewer) {
    setEnrollments((prev) => prev.map((e) =>
      e.studentId === studentId && e.treeId === treeId
        ? { ...e, reviewers: [...(e.reviewers || []).filter((r) => r.userId !== reviewer.userId), reviewer] }
        : e));
  }
  function removeReviewer(studentId, treeId, userId) {
    setEnrollments((prev) => prev.map((e) =>
      e.studentId === studentId && e.treeId === treeId
        ? { ...e, reviewers: (e.reviewers || []).filter((r) => r.userId !== userId) }
        : e));
  }

  // ── no-code tree builder actions ─────────────────────────────────────────
  // Every tree edit writes the whole row through to the DB (mentors/collaborators
  // live in their own tables and are handled by their actions).
  const patchTree = (treeId, fn) =>
    setTrees((prev) => {
      if (!prev[treeId]) return prev;
      const nextTree = fn(prev[treeId]);
      db.saveTree(nextTree);
      return { ...prev, [treeId]: nextTree };
    });

  function createTree(authorId) {
    const def = { ...createTreeDef(authorId), id: uuid() };
    setTrees((prev) => ({ ...prev, [def.id]: def }));
    db.saveTree(def);
    return def.id;
  }

  const updateTree = (treeId, patch) => patchTree(treeId, (t) => ({ ...t, ...patch }));

  // Delete a tree with everything attached to it (enrollments, progress,
  // videos, node chats). Irreversible — the UI must confirm first.
  function deleteTree(treeId) {
    setTrees((prev) => {
      const next = { ...prev };
      delete next[treeId];
      return next;
    });
    setEnrollments((prev) => prev.filter((e) => e.treeId !== treeId));
    setProgress((prev) => {
      const next = {};
      for (const sid of Object.keys(prev)) {
        const { [treeId]: _removed, ...rest } = prev[sid];
        next[sid] = rest;
      }
      return next;
    });
    setVideos((prev) => prev.filter((v) => v.treeId !== treeId));
    setMessages((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${treeId}:`))));
    db.deleteTree(treeId); // FK cascade clears enrollments/progress/attempts/messages
  }

  function addNode(treeId, opts = {}) {
    const node = createNodeDef(opts);
    patchTree(treeId, (t) => ({ ...t, nodes: [...t.nodes, node] }));
    return node.id;
  }

  // Seed an empty tree from a template / imported skill list (onboarding).
  function seedTreeContent(treeId, { levels, nodes }) {
    patchTree(treeId, (t) => ({
      ...t,
      levels: levels && levels.length ? levels : t.levels,
      nodes: (nodes || []).map(migrateNode),
    }));
  }

  const updateNode = (treeId, nodeId, patch) =>
    patchTree(treeId, (t) => ({
      ...t,
      nodes: t.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    }));

  // Clone a node with all its config (teach/submit/grade/delegation), offset so
  // it doesn't overlap, keeping the same prerequisites as a sibling.
  function duplicateNode(treeId, nodeId) {
    let newId = null;
    patchTree(treeId, (t) => {
      const n = t.nodes.find((x) => x.id === nodeId);
      if (!n) return t;
      newId = uid('node');
      const copy = { ...JSON.parse(JSON.stringify(n)), id: newId, x: n.x + 48, y: n.y + 48, title: `${n.title} (копия)` };
      return { ...t, nodes: [...t.nodes, copy] };
    });
    return newId;
  }

  // Delete the node and strip it from other nodes' prerequisites.
  const deleteNode = (treeId, nodeId) =>
    patchTree(treeId, (t) => ({
      ...t,
      nodes: t.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => (n.prereqs.includes(nodeId)
          ? { ...n, prereqs: n.prereqs.filter((p) => p !== nodeId) }
          : n)),
    }));

  // Toggle the prerequisite edge from → to. Returns false if it would cycle.
  function toggleEdge(treeId, fromId, toId) {
    const tree = trees[treeId];
    if (!tree || fromId === toId) return false;
    const target = tree.nodes.find((n) => n.id === toId);
    if (!target) return false;
    if (!target.prereqs.includes(fromId) && wouldCycle(tree, fromId, toId)) return false;
    patchTree(treeId, (t) => ({
      ...t,
      nodes: t.nodes.map((n) =>
        n.id !== toId ? n : {
          ...n,
          prereqs: n.prereqs.includes(fromId)
            ? n.prereqs.filter((p) => p !== fromId)
            : [...n.prereqs, fromId],
        }),
    }));
    return true;
  }

  const addLevel = (treeId) =>
    patchTree(treeId, (t) => {
      const next = Math.max(0, ...t.levels.map((l) => l.level)) + 1;
      const palette = ['#36C26E', '#FFB020', '#2DD4FF', '#7C5CFF', '#FF4D6D', '#FFD23F'];
      return {
        ...t,
        levels: [...t.levels, { level: next, label: `УРОВЕНЬ ${next}`, color: palette[(next - 1) % palette.length] }],
      };
    });

  const updateLevel = (treeId, level, patch) =>
    patchTree(treeId, (t) => ({
      ...t,
      levels: t.levels.map((l) => (l.level === level ? { ...l, ...patch } : l)),
    }));

  // Snapshot the current draft into `published` (Phase 6 cuts the student read
  // path over to this; for now it records the snapshot for safe rollouts).
  function publishTreeUpdate(treeId) {
    patchTree(treeId, (t) => ({ ...t, status: 'published', published: treeSnapshot(t) }));
  }

  // Student-mentors on a tree (Phase 5): granted by the coach to eligible
  // learners, scoped (e.g. { maxLevel }) to cap what they can review.
  function grantMentor(treeId, userId, scope = null) {
    patchTree(treeId, (t) => ({
      ...t,
      mentors: [...(t.mentors || []).filter((m) => m.userId !== userId), { userId, scope, since: Date.now() }],
    }));
    db.upsertMentor(treeId, userId, scope);
  }
  function revokeMentor(treeId, userId) {
    patchTree(treeId, (t) => ({ ...t, mentors: (t.mentors || []).filter((m) => m.userId !== userId) }));
    db.deleteMentor(treeId, userId);
  }

  // Co-authors / co-coaches on a tree (Phase 6).
  function addCollaborator(treeId, collaborator) {
    patchTree(treeId, (t) => ({
      ...t,
      collaborators: [...(t.collaborators || []).filter((c) => c.userId !== collaborator.userId), collaborator],
    }));
    db.upsertCollaborator(treeId, collaborator);
  }
  function removeCollaborator(treeId, userId) {
    patchTree(treeId, (t) => ({
      ...t,
      collaborators: (t.collaborators || []).filter((c) => c.userId !== userId),
    }));
    db.deleteCollaborator(treeId, userId);
  }

  // ── read API ─────────────────────────────────────────────────────────────
  const value = useMemo(() => {
    const progFor = (sid, tid) => progress[sid]?.[tid] || {};
    const tree = (tid) => trees[tid] || null;
    // What a STUDENT sees: the published snapshot (levels/nodes/gating), not the
    // coach's live draft. Falls back to the draft for unpublished trees.
    const publishedView = (t) =>
      t && t.published ? { ...t, levels: t.published.levels, nodes: t.published.nodes, gating: t.published.gating } : t;
    const videosFor = (sid, tid, nid) =>
      videos.filter((v) =>
        v.studentId === sid && (!tid || v.treeId === tid) && (!nid || v.nodeId === nid));
    const enrollmentsOf = (sid) => enrollments.filter((e) => e.studentId === sid);
    const coachEnrollments = (coachId) => enrollments.filter((e) => e.coachId === coachId);
    // Everyone who may review this enrollment: primary coach + extra reviewers.
    const reviewersOf = (e) => [
      { userId: e.coachId, role: 'coach', scope: null },
      ...(e.reviewers || []),
    ].filter((r) => r.userId);
    const reviewerEnrollments = (userId) =>
      enrollments.filter((e) => reviewersOf(e).some((r) => r.userId === userId));

    return {
      trees,
      tree,
      treeList: () => Object.values(trees),
      publishedTrees: () => Object.values(trees).filter((t) => t.status === 'published'),
      myTrees: (authorId) => Object.values(trees).filter(
        (t) => t.authorId === authorId || (t.collaborators || []).some((c) => c.userId === authorId)),
      // People who can be added as co-authors: other instructors + enrolled
      // students (promote a star learner), minus the author and current ones.
      coAuthorCandidates: (tid) => {
        const t = trees[tid];
        if (!t) return [];
        const taken = new Set([t.authorId, ...(t.collaborators || []).map((c) => c.userId)]);
        const pool = [...usersByRole('instructor').map((a) => a.id), ...enrollments.filter((e) => e.treeId === tid).map((e) => e.studentId)];
        return [...new Set(pool)].filter((id) => !taken.has(id)).map((id) => getUser(id)).filter(Boolean);
      },

      enrollments,
      enrollmentsOf,
      isEnrolled: (sid, tid) => enrollments.some((e) => e.studentId === sid && e.treeId === tid),
      studentsOnTree: (tid) => enrollments.filter((e) => e.treeId === tid).map((e) => getUser(e.studentId)),
      // Coach's roster: one entry per (student, tree) pair.
      coachRoster: (coachId) =>
        coachEnrollments(coachId).map((e) => ({
          enrollment: e,
          student: getUser(e.studentId),
          tree: trees[e.treeId],
        })).filter((r) => r.student && r.tree),

      // Student-facing reads go through the published snapshot.
      viewTree: (tid) => publishedView(trees[tid]) || null,
      nodesFor: (sid, tid) => (trees[tid] ? enrichNodes(publishedView(trees[tid]), progFor(sid, tid)) : []),
      nodeOf: (tid, nid) => publishedView(trees[tid])?.nodes.find((n) => n.id === nid) || null,
      edgesOf: (tid) => (trees[tid] ? treeEdges(publishedView(trees[tid])) : []),
      stats: (sid, tid) =>
        trees[tid] ? treeStats(publishedView(trees[tid]), progFor(sid, tid), videos, sid) : null,
      derivedProgress: (sid, tid) =>
        trees[tid] ? recomputeProgress(publishedView(trees[tid]), progFor(sid, tid)) : {},
      // Impact of publishing the current draft over the live snapshot.
      publishImpact: (tid) => {
        const t = trees[tid];
        if (!t || !t.published) return { added: 0, removed: 0, affected: 0 };
        const draftIds = new Set(t.nodes.map((n) => n.id));
        const pubIds = new Set(t.published.nodes.map((n) => n.id));
        const added = [...draftIds].filter((id) => !pubIds.has(id)).length;
        const removedIds = [...pubIds].filter((id) => !draftIds.has(id));
        const studentIds = enrollments.filter((e) => e.treeId === tid).map((e) => e.studentId);
        const affected = studentIds.filter((sid) =>
          removedIds.some((id) => progress[sid]?.[tid]?.[id]?.status === 'completed')).length;
        return { added, removed: removedIds.length, affected };
      },

      videos,
      videosFor,
      reviewersOf: (sid, tid) => {
        const e = enrollments.find((x) => x.studentId === sid && x.treeId === tid);
        return e ? reviewersOf(e) : [];
      },

      // ── Mentors (Phase 5) ───────────────────────────────────────────────────
      mentorsOf: (tid) => trees[tid]?.mentors || [],
      isMentor: (userId) => Object.values(trees).some((t) => (t.mentors || []).some((m) => m.userId === userId)),
      // Per-(student, tree) candidacy + current role, for the coach's grant button.
      mentorInfo: (sid, tid) => {
        const t = trees[tid];
        if (!t) return { eligible: false, level: 0, isMentor: false };
        const p = progFor(sid, tid);
        return {
          eligible: isEligibleMentor(t, p),
          level: eligibleMentorLevel(t, p),
          isMentor: (t.mentors || []).some((m) => m.userId === sid),
        };
      },
      // Live (in-person) attestations awaiting the coach: unlocked, not-yet-passed
      // 'live' nodes across the coach's students.
      liveDue: (coachId) => {
        const out = [];
        for (const e of enrollments.filter((x) => x.coachId === coachId)) {
          const t = publishedView(trees[e.treeId]);
          if (!t) continue;
          const enriched = enrichNodes(t, progFor(e.studentId, e.treeId));
          for (const n of enriched) {
            if ((n.submit?.kinds || []).includes('live') && (n.status === 'available' || n.status === 'in_progress')) {
              out.push({ studentId: e.studentId, treeId: e.treeId, node: n });
            }
          }
        }
        return out;
      },
      // A mentor's review queue: pending, delegable, in-scope, never their own.
      videosForMentor: (userId) => {
        const out = [];
        for (const t of Object.values(trees)) {
          const grant = (t.mentors || []).find((m) => m.userId === userId);
          if (!grant) continue;
          for (const v of videos) {
            if (v.treeId !== t.id || v.status !== 'pending' || v.studentId === userId) continue;
            const node = t.nodes.find((n) => n.id === v.nodeId);
            if (node && canDelegate(node) && nodeInScope(node, grant.scope)) out.push(v);
          }
        }
        return out;
      },
      // Review queue for any reviewer (head coach, co-coach or student-mentor).
      videosForCoach: (reviewerId) => {
        const keys = new Set(reviewerEnrollments(reviewerId).map((e) => `${e.studentId}:${e.treeId}`));
        return videos.filter((v) => keys.has(`${v.studentId}:${v.treeId}`));
      },
      messagesFor: (tid, sid, nid) => messages[`${tid}:${sid}:${nid}`] || [],
      generalMessages: (tid, sid) => messages[`${tid}:${sid}:${GENERAL}`] || [],
      sendGeneral: (tid, sid, msg) => sendMessage(tid, sid, GENERAL, msg),
      refreshMessages,
      markChatRead,
      editGeneral,
      chatReads: (tid, sid) => reads[`${tid}:${sid}`] || {},
      // Chat conversations for a user (coach → per student×tree, student → per
      // tree), each with its general-thread message count (for unread badges).
      chatThreads: (u) => {
        if (!u) return [];
        const list = u.role === 'instructor'
          ? enrollments.filter((e) => e.coachId === u.id).map((e) => ({ key: `${e.studentId}:${e.treeId}`, studentId: e.studentId, treeId: e.treeId }))
          : enrollments.filter((e) => e.studentId === u.id).map((e) => ({ key: `${e.treeId}`, studentId: u.id, treeId: e.treeId }));
        return list.map((c) => ({ ...c, count: (messages[`${c.treeId}:${c.studentId}:${GENERAL}`] || []).length }));
      },

      completeTest, submitVideo, acceptVideo, markComplete, clearComplete, rejectVideo, attestLive, confirmProvisional, toggleCompilation, sendMessage,
      enroll, addReviewer, removeReviewer, grantMentor, revokeMentor,
      createTree, updateTree, deleteTree, addNode, updateNode, deleteNode, duplicateNode, seedTreeContent, toggleEdge, addLevel, updateLevel,
      publishTreeUpdate, addCollaborator, removeCollaborator,
      undo, redo, canUndo: treeHist.past.length > 0, canRedo: treeHist.future.length > 0,

      allStudents: usersByRole('student'),
    };
  }, [trees, enrollments, progress, videos, messages, reads]); // eslint-disable-line react-hooks/exhaustive-deps

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
