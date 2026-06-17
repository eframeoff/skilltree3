import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { Card, ProgressBar, Avatar, StatusPill, Screen, btn } from '../../components/ui.jsx';
import StarRating from '../../components/StarRating.jsx';
import { BackIcon, TreeIcon, ChatIcon } from '../../components/icons.jsx';

const STATUS_RU = { locked: 'закрыто', available: 'доступно', in_progress: 'на проверке', completed: 'пройдено' };
// Mirror the tree's state colours in the per-skill breakdown dots.
const STATUS_DOT = {
  completed: 'bg-skill-gold shadow-[0_0_6px_rgba(255,210,63,0.7)]',
  available: 'bg-accent-plasma shadow-[0_0_6px_rgba(45,212,255,0.7)]',
  in_progress: 'bg-warning shadow-[0_0_6px_rgba(255,176,32,0.7)]',
  locked: 'bg-skill-locked',
};

export default function InstructorStudentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const student = getUser(id);
  if (!student) return <Screen><p className="text-ink-secondary">Ученик не найден.</p></Screen>;

  // Only this coach's enrollments of the student.
  const enrolled = store.coachRoster(user.id).filter((r) => r.student.id === id);

  return (
    <Screen wide>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-ink-secondary transition hover:text-ink-primary active:scale-90"><BackIcon /></button>
        <h1 className="font-display text-lg font-bold text-ink-primary">Профиль ученика</h1>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <Avatar user={student} size={52} />
          <div className="flex-1">
            <div className="font-display text-lg font-bold text-ink-primary">{student.name}</div>
            <div className="text-xs text-ink-muted">{student.email}</div>
          </div>
        </div>
      </Card>

      {enrolled.map(({ tree }) => {
        const stats = store.stats(id, tree.id);
        const nodes = store.nodesFor(id, tree.id);
        const pending = store.videosFor(id, tree.id).filter((v) => v.status === 'pending');
        const mentor = store.mentorInfo(id, tree.id);
        return (
          <Card key={tree.id}>
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${tree.color}1F`, border: `1px solid ${tree.color}44` }}>{tree.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold text-ink-primary">{tree.title}</div>
                <div className="text-[11px] text-ink-secondary">
                  {stats.examsPassed}/{stats.examsTotal} зачётов · {stats.stars}★ · уровень {stats.levelLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-bold text-skill-gold">{stats.percent}%</div>
              </div>
            </div>
            <ProgressBar percent={stats.percent} />

            <div className="mt-3 flex gap-2">
              <button onClick={() => navigate(`/coach/students/${id}/tree/${tree.id}`)}
                className={`${btn.primary} flex-1`}>
                <TreeIcon className="w-5 h-5" /> Открыть дерево
              </button>
              <button onClick={() => navigate(`/coach/chat?c=${id}:${tree.id}`)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-tunnel-line px-3 text-sm text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95"
                aria-label="Чат с учеником">
                <ChatIcon className="w-5 h-5" /> Чат
              </button>
            </div>

            {/* Mentor role: granted only to eligible learners (≥4★ somewhere),
                scoped to the level they've earned authority over. */}
            {mentor.isMentor ? (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-accent-violet/30 bg-accent-violet/5 p-3">
                <span className="text-sm text-accent-violet">Наставник этого дерева</span>
                <button onClick={() => store.revokeMentor(tree.id, id)}
                  className="text-xs font-medium text-rose-300 transition hover:underline active:scale-95">
                  Снять роль
                </button>
              </div>
            ) : mentor.eligible ? (
              <button onClick={() => store.grantMentor(tree.id, id, { maxLevel: mentor.level })}
                className={`${btn.gold} mt-2 w-full`}>
                Назначить наставником · уровни ≤ {mentor.level}
              </button>
            ) : (
              <p className="mt-2 text-center text-[11px] text-ink-muted">
                Станет кандидатом в наставники после зачёта на 4–5★.
              </p>
            )}

            {pending.length > 0 && (
              <div className="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-warning">Ждёт проверки ({pending.length})</div>
                <div className="space-y-2">
                  {pending.map((v) => (
                    <button key={v.id} onClick={() => navigate(`/coach/students/${id}/tree/${tree.id}`)}
                      className="flex w-full items-center justify-between rounded-xl bg-bg-void p-2.5 text-left ring-1 ring-white/5 transition hover:ring-warning/30 active:scale-[0.98]">
                      <span className="text-sm text-ink-primary">{store.nodeOf(tree.id, v.nodeId)?.title}</span>
                      <StatusPill status={v.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted transition hover:text-ink-secondary">
                Разбивка по навыкам
              </summary>
              <div className="mt-2 space-y-2">
                {nodes.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[n.status] || STATUS_DOT.locked}`} />
                    <span className="flex-1 text-ink-primary/90">{n.title}</span>
                    {n.type === 'exam' && n.rating > 0
                      ? <StarRating value={n.rating} size="w-3 h-3" />
                      : <span className="font-mono text-[11px] text-ink-muted">{STATUS_RU[n.status]}</span>}
                  </div>
                ))}
              </div>
            </details>
          </Card>
        );
      })}
    </Screen>
  );
}
