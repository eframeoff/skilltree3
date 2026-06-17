import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { Card, ProgressBar, Screen, TreeEmblem, btn } from '../../components/ui.jsx';
import { TreeIcon, ClockIcon, ChatIcon, CompassIcon, ChevronRightIcon, ShareIcon } from '../../components/icons.jsx';

function TreeCard({ tree, coach, stats, onOpen, onChat, onCoach, onInvite }) {
  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <TreeEmblem tree={tree} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink-primary">{tree.title}</div>
          <button onClick={onCoach} className="block w-full truncate text-left text-xs text-ink-secondary transition hover:text-accent-plasma active:scale-95">
            {tree.category} · тренер <span className="underline-offset-2 hover:underline">{coach?.name || '—'}</span>
          </button>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-xl font-bold text-skill-gold">{stats.percent}%</div>
          <div className="font-mono text-[10px] text-ink-muted">{stats.completed}/{stats.total}</div>
        </div>
      </div>

      <ProgressBar percent={stats.percent} />

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-secondary">
        <span className="min-w-0 truncate">
          Уровень <span className="font-semibold" style={{ color: stats.levelColor }}>{stats.levelLabel}</span>
          {' '}· {stats.levelsMastered}/{stats.levelCount} освоено
        </span>
        {stats.pendingReview > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-warning ring-1 ring-warning/30">
            <ClockIcon className="w-3 h-3" /> {stats.pendingReview}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onOpen} className={`${btn.primary} min-w-0 flex-1`}>
          <TreeIcon className="w-5 h-5 shrink-0" /> <span className="truncate">Продолжить</span>
        </button>
        <button onClick={onChat} aria-label="Чат с тренером"
          className="flex shrink-0 items-center justify-center rounded-xl border border-tunnel-line px-3 text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
          <ChatIcon className="w-5 h-5" />
        </button>
        <button onClick={onInvite} aria-label="Пригласить на курс"
          className="flex shrink-0 items-center justify-center rounded-xl border border-tunnel-line px-3 text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
          <ShareIcon className="w-5 h-5" />
        </button>
      </div>
    </Card>
  );
}

// "Мои деревья" — programs the student is enrolled in.
export default function StudentTreesScreen() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  const invite = (treeId) => {
    const url = `${window.location.origin}${window.location.pathname}#/join/${treeId}`;
    const done = () => { setToast('🔗 Ссылка на курс скопирована'); setTimeout(() => setToast(null), 1800); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => setToast(url));
    else setToast(url);
  };

  const enrolled = store.enrollmentsOf(user.id).map((e) => ({
    tree: store.tree(e.treeId),
    coach: getUser(e.coachId),
    stats: store.stats(user.id, e.treeId),
  })).filter((x) => x.tree && x.stats);

  return (
    <Screen wide>
      <h1 className="font-display text-lg font-bold text-ink-primary">Мои деревья</h1>

      {enrolled.length === 0 ? (
        <Card className="text-center">
          <div className="mb-2 text-3xl">🌱</div>
          <p className="mb-3 text-sm text-ink-secondary">Вы пока никуда не записаны. Выберите программу в каталоге.</p>
          <button onClick={() => navigate('/app/catalog')} className={`${btn.primary} mx-auto`}>
            <CompassIcon className="w-5 h-5" /> Открыть каталог
          </button>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {enrolled.map((x) => (
              <TreeCard key={x.tree.id} tree={x.tree} coach={x.coach} stats={x.stats}
                onOpen={() => navigate(`/app/tree/${x.tree.id}`)}
                onChat={() => navigate(`/app/chat?c=${x.tree.id}`)}
                onCoach={() => x.coach && navigate(`/app/coach/${x.coach.id}`)}
                onInvite={() => invite(x.tree.id)} />
            ))}
          </div>
          <button onClick={() => navigate('/app/catalog')}
            className="flex w-full items-center gap-3 rounded-card border border-tunnel-line bg-bg-surface p-4 text-left transition hover:border-accent-plasma/40 active:scale-[0.99]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/30">
              <CompassIcon className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <div className="font-semibold text-ink-primary">Каталог программ</div>
              <div className="text-xs text-ink-secondary">Найдите новое дерево навыков</div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-ink-muted" />
          </button>
        </>
      )}

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
