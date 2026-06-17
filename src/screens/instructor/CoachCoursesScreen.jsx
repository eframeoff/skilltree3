import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { Card, ProgressBar, Screen, TreeEmblem, btn } from '../../components/ui.jsx';
import { ChevronRightIcon, PlusIcon } from '../../components/icons.jsx';

// "Мои деревья" — published courses with at-a-glance student dashboards.
export default function CoachCoursesScreen() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const roster = store.coachRoster(user.id);

  const courses = store.myTrees(user.id)
    .filter((t) => t.status === 'published')
    .map((tree) => {
      const rows = roster.filter((r) => r.tree.id === tree.id);
      const sts = rows.map((r) => store.stats(r.student.id, tree.id));
      const avg = sts.length ? Math.round(sts.reduce((a, s) => a + s.percent, 0) / sts.length) : 0;
      const pending = sts.reduce((a, s) => a + s.pendingReview, 0);
      return { tree, count: rows.length, avg, pending };
    });

  return (
    <Screen wide>
      <h1 className="font-display text-lg font-bold text-ink-primary">Мои деревья</h1>

      {courses.length === 0 ? (
        <Card className="text-center">
          <p className="mb-3 text-sm text-ink-secondary">Нет опубликованных курсов. Создайте и опубликуйте дерево.</p>
          <button onClick={() => navigate('/coach/trees')} className={`${btn.gold} mx-auto`}><PlusIcon className="w-5 h-5" /> Создать дерево</button>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {courses.map(({ tree, count, avg, pending }) => (
            <Card key={tree.id} className="transition hover:border-accent-plasma/30">
              <div className="flex items-start gap-3">
                <TreeEmblem tree={tree} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-primary">{tree.title}</div>
                  <div className="text-xs text-ink-secondary">{count} учеников · средний прогресс {avg}%</div>
                  <ProgressBar percent={avg} className="my-1.5" />
                  {pending > 0 && (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning ring-1 ring-warning/30">{pending} на проверке</span>
                  )}
                </div>
              </div>
              <button onClick={() => navigate(`/coach/courses/${tree.id}`)} className={`${btn.primary} mt-3 w-full`}>
                Дашборд учеников <ChevronRightIcon className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
