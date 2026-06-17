import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { Card, Avatar, Screen, TreeEmblem, btn } from '../../components/ui.jsx';
import { CheckIcon } from '../../components/icons.jsx';

// Marketplace of published trees: search + hashtag filter → enroll → start.
export default function CatalogScreen() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState(null);

  const trees = store.publishedTrees();
  const allTags = useMemo(() => [...new Set(trees.flatMap((t) => t.tags || []))].sort(), [trees]);

  const ql = q.trim().toLowerCase();
  const shown = trees.filter((t) =>
    (!tag || (t.tags || []).includes(tag)) &&
    (!ql || `${t.title} ${t.description} ${t.category} ${(t.tags || []).join(' ')}`.toLowerCase().includes(ql)));

  const start = (tree) => {
    store.enroll(user.id, tree.id);
    setToast(`🌱 Вы записаны на «${tree.title}»`);
    setTimeout(() => navigate(`/app/tree/${tree.id}`), 700);
  };

  return (
    <Screen wide>
      <div>
        <h1 className="font-display text-lg font-bold text-ink-primary">Каталог программ</h1>
        <p className="text-sm text-ink-secondary">Деревья навыков от тренеров со всего мира</p>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: название, тренер, #тег…"
        className="w-full rounded-xl border border-tunnel-line bg-bg-void px-4 py-2.5 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none" />

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTag(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!tag ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'border border-tunnel-line text-ink-muted'}`}>
            Все
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${tag === t ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'border border-tunnel-line text-ink-muted'}`}>
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.length === 0 && <p className="text-sm text-ink-muted">Ничего не найдено.</p>}
        {shown.map((tree) => {
          const author = getUser(tree.authorId);
          const enrolled = store.isEnrolled(user.id, tree.id);
          const exams = tree.nodes.filter((n) => n.type === 'exam').length;
          return (
            <Card key={tree.id} className="flex flex-col transition hover:border-accent-plasma/30">
              <div className="mb-2 flex items-start gap-3">
                <TreeEmblem tree={tree} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-primary">{tree.title}</div>
                  <span className="mt-0.5 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-secondary">
                    {tree.category}
                  </span>
                </div>
              </div>

              <p className="mb-2 flex-1 text-sm leading-relaxed text-ink-secondary">{tree.description}</p>

              {(tree.tags || []).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {tree.tags.map((t) => (
                    <button key={t} onClick={() => setTag(t)} className="rounded-full bg-tunnel-bg px-2 py-0.5 text-[10px] text-accent-plasma transition hover:bg-accent-plasma/10">#{t}</button>
                  ))}
                </div>
              )}

              <div className="mb-3 flex items-center gap-2 text-xs text-ink-secondary">
                <Avatar user={author} size={24} />
                <span className="text-ink-primary/80">{author?.name}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-muted">
                  {tree.nodes.length} навыков · {exams} зачётов · {tree.levels.length} ур.
                </span>
              </div>

              {enrolled ? (
                <button onClick={() => navigate(`/app/tree/${tree.id}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent-plasma/50 py-2.5 text-sm font-bold text-accent-plasma transition hover:bg-accent-plasma/10 active:scale-95">
                  <CheckIcon className="w-4 h-4" /> Вы записаны — открыть
                </button>
              ) : (
                <button onClick={() => start(tree)} className={`${btn.primary} w-full`}>
                  Начать обучение
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
