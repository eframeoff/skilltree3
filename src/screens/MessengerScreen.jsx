import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { getUser } from '../data/users.js';
import { Avatar } from '../components/ui.jsx';
import ChatThread from '../components/ChatThread.jsx';
import { setSeen, unreadCount } from '../data/unread.js';
import { BackIcon, TreeIcon, ChevronRightIcon } from '../components/icons.jsx';

// Messenger-style chat: conversation list on the left, thread on the right.
//   coach  → one conversation per (student, tree)
//   student → one conversation per enrolled tree (with its coach)
// Deep-link a conversation via ?c=<key>.
export default function MessengerScreen({ role }) {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const isCoach = role === 'instructor';
  const [params, setParams] = useSearchParams();
  const [openThread, setOpenThread] = useState(false); // mobile: list ↔ thread
  const [q, setQ] = useState('');
  const [filterTree, setFilterTree] = useState('all');

  // Near-live chat: re-pull messages on open and every few seconds.
  useEffect(() => {
    store.refreshMessages();
    const t = setInterval(() => store.refreshMessages(), 7000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allConvs = isCoach
    ? store.coachRoster(user.id).map((r) => ({
        key: `${r.student.id}:${r.tree.id}`,
        studentId: r.student.id, treeId: r.tree.id, coachId: user.id,
        person: r.student, title: r.student.name, sub: `${r.tree.emoji} ${r.tree.title}`,
        count: store.generalMessages(r.tree.id, r.student.id).length,
      }))
    : store.enrollmentsOf(user.id).map((e) => {
        const tree = store.tree(e.treeId);
        const coach = getUser(e.coachId);
        return tree ? {
          key: e.treeId, studentId: user.id, treeId: e.treeId, coachId: e.coachId,
          person: coach, title: `${tree.emoji} ${tree.title}`, sub: `тренер ${coach?.name || '—'}`,
          count: store.generalMessages(e.treeId, user.id).length,
        } : null;
      }).filter(Boolean);

  // Coach: search by student name + filter by course.
  const courseOptions = isCoach
    ? [...new Map(store.coachRoster(user.id).map((r) => [r.tree.id, r.tree])).values()]
    : [];
  const convs = allConvs.filter((c) =>
    (filterTree === 'all' || c.treeId === filterTree) &&
    (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase())));

  const selKey = params.get('c') || convs[0]?.key;
  const sel = convs.find((c) => c.key === selKey) || convs[0] || null;
  const select = (key) => { setParams({ c: key }); setOpenThread(true); };

  // Keep the open conversation marked read (covers new messages arriving while open).
  useEffect(() => {
    if (!sel) return;
    setSeen(user.id, sel.key, sel.count);
    store.markChatRead(sel.treeId, sel.studentId);
  }, [sel?.key, sel?.count, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (allConvs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-muted">
        {isCoach ? 'Пока нет учеников для переписки.' : 'Запишитесь на программу, чтобы написать тренеру.'}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation list */}
      <aside className={`${openThread ? 'hidden lg:flex' : 'flex'} w-full shrink-0 flex-col border-r border-tunnel-line lg:w-72`}>
        <div className="border-b border-tunnel-line px-4 py-3 font-display text-base font-bold text-ink-primary">
          {isCoach ? 'Ученики' : 'Чаты'}
        </div>
        {isCoach && (
          <div className="space-y-2 border-b border-tunnel-line p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск ученика…"
              className="w-full rounded-lg border border-tunnel-line bg-bg-void px-3 py-1.5 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none" />
            {courseOptions.length > 1 && (
              <select value={filterTree} onChange={(e) => setFilterTree(e.target.value)}
                className="w-full rounded-lg border border-tunnel-line bg-bg-void px-3 py-1.5 text-sm text-ink-primary focus:border-accent-plasma/60 focus:outline-none">
                <option value="all">Все курсы</option>
                {courseOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.title}</option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {convs.length === 0 && <p className="p-4 text-center text-sm text-ink-muted">Ничего не найдено.</p>}
          {convs.map((c) => (
            <button key={c.key} onClick={() => select(c.key)}
              className={`flex w-full items-center gap-3 border-b border-tunnel-line/60 px-3 py-2.5 text-left transition ${
                sel?.key === c.key ? 'bg-accent-plasma/10' : 'hover:bg-white/5'}`}>
              <Avatar user={c.person} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-primary">{c.title}</div>
                <div className="truncate text-[11px] text-ink-secondary">{c.sub}</div>
              </div>
              {(() => {
                const u = sel?.key === c.key ? 0 : unreadCount(user.id, c.key, c.count);
                return u > 0
                  ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-plasma px-1.5 text-[11px] font-bold text-black">{u}</span>
                  : <ChevronRightIcon className="w-4 h-4 shrink-0 text-ink-muted lg:hidden" />;
              })()}
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${openThread ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {sel ? (
          <>
            <header className="flex shrink-0 items-center gap-2 border-b border-tunnel-line bg-tunnel-panel px-3 py-2.5">
              <button onClick={() => setOpenThread(false)} className="text-ink-secondary active:scale-90 lg:hidden" aria-label="К списку">
                <BackIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate(isCoach ? `/coach/students/${sel.studentId}` : `/app/coach/${sel.coachId}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.99]" title="Открыть профиль">
                <Avatar user={sel.person} size={32} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-primary">{sel.title}</div>
                  <div className="truncate text-[11px] text-ink-secondary">{sel.sub}</div>
                </div>
              </button>
              <button
                onClick={() => navigate(isCoach ? `/coach/students/${sel.studentId}/tree/${sel.treeId}` : `/app/tree/${sel.treeId}`)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-tunnel-line px-2.5 py-1.5 text-xs text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
                <TreeIcon className="w-4 h-4" /> Дерево
              </button>
            </header>
            <ChatThread key={sel.key} treeId={sel.treeId} studentId={sel.studentId} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">Выберите диалог</div>
        )}
      </section>
    </div>
  );
}
