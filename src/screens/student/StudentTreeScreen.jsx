import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import TreeView from '../../components/TreeView.jsx';
import { BackIcon, ChatIcon } from '../../components/icons.jsx';

export default function StudentTreeScreen() {
  const { treeId } = useParams();
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const tree = store.tree(treeId);

  if (!tree || !store.isEnrolled(user.id, treeId)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-ink-secondary">Вы не записаны на это дерево.</p>
        <button onClick={() => navigate('/app/catalog')}
          className="rounded-xl bg-accent-plasma px-4 py-2.5 text-sm font-bold text-black shadow-[0_4px_18px_rgba(45,212,255,0.28)] transition hover:brightness-110 active:scale-95">
          Открыть каталог
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* floating context bar */}
      <div className="glass absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5">
        <button onClick={() => navigate('/app')} className="text-ink-primary transition hover:text-accent-plasma active:scale-90" aria-label="Назад">
          <BackIcon className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-ink-primary">{tree.emoji} {tree.title}</span>
        <button onClick={() => navigate(`/app/chat?c=${treeId}`)}
          className="ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-sm text-accent-plasma transition hover:bg-white/5 active:scale-95" aria-label="Чат с тренером">
          <ChatIcon className="w-4 h-4" /> Чат
        </button>
      </div>
      <TreeView treeId={treeId} studentId={user.id} viewerRole="student" />
    </div>
  );
}
