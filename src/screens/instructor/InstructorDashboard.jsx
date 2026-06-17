import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { StatCard, ProgressBar, Avatar, Screen, SectionTitle } from '../../components/ui.jsx';
import { UsersIcon, VideoIcon, TreeIcon, ChevronRightIcon, PlusIcon } from '../../components/icons.jsx';

// Shared row chrome for the dashboard lists.
const row =
  'flex w-full items-center gap-3 rounded-card border border-tunnel-line bg-bg-surface p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-accent-plasma/30 active:scale-[0.98]';

export default function InstructorDashboard() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();

  const myTrees = store.myTrees(user.id);
  const roster = store.coachRoster(user.id);
  const pending = store.videosForCoach(user.id).filter((v) => v.status === 'pending');

  return (
    <Screen wide>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">Кабинет автора</div>
        <h1 className="font-display text-lg font-bold text-ink-primary">{user.name}</h1>
        <p className="text-sm text-ink-secondary">{user.headline}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<TreeIcon className="w-4 h-4" />} label="Деревьев" value={myTrees.length} />
        <StatCard icon={<UsersIcon className="w-4 h-4" />} label="Учеников" value={roster.length} />
        <StatCard icon={<VideoIcon className="w-4 h-4" />} label="На проверке" value={pending.length} />
      </div>

      {/* Review queue shortcut — amber pulse pulls the eye, like pending nodes */}
      {pending.length > 0 && (
        <button onClick={() => navigate('/coach/videos')}
          className="flex w-full items-center gap-3 rounded-card border border-warning/40 bg-warning/10 p-4 shadow-[0_0_24px_rgba(255,176,32,0.08)] transition hover:bg-warning/15 active:scale-[0.98]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/20 text-warning ring-1 ring-warning/30">
            <VideoIcon className="w-5 h-5" />
          </span>
          <div className="flex-1 text-left">
            <div className="font-semibold text-ink-primary">{pending.length} видео ждёт оценки</div>
            <div className="text-xs text-ink-secondary">Нажмите, чтобы открыть очередь проверки</div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-ink-muted" />
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* My trees */}
        <section>
          <SectionTitle action={
            <button onClick={() => navigate('/coach/trees')} className="text-xs text-accent-plasma transition hover:brightness-125">Все →</button>
          }>Мои деревья</SectionTitle>
          <div className="space-y-2">
            {myTrees.map((tree) => (
              <button key={tree.id} onClick={() => navigate(`/coach/trees/${tree.id}/edit`)} className={row}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ background: `${tree.color}1F`, border: `1px solid ${tree.color}44` }}>{tree.emoji}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-ink-primary">{tree.title}</div>
                  <div className="text-[11px] text-ink-muted">
                    {tree.nodes.length} узлов · {store.studentsOnTree(tree.id).length} учеников
                    {tree.status === 'draft' && <span className="text-ink-secondary"> · черновик</span>}
                  </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-ink-muted" />
              </button>
            ))}
            {myTrees.length === 0 && (
              <button onClick={() => { const id = store.createTree(user.id); navigate(`/coach/trees/${id}/edit`); }}
                className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-tunnel-line p-4 text-sm text-ink-muted transition hover:border-accent-plasma hover:text-accent-plasma">
                <PlusIcon className="w-5 h-5" /> Создать первое дерево
              </button>
            )}
          </div>
        </section>

        {/* Students progress overview */}
        <section>
          <SectionTitle>Ваши ученики</SectionTitle>
          <div className="space-y-2">
            {roster.map(({ student, tree }) => {
              const st = store.stats(student.id, tree.id);
              return (
                <button key={`${student.id}:${tree.id}`} onClick={() => navigate(`/coach/students/${student.id}`)} className={row}>
                  <Avatar user={student} size={40} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink-primary">{student.name}</span>
                      <span className="font-mono text-xs text-ink-secondary">{st.percent}%</span>
                    </div>
                    <ProgressBar percent={st.percent} className="mt-1.5" />
                    <div className="mt-1 text-[11px] text-ink-muted">
                      {tree.emoji} {tree.title} · {st.examsPassed}/{st.examsTotal} зачётов
                      {st.pendingReview > 0 && <span className="text-warning"> · {st.pendingReview} на проверке</span>}
                    </div>
                  </div>
                </button>
              );
            })}
            {roster.length === 0 && (
              <p className="rounded-card border border-tunnel-line bg-bg-surface p-4 text-sm text-ink-muted">
                Пока нет учеников. Опубликуйте дерево и поделитесь инвайт-ссылкой.
              </p>
            )}
          </div>
        </section>
      </div>
    </Screen>
  );
}
