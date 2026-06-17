import { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import EditorCanvas from '../../components/EditorCanvas.jsx';
import SkillTree from '../../components/SkillTree.jsx';
import {
  gradeMode, submitKinds, isBoss, legacyType, passSummary, SUBMIT_LABELS, treeSnapshot,
  NODE_SIZES, NODE_SIZE_LABELS, nodeSize, enrichNodes, treeEdges,
} from '../../data/treeUtils.js';
import { STARTER_TEMPLATES, parseSkillList } from '../../data/templates.js';
import { getUser } from '../../data/users.js';
import { ownedSkins, skinById } from '../../data/skins.js';
import { GuideEditor, guideBlocks } from '../../components/Guide.jsx';
import {
  BackIcon, PlusIcon, LinkIcon, TrashIcon, SettingsIcon, CloseIcon, ShareIcon, PencilIcon,
  BookIcon, VideoIcon, GradCapIcon, CheckIcon, LayersIcon, CompassIcon, PinIcon, ShopIcon,
} from '../../components/icons.jsx';

// Inspector field kit — one input voice everywhere (Figma-calm, no glow).
const field =
  'w-full rounded-lg border border-tunnel-line bg-bg-void px-3 py-2 text-sm text-ink-primary placeholder-ink-muted transition-colors focus:border-accent-plasma/60 focus:outline-none focus:ring-1 focus:ring-accent-plasma/25';
const label = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted';

// Grade axis as a segmented control (same monochrome SVG icons the canvas uses).
const GRADE_OPTS = [
  { value: 'auto-quiz', label: 'Автотест', Icon: BookIcon },
  { value: 'pass-fail', label: 'Зачёт/нет', Icon: CheckIcon },
  { value: 'stars-5', label: 'Оценка ★', Icon: GradCapIcon },
];

function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-1 rounded-xl border border-tunnel-line bg-bg-void p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(({ value: v, label: l, Icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold transition-colors ${
            value === v
              ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40'
              : 'text-ink-muted hover:text-ink-secondary'
          }`}>
          {Icon && <Icon className="w-4 h-4" />}
          {l}
        </button>
      ))}
    </div>
  );
}

// Node size tiers for the creation panel / node settings.
const SIZE_OPTS = NODE_SIZES.map((s) => ({ value: s, label: NODE_SIZE_LABELS[s] }));

// Submission axis: multi-select chips (a coach can accept video + text together,
// or 'Очно' for in-person attestation). Empty selection ⇒ self-check (none).
const SUBMIT_OPTS = ['video', 'photo', 'text', 'audio', 'file', 'live'];

function SubmitChips({ kinds, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUBMIT_OPTS.map((k) => {
        const on = kinds.includes(k);
        return (
          <button key={k} type="button" onClick={() => onToggle(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              on
                ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40'
                : 'border border-tunnel-line text-ink-muted hover:text-ink-secondary'
            }`}>
            {SUBMIT_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}

// ── Quiz editor (for 'test' nodes) ──────────────────────────────────────────
function QuizEditor({ tree, node, store }) {
  const quiz = node.quiz || [];
  const setQuiz = (q) => store.updateNode(tree.id, node.id, { quiz: q });
  const patchQ = (i, patch) => setQuiz(quiz.map((q, qi) => (qi === i ? { ...q, ...patch } : q)));

  return (
    <div>
      <span className={label}>Вопросы автотеста</span>
      <div className="space-y-3">
        {quiz.map((q, i) => (
          <div key={i} className="rounded-xl border border-tunnel-line bg-tunnel-bg p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">#{i + 1}</span>
              <input className={field} value={q.q} placeholder="Текст вопроса"
                onChange={(e) => patchQ(i, { q: e.target.value })} />
              <button onClick={() => setQuiz(quiz.filter((_, qi) => qi !== i))}
                className="shrink-0 rounded-lg p-2 text-rose-400 active:scale-90" aria-label="Удалить вопрос">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <textarea className={`${field} min-h-[64px]`} value={q.options.join('\n')}
              placeholder={'Варианты ответа\n(каждый с новой строки)'}
              onChange={(e) => {
                const options = e.target.value.split('\n');
                patchQ(i, { options, answer: Math.min(q.answer, Math.max(0, options.length - 1)) });
              }} />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Правильный:</span>
              <select className={`${field} !w-auto`} value={q.answer}
                onChange={(e) => patchQ(i, { answer: Number(e.target.value) })}>
                {q.options.map((opt, oi) => (
                  <option key={oi} value={oi}>{oi + 1}. {opt.slice(0, 30) || '—'}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setQuiz([...quiz, { q: '', options: ['Вариант 1', 'Вариант 2'], answer: 0 }])}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-tunnel-line py-2 text-xs text-skill-available active:scale-95">
        <PlusIcon className="w-4 h-4" /> Добавить вопрос
      </button>
    </div>
  );
}

// ── Teach-content editor: an ordered stack of blocks (text + media) that the
// coach assembles however they like — replaces the old single "steps" textarea
// and the hardcoded instruction video. Media payloads are placeholders until
// real upload lands (Phase 7 / ADR-0001).
const TEACH_KINDS = ['text', 'video', 'photo', 'audio', 'file'];

function TeachBlocksEditor({ tree, node, store }) {
  const blocks = node.teach?.blocks || [];
  const setBlocks = (b) => store.updateNode(tree.id, node.id, { teach: { ...node.teach, blocks: b } });
  const add = (kind) =>
    setBlocks([...blocks, kind === 'text' ? { kind, payload: '' } : { kind, payload: { label: '' } }]);
  const patchAt = (i, payload) => setBlocks(blocks.map((b, bi) => (bi === i ? { ...b, payload } : b)));
  const removeAt = (i) => setBlocks(blocks.filter((_, bi) => bi !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const copy = [...blocks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setBlocks(copy);
  };

  return (
    <div>
      <span className={label}>Материал урока</span>
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-xl border border-tunnel-line bg-tunnel-bg p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-bg-void px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {SUBMIT_LABELS[b.kind] || b.kind}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="rounded p-1 text-slate-400 disabled:opacity-30" aria-label="Выше">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1}
                  className="rounded p-1 text-slate-400 disabled:opacity-30" aria-label="Ниже">↓</button>
                <button onClick={() => removeAt(i)} className="rounded p-1 text-rose-400" aria-label="Удалить блок">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            {b.kind === 'text' ? (
              <textarea className={`${field} min-h-[64px]`} value={b.payload || ''}
                placeholder="Текст инструкции…" onChange={(e) => patchAt(i, e.target.value)} />
            ) : (
              <input className={field} value={b.payload?.label || ''}
                placeholder={`Подпись для ${SUBMIT_LABELS[b.kind]?.toLowerCase() || b.kind} (загрузка — позже)`}
                onChange={(e) => patchAt(i, { ...b.payload, label: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TEACH_KINDS.map((k) => (
          <button key={k} onClick={() => add(k)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-tunnel-line px-2.5 py-1.5 text-xs text-skill-available active:scale-95">
            <PlusIcon className="w-3.5 h-3.5" /> {SUBMIT_LABELS[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Node type (3 kinds): Тест (auto), Зачёт (coach passes), Экзамен (checkpoint
// that opens the next levels).
const KIND_OPTS = [
  { value: 'test', label: 'Тест', Icon: BookIcon },
  { value: 'zachet', label: 'Зачёт', Icon: VideoIcon },
  { value: 'exam', label: 'Экзамен', Icon: GradCapIcon },
];
const GRADE2_OPTS = [
  { value: 'pass-fail', label: 'Зачёт/незачёт', Icon: CheckIcon },
  { value: 'stars-5', label: 'Оценка ★', Icon: GradCapIcon },
];
const NODE_TABS = [
  { key: 'main', label: 'Основное' },
  { key: 'about', label: 'Описание' },
  { key: 'guide', label: 'Инструкция' },
  { key: 'submit', label: 'Приём' },
  { key: 'advanced', label: 'Тонкая' },
];
const KIND_HINT = {
  test: 'Круг · автоматический зачёт по тесту',
  zachet: 'Квадрат · тренер засчитывает вручную',
  exam: 'Гекс · контрольный: открывает следующие уровни',
};

// ── Selected-node inspector (tabbed) ─────────────────────────────────────────
function NodeInspector({ tree, node, store, onDelete, onDuplicate }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('main');
  const [skinModal, setSkinModal] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideCount = guideBlocks(node).length;
  const patch = (p) => store.updateNode(tree.id, node.id, p);
  const prereqTitle = (id) => tree.nodes.find((n) => n.id === id)?.title || id;
  const kind = gradeMode(node) === 'auto-quiz' ? 'test' : isBoss(node) ? 'exam' : 'zachet';

  // Switching kind keeps the axes coherent and the legacy `type` in sync.
  const setKind = (k) => {
    let p;
    if (k === 'test') {
      p = { checkpoint: false, submit: { ...node.submit, kinds: ['none'], min: 1 }, grade: { ...node.grade, mode: 'auto-quiz' } };
    } else {
      const hasSubmit = submitKinds(node).some((x) => x !== 'none');
      const submit = hasSubmit ? node.submit : { ...node.submit, kinds: ['video'], min: 1 };
      const mode = gradeMode(node) === 'auto-quiz' ? 'stars-5' : gradeMode(node);
      p = { checkpoint: k === 'exam', submit, grade: { ...node.grade, mode } };
    }
    patch({ ...p, type: legacyType({ ...node, ...p }) });
  };
  const toggleSubmit = (k) => {
    const cur = submitKinds(node).filter((x) => x !== 'none');
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    const submit = { ...node.submit, kinds: next.length ? next : ['none'] };
    patch({ submit, type: legacyType({ ...node, submit }) });
  };
  const setGradeMode2 = (mode) => patch({ grade: { ...node.grade, mode } });
  const setDelegable = (on) => patch({ delegation: { ...node.delegation, delegable: on } });
  const setDelegMode = (mode) => patch({ delegation: { ...node.delegation, mode } });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-tunnel-line bg-bg-void p-1">
        {NODE_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] font-semibold transition ${
              tab === t.key ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'text-ink-muted hover:text-ink-secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'main' && (
        <>
          <div>
            <span className={label}>Название навыка</span>
            <input className={field} value={node.title} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div>
            <span className={label}>Тип узла</span>
            <Segmented options={KIND_OPTS} value={kind} onChange={setKind} />
            <p className="mt-1 text-[11px] text-ink-muted">{KIND_HINT[kind]}</p>
          </div>
          <div>
            <span className={label}>Размер узла</span>
            <Segmented options={SIZE_OPTS} value={nodeSize(node)} onChange={(size) => patch({ size })} />
          </div>
          <div>
            <span className={label}>Скин узла</span>
            <button onClick={() => setSkinModal(true)}
              className="flex w-full items-center justify-between rounded-xl border border-tunnel-line bg-tunnel-bg px-3 py-2.5 text-sm text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
              <span className="flex items-center gap-2">
                <span className="h-5 w-5" style={{ ...(skinById(node.skin)?.style || { borderRadius: 6 }), background: 'linear-gradient(150deg, #2DD4FF, #7C5CFF)' }} />
                {skinById(node.skin)?.name || 'Стандарт (по типу)'}
              </span>
              <span className="text-accent-plasma">Выбрать</span>
            </button>
          </div>
          <div>
            <span className={label}>Уровень</span>
            <select className={field} value={node.level} onChange={(e) => patch({ level: Number(e.target.value) })}>
              {tree.levels.map((l) => <option key={l.level} value={l.level}>{l.level} · {l.label}</option>)}
            </select>
          </div>
          <label className="flex items-center justify-between rounded-xl bg-tunnel-bg px-3 py-2.5">
            <span className="text-sm text-slate-200">Не влияет на прогресс</span>
            <input type="checkbox" checked={!!node.optional}
              onChange={(e) => patch({ optional: e.target.checked || undefined })} className="h-4 w-4 accent-accent-violet" />
          </label>
        </>
      )}

      {tab === 'about' && (
        <div>
          <span className={label}>Краткое описание</span>
          <textarea className={`${field} min-h-[140px]`} value={node.description || ''}
            placeholder="Одной-двумя фразами: что изучается в этом узле…"
            onChange={(e) => patch({ description: e.target.value })} />
        </div>
      )}

      {tab === 'guide' && (
        <div>
          <span className={label}>Инструкция (полный гайд)</span>
          <button onClick={() => setGuideOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-tunnel-line bg-tunnel-bg px-3 py-2.5 text-sm text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
            <span className="truncate">{guideCount > 0 ? 'Редактировать инструкцию' : 'Добавить инструкцию'}</span>
            <span className="shrink-0 text-accent-plasma">на весь экран ⤢</span>
          </button>
          {guideCount > 0 && <p className="mt-1.5 text-[11px] text-ink-muted">В инструкции: {guideCount} блок(ов)</p>}
        </div>
      )}

      {tab === 'submit' && (
        kind === 'test' ? (
          <div>
            <p className="mb-2 rounded-lg bg-tunnel-bg px-3 py-2 text-[11px] text-ink-muted">Тест засчитывается автоматически при правильных ответах.</p>
            <QuizEditor tree={tree} node={node} store={store} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className={label}>Что принимает тренер для зачёта</span>
              <SubmitChips kinds={submitKinds(node)} onToggle={toggleSubmit} />
            </div>
            <div>
              <span className={label}>Как оценивает</span>
              <Segmented options={GRADE2_OPTS} value={gradeMode(node) === 'auto-quiz' ? 'stars-5' : gradeMode(node)} onChange={setGradeMode2} />
            </div>
            <p className="rounded-lg bg-tunnel-bg px-3 py-2 text-[11px] text-slate-400">Условие сдачи: {passSummary(node)}</p>
          </div>
        )
      )}

      {tab === 'advanced' && (
        <>
          <div className="space-y-2.5 rounded-xl border border-tunnel-line p-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-200">Делегировать проверку наставнику</span>
              <input type="checkbox" checked={!!node.delegation?.delegable}
                onChange={(e) => setDelegable(e.target.checked)} className="h-4 w-4 accent-accent-violet" />
            </label>
            {node.delegation?.delegable && (
              <Segmented
                options={[
                  { value: 'final', label: 'Финально', Icon: CheckIcon },
                  { value: 'provisional', label: 'С подтверждением', Icon: GradCapIcon },
                ]}
                value={node.delegation?.mode || 'provisional'} onChange={setDelegMode} />
            )}
          </div>
          {node.prereqs.length > 0 && (
            <div>
              <span className={label}>Открывается после</span>
              <div className="flex flex-wrap gap-1.5">
                {node.prereqs.map((p) => (
                  <span key={p} className="flex items-center gap-1 rounded-full bg-tunnel-bg px-2.5 py-1 text-xs text-slate-300">
                    {prereqTitle(p)}
                    <button onClick={() => store.toggleEdge(tree.id, p, node.id)}
                      className="text-slate-500 hover:text-rose-400" aria-label="Убрать связь">
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {guideOpen && (
        <GuideEditor initial={node.guide} treeId={tree.id} onClose={() => setGuideOpen(false)}
          onSave={(guide) => store.updateNode(tree.id, node.id, { guide })} />
      )}

      {skinModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setSkinModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-tunnel-line bg-tunnel-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink-primary">Скин узла</h3>
              <button onClick={() => setSkinModal(false)} className="text-ink-muted" aria-label="Закрыть"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ownedSkins(user).map((s) => {
                const active = (node.skin || 'classic') === s.id;
                const st = s.style || { borderRadius: 11 };
                return (
                  <button key={s.id} onClick={() => { patch({ skin: s.id === 'classic' ? null : s.id }); setSkinModal(false); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[10px] transition ${active ? 'border-accent-plasma text-accent-plasma ring-1 ring-accent-plasma/40' : 'border-tunnel-line text-ink-secondary hover:border-accent-plasma/40'}`}>
                    <span className="h-9 w-9" style={{ ...st, background: 'linear-gradient(150deg, #2DD4FF, #7C5CFF)' }} />
                    <span className="w-full truncate text-center">{s.name}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setSkinModal(false); navigate('/coach/shop'); }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-tunnel-line py-2.5 text-sm text-accent-plasma active:scale-95">
              <ShopIcon className="w-4 h-4" /> Открыть магазин
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-tunnel-line pt-3">
        <button onClick={onDuplicate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-tunnel-line py-2.5 text-sm font-medium text-ink-secondary active:scale-95">
          <LayersIcon className="w-4 h-4" /> Дублировать
        </button>
        <button onClick={onDelete}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 py-2.5 text-sm font-medium text-rose-300 active:scale-95">
          <TrashIcon className="w-4 h-4" /> Удалить
        </button>
      </div>
    </div>
  );
}

// ── Bulk inspector for a multi-selection (mass-editing branches) ─────────────
function MultiNodeInspector({ tree, ids, store, onDuplicateAll, onDeleteAll }) {
  const setLevelAll = (lvl) => ids.forEach((id) => store.updateNode(tree.id, id, { level: lvl }));
  const setDelegableAll = (on) => ids.forEach((id) => {
    const n = tree.nodes.find((x) => x.id === id);
    store.updateNode(tree.id, id, { delegation: { ...n?.delegation, delegable: on } });
  });
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-tunnel-bg px-3 py-2 text-sm text-ink-secondary">
        Выбрано узлов: <b className="text-ink-primary">{ids.length}</b>
        <span className="mt-1 block text-[11px] text-ink-muted">Shift-клик добавляет/убирает · Shift-протяжка — рамка выделения</span>
      </p>

      <div>
        <span className={label}>Переместить на уровень</span>
        <select className={field} defaultValue=""
          onChange={(e) => { if (e.target.value) setLevelAll(Number(e.target.value)); }}>
          <option value="">— выберите уровень —</option>
          {tree.levels.map((l) => <option key={l.level} value={l.level}>{l.level} · {l.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setDelegableAll(true)}
          className="flex-1 rounded-xl border border-tunnel-line py-2 text-xs text-ink-secondary active:scale-95">Делегируемые</button>
        <button onClick={() => setDelegableAll(false)}
          className="flex-1 rounded-xl border border-tunnel-line py-2 text-xs text-ink-secondary active:scale-95">Только тренер</button>
      </div>

      <button onClick={onDuplicateAll}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-tunnel-line py-2.5 text-sm font-medium text-ink-secondary active:scale-95">
        <LayersIcon className="w-4 h-4" /> Дублировать выбранные
      </button>
      <button onClick={onDeleteAll}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 py-2.5 text-sm font-medium text-rose-300 active:scale-95">
        <TrashIcon className="w-4 h-4" /> Удалить выбранные ({ids.length})
      </button>
    </div>
  );
}

// ── Tree-level settings inspector (tabbed) ───────────────────────────────────
const TREE_TABS = [
  { key: 'main', label: 'Основное' },
  { key: 'levels', label: 'Уровни' },
  { key: 'access', label: 'Доступ' },
];

function TreeInspector({ tree, store, user, studentsCount, onCopyInvite, onCopyEditInvite, onDeleteTree }) {
  const [tab, setTab] = useState('main');
  const patch = (p) => store.updateTree(tree.id, p);
  const tags = tree.tags || [];
  const [tagInput, setTagInput] = useState('');
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !tags.includes(t)) patch({ tags: [...tags, t] });
    setTagInput('');
  };
  const removeTag = (t) => patch({ tags: tags.filter((x) => x !== t) });
  const isOwner = user.id === tree.authorId;
  const collaborators = tree.collaborators || [];
  const candidates = isOwner ? store.coAuthorCandidates(tree.id) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-tunnel-line bg-bg-void p-1">
        {TREE_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
              tab === t.key ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'text-ink-muted hover:text-ink-secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'main' && (
        <>
          <div className="grid grid-cols-[64px,1fr] gap-3">
            <div>
              <span className={label}>Эмодзи</span>
              <input className={`${field} text-center text-lg`} value={tree.emoji} maxLength={4}
                onChange={(e) => patch({ emoji: e.target.value })} />
            </div>
            <div>
              <span className={label}>Название дерева</span>
              <input className={field} value={tree.title} placeholder="Например: Гитара с нуля"
                onChange={(e) => patch({ title: e.target.value })} />
            </div>
          </div>
          <div>
            <span className={label}>Категория</span>
            <input className={field} value={tree.category} onChange={(e) => patch({ category: e.target.value })} />
          </div>
          <div>
            <span className={label}>Описание программы</span>
            <textarea className={`${field} min-h-[80px]`} value={tree.description}
              placeholder="Чему научится ученик, для кого программа…"
              onChange={(e) => patch({ description: e.target.value })} />
          </div>
          <div>
            <span className={label}>Хэштеги (для каталога)</span>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full bg-tunnel-bg px-2.5 py-1 text-xs text-ink-secondary">
                    #{t}
                    <button onClick={() => removeTag(t)} className="text-slate-500 hover:text-rose-400" aria-label="Убрать тег"><CloseIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className={field} value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="например: гитара" />
              <button onClick={addTag} className="shrink-0 rounded-lg border border-tunnel-line px-3 text-sm text-accent-plasma active:scale-95">Добавить</button>
            </div>
          </div>
          <div className="rounded-xl bg-tunnel-bg p-3 text-xs text-slate-400">
            <div className="mb-1 font-semibold text-slate-300">Статистика</div>
            {tree.nodes.length} узлов · {tree.nodes.filter((n) => n.type === 'exam').length} зачётов · {studentsCount} учеников
          </div>
        </>
      )}

      {tab === 'levels' && (
        <>
          <div>
            <span className={label}>Открытие узлов</span>
            <Segmented
              options={[
                { value: 'levels', label: 'По уровням', Icon: GradCapIcon },
                { value: 'graph', label: 'Свободно', Icon: LinkIcon },
              ]}
              value={tree.gating || 'levels'} onChange={(gating) => patch({ gating })} />
            <p className="mt-1 text-[11px] text-slate-500">
              {tree.gating === 'graph'
                ? 'Узлы открываются только по связям-пререквизитам.'
                : 'Уровень открывается после освоения предыдущего.'}
            </p>
          </div>
          <div>
            <span className={label}>Уровни</span>
            <div className="space-y-2">
              {tree.levels.map((lv) => (
                <div key={lv.level} className="flex items-center gap-2">
                  <span className="w-5 text-center font-mono text-xs text-slate-500">{lv.level}</span>
                  <input className={field} value={lv.label}
                    onChange={(e) => store.updateLevel(tree.id, lv.level, { label: e.target.value })} />
                  <input type="color" value={lv.color}
                    onChange={(e) => store.updateLevel(tree.id, lv.level, { color: e.target.value })}
                    title="Цвет уровня"
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-tunnel-line bg-bg-void p-1.5
                               [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none
                               [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none" />
                </div>
              ))}
            </div>
            <button onClick={() => store.addLevel(tree.id)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-tunnel-line py-2 text-xs text-skill-available active:scale-95">
              <PlusIcon className="w-4 h-4" /> Добавить уровень
            </button>
          </div>
        </>
      )}

      {tab === 'access' && (
        <>
          <div>
            <span className={label}>Инвайт-ссылка для учеников</span>
            <button onClick={onCopyInvite}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-tunnel-line py-2.5 text-sm text-skill-available active:scale-95">
              <ShareIcon className="w-4 h-4" /> Скопировать ссылку на курс
            </button>
          </div>

          <div>
            <span className={label}>Кто может редактировать дерево</span>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-lg bg-tunnel-bg px-2.5 py-1.5">
                <span className="flex-1 text-sm text-ink-primary">{getUser(tree.authorId)?.name || 'Вы'}</span>
                <span className="text-[10px] text-ink-muted">создатель</span>
              </div>
              {collaborators.map((c) => (
                <div key={c.userId} className="flex items-center gap-2 rounded-lg bg-tunnel-bg px-2.5 py-1.5">
                  <span className="flex-1 text-sm text-ink-primary">{getUser(c.userId)?.name || c.userId}</span>
                  <span className="text-[10px] text-ink-muted">соавтор</span>
                  {isOwner && (
                    <button onClick={() => store.removeCollaborator(tree.id, c.userId)}
                      className="text-slate-500 hover:text-rose-400" aria-label="Убрать соавтора"><CloseIcon className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
            {isOwner && candidates.length > 0 && (
              <select className={`${field} mt-2`} value=""
                onChange={(e) => { if (e.target.value) store.addCollaborator(tree.id, { userId: e.target.value, role: 'co-author' }); }}>
                <option value="">+ Добавить соавтора…</option>
                {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {isOwner && (
              <button onClick={onCopyEditInvite}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-tunnel-line py-2.5 text-sm text-accent-plasma active:scale-95">
                <LinkIcon className="w-4 h-4" /> Ссылка-приглашение на редактирование
              </button>
            )}
            {!isOwner && <p className="mt-2 text-[11px] text-ink-muted">Управлять соавторами может только создатель дерева.</p>}
          </div>

          {isOwner && (
            <button onClick={onDeleteTree}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 py-2.5 text-sm font-medium text-rose-300 active:scale-95">
              <TrashIcon className="w-4 h-4" /> Удалить дерево
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── The no-code builder screen ──────────────────────────────────────────────
export default function TreeEditorScreen() {
  const { treeId } = useParams();
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const apiRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [view, setView] = useState('builder'); // 'builder' (blueprint) | 'preview' (pretty tree)
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [publishModal, setPublishModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Builder keyboard shortcuts (registered before the early return so hook order
  // is stable). Ignored while typing in a field; Ctrl+Z/Y undo/redo, Ctrl+D
  // duplicate, Ctrl+K search, Delete removes the selected node.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { if (e.key === 'Escape') t.blur(); return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
      else if (mod && e.key.toLowerCase() === 'd' && selectedIds.length) { e.preventDefault(); const ids = selectedIds.map((id) => store.duplicateNode(treeId, id)).filter(Boolean); if (ids.length) setSelectedIds(ids); }
      else if (e.key === 'Delete' && selectedIds.length) { e.preventDefault(); selectedIds.forEach((id) => store.deleteNode(treeId, id)); setSelectedIds([]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, treeId, store]);

  const tree = store.tree(treeId);
  const canEdit = tree && (tree.authorId === user.id
    || (tree.collaborators || []).some((c) => c.userId === user.id && c.role === 'co-author'));
  if (!tree || !canEdit) {
    return <div className="p-6 text-sm text-slate-400">Дерево не найдено или принадлежит другому автору.</div>;
  }

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedNode = tree.nodes.find((n) => n.id === selectedId) || null;
  const studentsCount = store.studentsOnTree(treeId).length;
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const handleNodeClick = (id, shift) => {
    if (connectMode) {
      if (!connectFrom) { setConnectFrom(id); return; }
      if (connectFrom === id) { setConnectFrom(null); return; }
      const ok = store.toggleEdge(treeId, connectFrom, id);
      flash(ok ? '🔗 Связь обновлена' : '⚠ Так нельзя — получится цикл');
      setConnectFrom(null);
      return;
    }
    if (shift) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); return; }
    setSelectedIds([id]);
  };

  const handleAddNode = () => {
    const at = apiRef.current?.center() || { x: 400, y: 400 };
    const level = tree.levels[0]?.level ?? 1;
    const id = store.addNode(treeId, { level, x: at.x, y: at.y });
    setConnectMode(false);
    setSelectedIds([id]);
  };

  const handleDeleteNode = () => {
    selectedIds.forEach((id) => store.deleteNode(treeId, id));
    setSelectedIds([]);
    flash(selectedIds.length > 1 ? '🗑 Узлы удалены' : '🗑 Узел удалён');
  };

  const handleDeleteTree = () => {
    const warn = studentsCount > 0 ? ` Прогресс ${studentsCount} учеников будет потерян.` : '';
    if (!window.confirm(`Удалить дерево «${tree.title}»?${warn} Это действие необратимо.`)) return;
    store.deleteTree(treeId);
    navigate('/coach/trees');
  };

  const isPublished = tree.status === 'published';
  // Draft has edits not yet rolled out to enrolled students.
  const hasUnpublished = isPublished && JSON.stringify(treeSnapshot(tree)) !== JSON.stringify(tree.published);

  const togglePublish = () => {
    if (!isPublished && tree.nodes.length === 0) {
      flash('⚠ Добавьте хотя бы один узел перед публикацией');
      return;
    }
    if (isPublished) {
      store.updateTree(treeId, { status: 'draft' });
      flash('📦 Дерево скрыто в черновики');
    } else {
      store.publishTreeUpdate(treeId); // first publish snapshots the draft
      flash('🚀 Дерево опубликовано в каталоге');
    }
  };

  const publishChanges = () => {
    store.publishTreeUpdate(treeId);
    setPublishModal(false);
    flash('✅ Изменения опубликованы — ученики получили обновление');
  };

  const copyLink = (url, ok) => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => flash(ok), () => flash(url));
    else flash(url);
  };
  const base = `${window.location.origin}${window.location.pathname}`;
  const copyInvite = () => copyLink(`${base}#/join/${treeId}`, '🔗 Ссылка на курс скопирована');
  const copyEditInvite = () => copyLink(`${base}#/join/${treeId}?role=co-author`, '🔗 Ссылка-приглашение на редактирование скопирована');

  const panelVisible = selectedIds.length > 0 || settingsOpen;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-tunnel-line bg-tunnel-panel px-3 py-2">
        <button onClick={() => navigate('/coach/trees')} className="text-slate-300 active:scale-90" aria-label="К списку деревьев">
          <BackIcon className="w-5 h-5" />
        </button>
        <span className="text-lg">{tree.emoji}</span>
        <div className="min-w-0 flex-1 truncate text-sm font-bold text-ink-primary">{tree.title || 'Без названия'}</div>
        <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${
          tree.status === 'published' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600/30 text-slate-300'
        }`}>
          {tree.status === 'published' ? 'опубликовано' : 'черновик'}
        </span>
        <button onClick={() => setView((v) => (v === 'builder' ? 'preview' : 'builder'))}
          className="rounded-xl border border-tunnel-line px-2.5 py-2 text-[11px] font-semibold text-slate-300 active:scale-90">
          {view === 'builder' ? 'Превью' : 'Правка'}
        </button>
        {view === 'builder' && (
          <button onClick={() => setShowMinimap((s) => !s)} aria-label="Миникарта"
            className={`rounded-xl border p-2 active:scale-90 ${showMinimap ? 'border-accent-plasma/60 text-accent-plasma' : 'border-tunnel-line text-slate-300'}`}>
            <PinIcon className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => { setSettingsOpen((s) => !s); setSelectedIds([]); }} aria-label="Настройки дерева"
          className={`rounded-xl border p-2 active:scale-90 ${settingsOpen ? 'border-accent-plasma/60 text-accent-plasma' : 'border-tunnel-line text-slate-300'}`}>
          <SettingsIcon className="w-4 h-4" />
        </button>
        {hasUnpublished && (
          <button onClick={() => setPublishModal(true)}
            className="relative rounded-xl bg-skill-gold px-3 py-2 text-xs font-bold text-black active:scale-95">
            Опубликовать изменения
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-tunnel-panel" />
          </button>
        )}
        <button onClick={togglePublish}
          className={`rounded-xl px-3 py-2 text-xs font-bold active:scale-95 ${
            isPublished ? 'border border-tunnel-line text-slate-300' : 'bg-skill-gold text-black'
          }`}>
          {isPublished ? 'В черновик' : 'Опубликовать'}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          {view === 'builder' ? (
            <EditorCanvas
              tree={tree}
              selectedIds={selectedIds}
              connectFrom={connectFrom}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => { setSelectedIds([]); setConnectFrom(null); }}
              onMoveNode={(id, x, y) => store.updateNode(treeId, id, { x, y })}
              onLasso={(ids) => setSelectedIds(ids)}
              apiRef={apiRef}
              showMinimap={showMinimap}
              showGrid={showGrid}
            />
          ) : (
            <SkillTree
              tree={tree}
              nodes={tree.nodes.map((n) => ({ ...n, status: 'available' }))}
              edges={treeEdges(tree)}
              onNodeClick={(n) => setSelectedIds([n.id])}
            />
          )}

          {/* Floating toolbar (builder only; wraps so it never overflows) */}
          {view === 'builder' && (
          <div className="absolute left-3 right-3 top-3 z-30 flex flex-wrap items-center gap-2">
            <button onClick={handleAddNode}
              className="flex items-center gap-1 rounded-xl bg-skill-available px-3 py-2 text-xs font-bold text-black shadow-lg active:scale-95">
              <PlusIcon className="w-4 h-4" /> Узел
            </button>
            <button
              onClick={() => { setConnectMode((c) => !c); setConnectFrom(null); }}
              className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold shadow-lg active:scale-95 ${
                connectMode ? 'bg-warning text-black' : 'glass border border-tunnel-line text-white'
              }`}>
              <LinkIcon className="w-4 h-4" /> Связи
            </button>

            {/* Undo / redo */}
            <div className="flex items-center overflow-hidden rounded-xl glass border border-tunnel-line shadow-lg">
              <button onClick={store.undo} disabled={!store.canUndo} aria-label="Отменить (Ctrl+Z)"
                className="flex h-9 w-9 items-center justify-center text-base text-white transition active:scale-90 disabled:opacity-30">↶</button>
              <div className="h-5 w-px bg-white/10" />
              <button onClick={store.redo} disabled={!store.canRedo} aria-label="Повторить (Ctrl+Shift+Z)"
                className="flex h-9 w-9 items-center justify-center text-base text-white transition active:scale-90 disabled:opacity-30">↷</button>
            </div>

            <button onClick={() => setSearchOpen(true)} aria-label="Поиск узла (Ctrl+K)"
              className="rounded-xl glass border border-tunnel-line p-2 text-white shadow-lg active:scale-90">
              <CompassIcon className="w-4 h-4" />
            </button>

            <button onClick={() => setShowGrid((g) => !g)} aria-label="Сетка"
              className={`rounded-xl glass border p-2 shadow-lg active:scale-90 ${showGrid ? 'border-accent-plasma/50 text-accent-plasma' : 'border-tunnel-line text-white'}`}>
              <LayersIcon className="w-4 h-4" />
            </button>
          </div>
          )}

          {connectMode && (
            <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-warning/90 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg">
              {connectFrom
                ? 'Теперь кликните узел, который ОТКРЫВАЕТСЯ после него'
                : 'Кликните узел-пререквизит (повторный клик по паре удаляет связь)'}
            </div>
          )}

          {/* Cold-start: never a blank canvas — templates or a skill-list import */}
          {tree.nodes.length === 0 && (
            <div className="absolute inset-x-0 bottom-24 z-20 mx-auto flex w-[90%] max-w-md flex-col gap-2 rounded-2xl border border-tunnel-line bg-tunnel-panel/95 p-4 shadow-2xl">
              {!showImport ? (
                <>
                  <div className="text-sm font-semibold text-ink-primary">Быстрый старт</div>
                  <div className="grid grid-cols-2 gap-2">
                    {STARTER_TEMPLATES.map((tpl) => (
                      <button key={tpl.id} onClick={() => store.seedTreeContent(treeId, parseSkillList(tpl.text))}
                        className="rounded-xl border border-tunnel-line p-3 text-left transition hover:border-accent-plasma/40 active:scale-95">
                        <div className="text-sm font-medium text-ink-primary">{tpl.title}</div>
                        <div className="text-[11px] text-ink-muted">{tpl.desc}</div>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowImport(true)} className="mt-1 text-left text-xs font-medium text-accent-plasma">
                    Импортировать список навыков →
                  </button>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-ink-primary">Импорт списка навыков</div>
                  <p className="text-[11px] text-ink-muted">Строка — навык. «# Название» — новый уровень. «*» в конце — контрольная точка.</p>
                  <textarea autoFocus value={importText} onChange={(e) => setImportText(e.target.value)}
                    placeholder={'# Основы\nПервый навык\nВторой навык\nЗачёт *'}
                    className={`${field} min-h-[140px] font-mono`} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (importText.trim()) { store.seedTreeContent(treeId, parseSkillList(importText)); setShowImport(false); setImportText(''); } }}
                      className="flex-1 rounded-xl bg-skill-available py-2 text-xs font-bold text-black active:scale-95">
                      Создать дерево
                    </button>
                    <button onClick={() => setShowImport(false)}
                      className="rounded-xl border border-tunnel-line px-3 py-2 text-xs text-ink-secondary active:scale-95">
                      Назад
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Inspector: bottom sheet < lg, side panel ≥ lg — hidden entirely until a
            node is selected or tree settings are opened. */}
        {panelVisible && (
          <div className="absolute inset-x-0 bottom-0 z-40 h-[72%] overflow-y-auto rounded-t-sheet border-t border-tunnel-line bg-tunnel-panel
                          lg:static lg:h-auto lg:w-[360px] lg:shrink-0 lg:overflow-y-auto lg:rounded-none lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {selectedIds.length > 1 ? `Выбрано: ${selectedIds.length}`
                  : selectedNode ? 'Настройки узла'
                  : 'Настройки дерева'}
              </h3>
              <button onClick={() => { setSelectedIds([]); setSettingsOpen(false); }}
                className="rounded-full p-1.5 text-slate-400 active:scale-90" aria-label="Закрыть панель">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {selectedIds.length > 1 ? (
                <MultiNodeInspector tree={tree} ids={selectedIds} store={store}
                  onDeleteAll={handleDeleteNode}
                  onDuplicateAll={() => { const ids = selectedIds.map((id) => store.duplicateNode(treeId, id)).filter(Boolean); if (ids.length) setSelectedIds(ids); }} />
              ) : selectedNode ? (
                <NodeInspector tree={tree} node={selectedNode} store={store} onDelete={handleDeleteNode}
                  onDuplicate={() => { const id = store.duplicateNode(treeId, selectedNode.id); if (id) setSelectedIds([id]); }} />
              ) : (
                <TreeInspector tree={tree} store={store} user={user} studentsCount={studentsCount}
                  onCopyInvite={copyInvite} onCopyEditInvite={copyEditInvite} onDeleteTree={handleDeleteTree} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cmd/Ctrl+K — jump to any node by title (find on a large tree) */}
      {searchOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 pt-20"
          onClick={() => { setSearchOpen(false); setQuery(''); }}>
          <div className="w-[90%] max-w-md rounded-2xl border border-tunnel-line bg-tunnel-panel p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск узла по названию…" className={field} />
            <div className="mt-2 max-h-72 overflow-y-auto">
              {tree.nodes
                .filter((n) => n.title.toLowerCase().includes(query.trim().toLowerCase()))
                .slice(0, 30)
                .map((n) => (
                  <button key={n.id}
                    onClick={() => { apiRef.current?.focusNode?.(n.id); setSettingsOpen(false); setSelectedIds([n.id]); setSearchOpen(false); setQuery(''); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                    <span className="flex-1 truncate text-ink-primary">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-muted">ур. {n.level}</span>
                  </button>
                ))}
              {tree.nodes.filter((n) => n.title.toLowerCase().includes(query.trim().toLowerCase())).length === 0 && (
                <p className="px-2 py-3 text-sm text-ink-muted">Ничего не найдено</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Publish-update impact preview — protects enrolled students from silent re-locks */}
      {publishModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setPublishModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-tunnel-line bg-tunnel-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-ink-primary">Опубликовать изменения?</h3>
            {(() => {
              const im = store.publishImpact(treeId);
              return (
                <div className="mt-2 space-y-1.5 text-sm text-ink-secondary">
                  <p>Новых узлов: <b className="text-ink-primary">+{im.added}</b> · удалённых: <b className="text-ink-primary">−{im.removed}</b></p>
                  {im.affected > 0 ? (
                    <p className="rounded-lg bg-danger/10 p-2 text-rose-300">⚠ Прогресс по удалённым узлам потеряется у {im.affected} учеников.</p>
                  ) : (
                    <p className="text-ink-muted">Прогресс учеников не пострадает.</p>
                  )}
                  <p className="text-[11px] text-ink-muted">{studentsCount} учеников получат обновлённое дерево.</p>
                </div>
              );
            })()}
            <div className="mt-4 flex gap-2">
              <button onClick={publishChanges} className="flex-1 rounded-xl bg-skill-gold py-2.5 text-sm font-bold text-black active:scale-95">Опубликовать</button>
              <button onClick={() => setPublishModal(false)} className="rounded-xl border border-tunnel-line px-4 py-2.5 text-sm text-ink-secondary active:scale-95">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
