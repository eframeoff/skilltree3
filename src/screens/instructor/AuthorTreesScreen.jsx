import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { Card, Screen, TreeEmblem, btn } from '../../components/ui.jsx';
import { PlusIcon, PencilIcon, LinkIcon, TrashIcon } from '../../components/icons.jsx';

// Author's portfolio of trees: create, edit, share, publish.
export default function AuthorTreesScreen() {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const myTrees = store.myTrees(user.id);

  const create = () => {
    const id = store.createTree(user.id);
    navigate(`/coach/trees/${id}/edit`);
  };

  const removeTree = (tree) => {
    const students = store.studentsOnTree(tree.id).length;
    const warn = students > 0 ? ` Прогресс ${students} учеников будет потерян.` : '';
    if (!window.confirm(`Удалить дерево «${tree.title}»?${warn} Это действие необратимо.`)) return;
    store.deleteTree(tree.id);
    flash(`🗑 Дерево «${tree.title}» удалено`);
  };

  const copyInvite = (treeId) => {
    const url = `${window.location.origin}${window.location.pathname}#/join/${treeId}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => flash('🔗 Инвайт-ссылка скопирована'), () => flash(url));
    } else flash(url);
  };

  return (
    <Screen wide>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold text-ink-primary">Мои деревья ({myTrees.length})</h1>
          <p className="text-sm text-ink-secondary">No-Code конструктор программ обучения</p>
        </div>
        <button onClick={create} className={`${btn.primary} !py-2`}>
          <PlusIcon className="w-4 h-4" /> Создать
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {myTrees.map((tree) => {
          const students = store.studentsOnTree(tree.id).length;
          const exams = tree.nodes.filter((n) => n.type === 'exam').length;
          return (
            <Card key={tree.id} className="transition hover:border-accent-plasma/30">
              <div className="mb-3 flex items-start gap-3">
                <TreeEmblem tree={tree} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-primary">{tree.title}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      tree.status === 'published'
                        ? 'bg-success/15 text-success ring-1 ring-success/30'
                        : 'bg-white/5 text-ink-secondary ring-1 ring-white/10'
                    }`}>
                      {tree.status === 'published' ? 'опубликовано' : 'черновик'}
                    </span>
                    <span className="text-[11px] text-ink-muted">{tree.category}</span>
                  </div>
                </div>
              </div>

              <div className="mb-3 font-mono text-[11px] text-ink-muted">
                {tree.nodes.length} узлов · {exams} зачётов · {tree.levels.length} уровней · {students} учеников
              </div>

              <div className="flex gap-2">
                <button onClick={() => navigate(`/coach/trees/${tree.id}/edit`)} className={`${btn.primary} flex-1`}>
                  <PencilIcon className="w-4 h-4" /> Редактор
                </button>
                <button onClick={() => copyInvite(tree.id)} aria-label="Инвайт-ссылка"
                  className="rounded-xl border border-tunnel-line px-3 text-accent-plasma transition hover:border-accent-plasma/40 active:scale-95">
                  <LinkIcon className="w-4 h-4" />
                </button>
                <button onClick={() => removeTree(tree)} aria-label="Удалить дерево"
                  className="rounded-xl border border-danger/40 px-3 text-rose-400 transition hover:bg-danger/10 active:scale-95">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </Card>
          );
        })}

        {/* Create card */}
        <button onClick={create}
          className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-tunnel-line text-ink-muted transition-colors hover:border-accent-plasma hover:text-accent-plasma active:scale-[0.99]">
          <PlusIcon className="w-8 h-8" />
          <span className="text-sm font-medium">Новое дерево навыков</span>
        </button>
      </div>

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
