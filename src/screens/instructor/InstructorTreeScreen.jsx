import { useNavigate, useParams } from 'react-router-dom';
import { getUser } from '../../data/users.js';
import { useStore } from '../../context/StoreContext.jsx';
import TreeView from '../../components/TreeView.jsx';
import { BackIcon } from '../../components/icons.jsx';

// Coach inspecting a student's tree (read + grade).
export default function InstructorTreeScreen() {
  const { id, treeId } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const student = getUser(id);
  const tree = store.tree(treeId);

  return (
    <div className="relative h-full w-full">
      {/* floating back / context bar */}
      <div className="glass absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5">
        <button onClick={() => navigate(`/coach/students/${id}`)} className="text-ink-primary transition hover:text-accent-plasma active:scale-90">
          <BackIcon className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-ink-primary">{tree?.emoji} {student?.name}</span>
      </div>
      <TreeView treeId={treeId} studentId={id} viewerRole="instructor" />
    </div>
  );
}
