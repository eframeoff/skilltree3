import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { Card, StatCard, ProgressBar, Avatar, Screen } from '../../components/ui.jsx';
import { BackIcon, TreeIcon, ChatIcon, UsersIcon, CheckIcon, ClockIcon } from '../../components/icons.jsx';

// Per-course dashboard: aggregate stats + every student's progress, with quick
// links into their tree (to grade / зачесть) and chat.
export default function CoachCourseScreen() {
  const { treeId } = useParams();
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const tree = store.tree(treeId);
  if (!tree) return <Screen><p className="text-ink-secondary">Дерево не найдено.</p></Screen>;

  const rows = store.coachRoster(user.id)
    .filter((r) => r.tree.id === treeId)
    .map((r) => ({ student: r.student, stats: store.stats(r.student.id, treeId) }))
    .sort((a, b) => b.stats.percent - a.stats.percent);

  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.stats.percent, 0) / rows.length) : 0;
  const pending = rows.reduce((a, r) => a + r.stats.pendingReview, 0);

  return (
    <Screen wide>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/coach/courses')} className="text-ink-secondary transition hover:text-ink-primary active:scale-90"><BackIcon /></button>
        <span className="text-lg">{tree.emoji}</span>
        <h1 className="font-display text-lg font-bold text-ink-primary">{tree.title}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<UsersIcon className="w-4 h-4" />} label="Учеников" value={rows.length} />
        <StatCard icon={<CheckIcon className="w-4 h-4" />} label="Ср. прогресс" value={`${avg}%`} />
        <StatCard icon={<ClockIcon className="w-4 h-4" />} label="На проверке" value={pending} />
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {rows.length === 0 && <p className="text-sm text-ink-muted">На этот курс пока никто не записан.</p>}
        {rows.map(({ student, stats }) => (
          <div key={student.id} className="flex items-center gap-3 rounded-card border border-tunnel-line bg-bg-surface p-3">
            <button onClick={() => navigate(`/coach/students/${student.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]">
              <Avatar user={student} size={42} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink-primary">{student.name}</div>
                <ProgressBar percent={stats.percent} className="my-1.5" />
                <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                  {stats.completed}/{stats.total} · {stats.stars}★
                  {stats.pendingReview > 0 && (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning ring-1 ring-warning/30">{stats.pendingReview} на проверке</span>
                  )}
                </div>
              </div>
            </button>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button onClick={() => navigate(`/coach/students/${student.id}/tree/${treeId}`)} title="Дерево ученика"
                className="rounded-lg border border-tunnel-line p-2 text-ink-secondary transition hover:border-accent-plasma/40 active:scale-90" aria-label="Дерево ученика">
                <TreeIcon className="w-4 h-4" />
              </button>
              <button onClick={() => navigate(`/coach/chat?c=${student.id}:${treeId}`)} title="Чат с учеником"
                className="rounded-lg border border-tunnel-line p-2 text-accent-plasma transition hover:border-accent-plasma/40 active:scale-90" aria-label="Чат">
                <ChatIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
