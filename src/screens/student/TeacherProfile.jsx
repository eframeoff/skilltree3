import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { Card, Avatar, Screen, TreeEmblem, btn } from '../../components/ui.jsx';
import { BackIcon, TreeIcon, ChatIcon } from '../../components/icons.jsx';

// A coach's profile as a student sees it: who they are + their programs.
export default function TeacherProfile() {
  const { coachId } = useParams();
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const coach = getUser(coachId);
  if (!coach) return <Screen><p className="text-ink-secondary">Тренер не найден.</p></Screen>;

  const programs = store.treeList().filter((t) => t.authorId === coachId && t.status === 'published');

  return (
    <Screen wide>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-ink-secondary transition hover:text-ink-primary active:scale-90"><BackIcon /></button>
        <h1 className="font-display text-lg font-bold text-ink-primary">Профиль тренера</h1>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <Avatar user={coach} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold text-ink-primary">{coach.name}</div>
            <div className="text-xs text-ink-secondary">{coach.headline || 'Тренер'}</div>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Программы тренера</div>
        {programs.length === 0 ? (
          <p className="text-sm text-ink-muted">У тренера пока нет опубликованных программ.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {programs.map((tree) => {
              const enrolled = store.isEnrolled(user.id, tree.id);
              return (
                <Card key={tree.id}>
                  <div className="mb-3 flex items-start gap-3">
                    <TreeEmblem tree={tree} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink-primary">{tree.title}</div>
                      <div className="text-xs text-ink-secondary">{tree.category} · {tree.nodes.length} навыков</div>
                    </div>
                  </div>
                  {enrolled ? (
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/app/tree/${tree.id}`)} className={`${btn.primary} flex-1`}>
                        <TreeIcon className="w-5 h-5" /> Открыть
                      </button>
                      <button onClick={() => navigate(`/app/chat?c=${tree.id}`)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-tunnel-line px-3 text-sm text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
                        <ChatIcon className="w-5 h-5" /> Чат
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { store.enroll(user.id, tree.id); navigate(`/app/tree/${tree.id}`); }}
                      className={`${btn.gold} w-full`}>Записаться</button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </Screen>
  );
}
