import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { getUser } from '../data/users.js';
import { Avatar, TreeEmblem, btn } from '../components/ui.jsx';

// Invite-link landing: /join/:treeId — the coach shares this with students.
export default function JoinScreen() {
  const { treeId } = useParams();
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const tree = store.tree(treeId);

  if (!tree || tree.status !== 'published') return <Navigate to="/login" replace />;
  // Not signed in yet → pick a profile first (prototype has no real auth).
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') {
    return (
      <div className="aurora-bg flex min-h-[100dvh] w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-ink-secondary">Инвайт-ссылки предназначены для учеников.</p>
        <button onClick={() => navigate('/coach')} className={btn.primary}>В кабинет автора</button>
      </div>
    );
  }

  const author = getUser(tree.authorId);
  const join = () => {
    store.enroll(user.id, treeId);
    navigate(`/app/tree/${treeId}`);
  };

  return (
    <div className="aurora-bg flex min-h-[100dvh] w-full items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-card border border-tunnel-line bg-bg-surface/85 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_rgba(0,0,0,0.5)]">
        <TreeEmblem tree={tree} size={80} />
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">Приглашение в дерево</div>
          <h1 className="font-display text-xl font-bold text-ink-primary">{tree.title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{tree.description}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-tunnel-line bg-bg-void/60 px-3 py-1.5 text-sm text-ink-secondary">
          <Avatar user={author} size={26} /> Тренер: <span className="text-ink-primary">{author?.name}</span>
        </div>
        <button onClick={join} className={`${btn.primary} w-full py-3`}>
          {store.isEnrolled(user.id, treeId) ? 'Открыть дерево' : 'Принять приглашение'}
        </button>
      </div>
    </div>
  );
}
