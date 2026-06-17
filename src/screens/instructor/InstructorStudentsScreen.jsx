import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { Avatar, ProgressBar, Screen } from '../../components/ui.jsx';
import { TreeIcon, ChatIcon } from '../../components/icons.jsx';

// Coach roster — one row per (student, tree) enrollment.
export default function InstructorStudentsScreen() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const roster = store.coachRoster(user.id);

  return (
    <Screen wide>
      <h1 className="font-display text-lg font-bold text-ink-primary">Мои ученики ({roster.length})</h1>

      <div className="grid gap-2 lg:grid-cols-2">
        {roster.map(({ student, tree }) => {
          const st = store.stats(student.id, tree.id);
          return (
            <div key={`${student.id}:${tree.id}`}
              className="flex w-full items-center gap-3 rounded-card border border-tunnel-line bg-bg-surface p-3
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-accent-plasma/30">
              {/* Tap the student → profile */}
              <button onClick={() => navigate(`/coach/students/${student.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]">
                <Avatar user={student} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-primary">{student.name}</div>
                  <ProgressBar percent={st.percent} className="my-1.5" />
                  <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                    <span className="truncate">{tree.emoji} {tree.title}</span>
                    <span>·</span> {st.completed}/{st.total}
                    {st.pendingReview > 0 && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning ring-1 ring-warning/30">{st.pendingReview} новых</span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button onClick={() => navigate(`/coach/students/${student.id}/tree/${tree.id}`)} title="Дерево ученика"
                  className="rounded-lg border border-tunnel-line p-2 text-ink-secondary transition hover:border-accent-plasma/40 active:scale-90" aria-label="Дерево ученика">
                  <TreeIcon className="w-4 h-4" />
                </button>
                <button onClick={() => navigate(`/coach/chat?c=${student.id}:${tree.id}`)} title="Чат с учеником"
                  className="rounded-lg border border-tunnel-line p-2 text-accent-plasma transition hover:border-accent-plasma/40 active:scale-90" aria-label="Чат с учеником">
                  <ChatIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {roster.length === 0 && (
          <p className="text-sm text-ink-muted">Пока нет учеников — поделитесь инвайт-ссылкой на своё дерево.</p>
        )}
      </div>
    </Screen>
  );
}
