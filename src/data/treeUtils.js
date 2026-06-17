// =============================================================================
// Pure helpers over a TREE DEFINITION + per-student progress map.
// A tree definition is a plain serializable object (what the no-code builder
// edits and what the future API will store):
//
//   {
//     id, title, category, emoji, color, description,
//     authorId, status: 'draft' | 'published',
//     levels: [{ level, label, color }],
//     nodes:  [{ id, type, title, level, x, y, prereqs: [ids],
//                description, steps?: [..], quiz?: [{q, options, answer}],
//                optional?: bool }],
//   }
//
// Node type → pass criterion: 'test' (auto-checked quiz/theory) ·
// 'practice' (video draft, coach approves) · 'exam' (video, graded 1–5★).
// =============================================================================

export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

// RFC4122 v4 id for DB rows (tree / attempt ids are Postgres uuid columns).
// crypto.randomUUID needs a secure context (https / localhost); fall back so a
// LAN-IP dev server or older browser still works.
export const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint8Array(16))
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h.slice(10).join('')}`;
};

export const LEVEL_PALETTE = ['#36C26E', '#FFB020', '#2DD4FF', '#7C5CFF', '#FF4D6D', '#FFD23F'];
export const levelColor = (i) => LEVEL_PALETTE[i % LEVEL_PALETTE.length];

export const TYPE_LABEL = { test: 'Теория / тест', practice: 'Практика', exam: 'Зачёт' };
export const PASS_LABEL = {
  test: 'Автотест: проходится в приложении',
  practice: 'Видео практики: тренер принимает с оценкой 1–5★',
  exam: 'Видео-экзамен: оценка 1–5★',
};

// ── Node axes: teach / submit / grade / delegation ───────────────────────────
// The legacy single `type` (test|practice|exam) is being split into independent
// axes so any coach can mix teaching format, accepted submission and grading.
// `migrateNode` derives the axes from a legacy node and is idempotent; `type` is
// kept as a derived back-compat field while screens are ported (Phase 1).

export const SUBMIT_KINDS = ['video', 'photo', 'text', 'audio', 'file', 'live', 'none'];
export const GRADE_MODES = ['auto-quiz', 'pass-fail', 'stars-5', 'rubric'];

// Visual size tier — chosen at creation, independent of grading. Px drives the
// node footprint; shape still comes from the grading axis (see shapeKey).
export const NODE_SIZES = ['small', 'medium', 'large', 'epic'];
export const NODE_SIZE_LABELS = { small: 'Малый', medium: 'Средний', large: 'Большой', epic: 'Эпический' };
export const NODE_SIZE_PX = { small: 58, medium: 90, large: 110, epic: 140 };
export const nodeSize = (node) =>
  node.size || (node.type === 'test' ? 'small' : node.type === 'exam' ? 'large' : 'medium');

// Derive teaching blocks from a legacy node (no real instruction media existed
// yet, so only authored step text carries over).
function deriveTeachBlocks(node) {
  if (Array.isArray(node.teach?.blocks)) return node.teach.blocks;
  return node.steps?.length ? [{ kind: 'text', payload: node.steps.join('\n') }] : [];
}

export function migrateNode(node) {
  if (node.grade && node.submit && node.delegation) return node; // already migrated
  const type = node.type || 'practice';
  const isAuto = type === 'test';
  const checkpoint = node.checkpoint ?? type === 'exam';
  return {
    ...node,
    type,                                   // kept for back-compat (derived)
    size: node.size || (type === 'test' ? 'small' : type === 'exam' ? 'large' : 'medium'),
    checkpoint,
    teach: { blocks: deriveTeachBlocks(node) },
    submit: { kinds: isAuto ? ['none'] : ['video'], min: 1 },
    grade: {
      mode: isAuto ? (node.quiz?.length ? 'auto-quiz' : 'pass-fail') : 'stars-5',
      quiz: node.quiz,
    },
    delegation: { delegable: false, mode: checkpoint ? 'provisional' : 'final' },
  };
}

export const migrateTree = (tree) => {
  const t = {
    collaborators: [],   // [{ userId, role: 'co-author' | 'co-coach' }]
    mentors: [],         // [{ userId, scope: { maxLevel } | null, since }]
    gating: 'levels',    // 'levels' (sequential) | 'graph' (prereqs only)
    tags: [],            // catalog hashtags set by the coach
    ...tree,
    nodes: tree.nodes.map(migrateNode),
  };
  // Published trees read by students from a SNAPSHOT, so live draft edits never
  // silently re-lock anyone. Seed the snapshot for already-published trees.
  if (!t.published && t.status === 'published') {
    t.published = { levels: t.levels, nodes: t.nodes, gating: t.gating };
  }
  return t;
};

// ── Axis accessors (read migrated nodes, tolerate legacy ones) ───────────────
export const isBoss = (node) => node.checkpoint ?? node.type === 'exam';
export const gradeMode = (node) => node.grade?.mode ?? (node.type === 'test' ? 'auto-quiz' : 'stars-5');
export const submitKinds = (node) => node.submit?.kinds ?? (node.type === 'test' ? ['none'] : ['video']);
export const isAutoGraded = (node) => ['auto-quiz', 'pass-fail'].includes(gradeMode(node));
export const isVideoNode = (node) => !submitKinds(node).includes('none'); // human-reviewed upload
export const isLiveNode = (node) => submitKinds(node).includes('live');

// Shape carries the GRADING axis (boss → hex, human-review → square, auto → circle)
// — replaces the old per-`type` shape switch in SkillNode / EditorCanvas.
export function shapeKey(node) {
  if (isBoss(node)) return 'hex';
  return isVideoNode(node) ? 'square' : 'circle';
}

// Back-compat: derive the legacy `type` from the axes so screens still reading
// `node.type` stay correct until they are ported (kept in sync on every edit).
export function legacyType(node) {
  if (isBoss(node)) return 'exam';
  return isVideoNode(node) ? 'practice' : 'test';
}

export const SUBMIT_LABELS = {
  video: 'Видео', photo: 'Фото', text: 'Текст', audio: 'Аудио',
  file: 'Файл', live: 'Очно', none: 'Без сдачи',
};
export const GRADE_LABELS = {
  'auto-quiz': 'Автотест', 'pass-fail': 'Зачёт/незачёт', 'stars-5': 'Оценка 1–5★', rubric: 'Рубрика',
};

// Human-readable pass condition derived from the axes (replaces the old static
// PASS_LABEL[type] map in the inspector).
export function passSummary(node) {
  const mode = gradeMode(node);
  if (mode === 'auto-quiz') return 'Автотест: проходится в приложении';
  const kinds = submitKinds(node).filter((k) => k !== 'none').map((k) => SUBMIT_LABELS[k]);
  const g = GRADE_LABELS[mode] || '';
  if (!kinds.length) return `${g}: самопроверка в приложении`;
  return `${g} · принимаем: ${kinds.join(' + ')}`;
}

// ── Derived structure ───────────────────────────────────────────────────────

export const treeEdges = (tree) =>
  tree.nodes.flatMap((n) => n.prereqs.map((p) => ({ from: p, to: n.id })));

// Canvas extents derived from node positions (padding for labels/level bands).
export function treeCanvas(tree) {
  if (!tree.nodes.length) return { w: 1600, h: 1200 };
  const xs = tree.nodes.map((n) => n.x);
  const ys = tree.nodes.map((n) => n.y);
  return { w: Math.max(...xs) + 480, h: Math.max(...ys) + 280 };
}

// Required (non-optional) exams per level — completing them "masters" a level.
export function requiredExams(tree) {
  const map = {};
  for (const lv of tree.levels) {
    map[lv.level] = tree.nodes
      .filter((n) => n.level === lv.level && isBoss(n) && !n.optional)
      .map((n) => n.id);
  }
  return map;
}

export const sortedLevels = (tree) => [...tree.levels].sort((a, b) => a.level - b.level);

// ── Progress derivation ─────────────────────────────────────────────────────
// `prog` holds only FACTS: { nodeId: { status: 'completed'|'in_progress', rating? } }.
// Everything else ('available' / 'locked') is derived here on every read, so a
// coach editing a tree instantly re-flows every student's unlock state.

export function levelMastery(tree, prog = {}) {
  const req = requiredExams(tree);
  const map = {};
  for (const lv of tree.levels) {
    const r = req[lv.level] || [];
    map[lv.level] = r.length > 0 && r.every((id) => prog[id]?.status === 'completed');
  }
  return map;
}

// Unlock rule (single pass): a node becomes 'available' when all prereqs are
// completed AND its level gate is open (previous level mastered; first level
// has no gate). Mastery depends only on completed nodes, which this pass never
// changes, so one pass is sufficient.
export function recomputeProgress(tree, prog = {}) {
  const next = { ...prog };
  const mastery = levelMastery(tree, next);
  const levels = sortedLevels(tree);
  const gateOpen = {};
  levels.forEach((lv, i) => {
    gateOpen[lv.level] = i === 0 ? true : mastery[levels[i - 1].level];
  });
  // 'graph' gating opens purely on prerequisites; 'levels' (default) also
  // requires the previous level mastered.
  const graphMode = tree.gating === 'graph';
  for (const n of tree.nodes) {
    const cur = next[n.id]?.status;
    if (cur === 'completed' || cur === 'in_progress') continue;
    const prereqsOk = n.prereqs.every((p) => next[p]?.status === 'completed');
    const gate = graphMode ? true : (gateOpen[n.level] ?? true);
    next[n.id] = { ...(next[n.id] || {}), status: prereqsOk && gate ? 'available' : 'locked' };
  }
  return next;
}

// Tree nodes enriched with one student's derived status + rating.
export function enrichNodes(tree, prog = {}) {
  const full = recomputeProgress(tree, prog);
  return tree.nodes.map((n) => ({
    ...n,
    status: full[n.id]?.status || 'locked',
    rating: full[n.id]?.rating ?? null,
  }));
}

// Aggregate stats for one (student, tree) pair — drives dashboards.
export function treeStats(tree, prog = {}, videos = [], studentId = null) {
  const nodes = enrichNodes(tree, prog);
  const total = nodes.length;
  const completed = nodes.filter((n) => n.status === 'completed').length;
  const exams = nodes.filter(isBoss);
  const examsPassed = exams.filter((n) => n.status === 'completed').length;
  const stars = nodes.reduce((sum, n) => sum + (n.rating || 0), 0);
  const pendingReview = videos.filter(
    (v) => v.treeId === tree.id && (!studentId || v.studentId === studentId) && v.status === 'pending'
  ).length;

  const mastery = levelMastery(tree, recomputeProgress(tree, prog));
  const levels = sortedLevels(tree);
  const levelsMastered = Object.values(mastery).filter(Boolean).length;
  let levelMeta = levels[levels.length - 1] || { level: 1, label: '', color: '#2DD4FF' };
  for (const lv of levels) { if (!mastery[lv.level]) { levelMeta = lv; break; } }
  const levelNodes = nodes.filter((n) => n.level === levelMeta.level);
  const levelDone = levelNodes.filter((n) => n.status === 'completed').length;

  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    examsPassed,
    examsTotal: exams.length,
    stars,
    pendingReview,
    level: levelMeta.level,
    levelLabel: levelMeta.label,
    levelColor: levelMeta.color,
    levelPercent: levelNodes.length ? Math.round((levelDone / levelNodes.length) * 100) : 0,
    levelsMastered,
    levelCount: levels.length,
  };
}

// ── Mentor eligibility (derived authority) ───────────────────────────────────
// A learner earns the right to mentor a node by having passed it well (≥ minStars).
// The coach still flips the per-node `delegation.delegable` flag and grants the
// mentor role — eligibility just decides who is a valid candidate.

export function mentorEligibleNodes(tree, prog = {}, minStars = 4) {
  return tree.nodes.filter((n) => (prog[n.id]?.rating || 0) >= minStars).map((n) => n.id);
}

export const isEligibleMentor = (tree, prog = {}) => mentorEligibleNodes(tree, prog).length > 0;

// Highest level the learner has earned authority over — caps their mentor scope.
export function eligibleMentorLevel(tree, prog = {}) {
  const ids = new Set(mentorEligibleNodes(tree, prog));
  const levels = tree.nodes.filter((n) => ids.has(n.id)).map((n) => n.level);
  return levels.length ? Math.max(...levels) : 0;
}

// A node is within a mentor's scope when no cap is set or its level is ≤ the cap.
export const nodeInScope = (node, scope) => !scope || scope.maxLevel == null || node.level <= scope.maxLevel;

// Whether the coach allowed this node to be reviewed by a mentor.
export const canDelegate = (node) => !!node.delegation?.delegable;

// ── Builder factories / invariants ──────────────────────────────────────────

export function createTreeDef(authorId) {
  return {
    id: uid('tree'),
    title: 'Новое дерево навыков',
    category: 'Без категории',
    emoji: '🌳',
    color: '#2DD4FF',
    description: '',
    authorId,
    collaborators: [],
    mentors: [],
    gating: 'levels',
    tags: [],
    status: 'draft',
    levels: [{ level: 1, label: 'УРОВЕНЬ 1', color: levelColor(0) }],
    nodes: [],
  };
}

// Snapshot of the teachable surface (what students read once cut over to the
// published view in Phase 6). Kept pure/serializable.
export const treeSnapshot = (tree) => ({
  levels: tree.levels,
  nodes: tree.nodes,
  gating: tree.gating ?? 'levels',
});

export function createNodeDef({ level = 1, x = 400, y = 400, type = 'practice', size, title } = {}) {
  return migrateNode({
    id: uid('node'),
    type,
    title: title || 'Новый навык',
    level,
    x,
    y,
    size,
    prereqs: [],
    description: '',
  });
}

// Would adding `prereqId` as a prerequisite of `nodeId` create a cycle?
// (True when nodeId is already an ancestor of prereqId.)
export function wouldCycle(tree, prereqId, nodeId) {
  const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const stack = [prereqId];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === nodeId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of byId[cur]?.prereqs || []) stack.push(p);
  }
  return false;
}
