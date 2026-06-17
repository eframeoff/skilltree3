import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { Card, StatCard, ProgressBar, Avatar, Screen, SectionTitle, TreeEmblem, btn } from '../../components/ui.jsx';
import { TreeIcon, CheckIcon, VideoIcon, CompassIcon, ClockIcon, ChatIcon, ChevronRightIcon } from '../../components/icons.jsx';
import StarRating from '../../components/StarRating.jsx';

// One enrolled tree → a "character build" card with progress + continue CTA.
function TreeCard({ tree, coach, stats, onOpen, onChat, onCoach }) {
  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <TreeEmblem tree={tree} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink-primary">{tree.title}</div>
          <button onClick={onCoach} className="text-left text-xs text-ink-secondary transition hover:text-accent-plasma active:scale-95">
            {tree.category} · тренер <span className="underline-offset-2 hover:underline">{coach?.name || '—'}</span>
          </button>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold text-skill-gold">{stats.percent}%</div>
          <div className="font-mono text-[10px] text-ink-muted">{stats.completed}/{stats.total}</div>
        </div>
      </div>

      <ProgressBar percent={stats.percent} />

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-secondary">
        <span>
          Уровень <span className="font-semibold" style={{ color: stats.levelColor }}>{stats.levelLabel}</span>
          {' '}· {stats.levelsMastered}/{stats.levelCount} освоено
        </span>
        {stats.pendingReview > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-warning ring-1 ring-warning/30">
            <ClockIcon className="w-3 h-3" /> {stats.pendingReview} на проверке
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onOpen} className={`${btn.primary} flex-1`}>
          <TreeIcon className="w-5 h-5" /> Продолжить
        </button>
        <button onClick={onChat} aria-label="Чат с тренером"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-tunnel-line px-3 text-sm text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
          <ChatIcon className="w-5 h-5" /> Чат
        </button>
      </div>
    </Card>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();

  const enrolled = store.enrollmentsOf(user.id).map((e) => ({
    enrollment: e,
    tree: store.tree(e.treeId),
    coach: getUser(e.coachId),
    stats: store.stats(user.id, e.treeId),
  })).filter((x) => x.tree && x.stats);

  const totals = enrolled.reduce(
    (acc, x) => ({
      stars: acc.stars + x.stats.stars,
      exams: acc.exams + x.stats.examsPassed,
      examsTotal: acc.examsTotal + x.stats.examsTotal,
      pending: acc.pending + x.stats.pendingReview,
    }),
    { stars: 0, exams: 0, examsTotal: 0, pending: 0 }
  );
  const videosCount = store.videosFor(user.id).filter((v) => v.status === 'approved').length;

  return (
    <Screen wide>
      {/* Greeting */}
      <Card>
        <div className="flex items-center gap-3">
          <Avatar user={user} size={48} />
          <div className="flex-1">
            <div className="text-xs text-ink-muted">С возвращением</div>
            <div className="font-display text-lg font-bold text-ink-primary">{user.name.split(' ')[0]} 👋</div>
          </div>
          {/* total stars trophy chip */}
          <div className="flex items-center gap-2 rounded-full border border-skill-gold/30 bg-skill-gold/10 px-3 py-1.5 shadow-[0_0_16px_rgba(255,210,63,0.12)]">
            <StarRating value={3} size="w-3.5 h-3.5" />
            <span className="font-display text-sm font-bold text-skill-gold">{totals.stars}</span>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<TreeIcon className="w-4 h-4" />} label="Деревьев" value={enrolled.length} />
        <StatCard icon={<CheckIcon className="w-4 h-4" />} label="Зачётов" value={`${totals.exams}/${totals.examsTotal}`} />
        <StatCard icon={<VideoIcon className="w-4 h-4" />} label="Видео" value={videosCount} hint={totals.pending > 0 ? `${totals.pending} на проверке` : undefined} />
      </div>

      {/* My trees */}
      <section>
        <SectionTitle>Мои деревья навыков</SectionTitle>
        {enrolled.length === 0 ? (
          <Card className="text-center">
            <div className="mb-2 text-3xl">🌱</div>
            <p className="mb-3 text-sm text-ink-secondary">Вы пока никуда не записаны. Выберите программу в каталоге.</p>
            <button onClick={() => navigate('/app/catalog')} className={`${btn.primary} mx-auto`}>
              <CompassIcon className="w-5 h-5" /> Открыть каталог
            </button>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {enrolled.map((x) => (
              <TreeCard key={x.tree.id} tree={x.tree} coach={x.coach} stats={x.stats}
                onOpen={() => navigate(`/app/tree/${x.tree.id}`)}
                onChat={() => navigate(`/app/chat?c=${x.tree.id}`)}
                onCoach={() => x.coach && navigate(`/app/coach/${x.coach.id}`)} />
            ))}
          </div>
        )}
      </section>

      {/* Catalog teaser */}
      {enrolled.length > 0 && (
        <button onClick={() => navigate('/app/catalog')}
          className="flex w-full items-center gap-3 rounded-card border border-tunnel-line bg-bg-surface p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-accent-plasma/40 active:scale-[0.99]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/30">
            <CompassIcon className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <div className="font-semibold text-ink-primary">Каталог программ</div>
            <div className="text-xs text-ink-secondary">Найдите новое дерево навыков — спорт, музыка и не только</div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-ink-muted" />
        </button>
      )}
    </Screen>
  );
}
