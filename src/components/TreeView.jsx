import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SkillTree from './SkillTree.jsx';
import NodeDetail from './NodeDetail.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { uploadAttemptFile, partKind } from '../data/media.js';

// Reusable skill-tree screen body for ANY tree. Works for a student playing
// their own tree or a coach inspecting a student's tree (viewerRole switches
// the available actions: upload/quiz vs grading).
export default function TreeView({ treeId, studentId, viewerRole = 'student' }) {
  const { user } = useAuth();
  const store = useStore();
  // Render the published snapshot students actually study, not the live draft.
  const tree = store.viewTree(treeId);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(null); // coach node context menu {node,x,y}
  const [sp] = useSearchParams();

  // Deep-link a node (e.g. clicking an activity chip in chat → ?n=<nodeId>).
  useEffect(() => { const n = sp.get('n'); if (n) setActiveId(n); }, [sp]);

  if (!tree) return <div className="p-6 text-slate-400">Дерево не найдено.</div>;

  const nodes = store.nodesFor(studentId, treeId);
  const edges = store.edgesOf(treeId);
  const activeNode = nodes.find((n) => n.id === activeId) || null;
  const prereqTitles = activeNode
    ? activeNode.prereqs.map((p) => nodes.find((n) => n.id === p)?.title).filter(Boolean)
    : [];

  // videosByNode map for the current student (for thumbnails on nodes)
  const videosByNode = {};
  for (const v of store.videosFor(studentId, treeId)) (videosByNode[v.nodeId] ||= []).push(v);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const handleSend = (text) => {
    store.sendMessage(treeId, studentId, activeId, {
      id: `m-${Date.now()}`,
      senderId: user.id,
      name: user.name.split(' ')[0],
      body: text,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  // Who is reviewing: head coach vs a student-mentor (Phase 5 scopes this).
  const reviewer = { id: user.id, role: viewerRole === 'instructor' ? 'coach' : 'mentor' };

  // Rate the video only (does not complete the node).
  const handleAccept = (videoId, stars) => {
    store.acceptVideo(videoId, stars, reviewer);
    flash(`⭐ Оценка видео: ${stars}★`);
  };

  // Explicit зачёт / снять зачёт (the coach decides completion).
  const handleComplete = (rating) => {
    store.markComplete(studentId, treeId, activeId, { rating, reviewer });
    flash('✅ Узел зачтён');
  };
  const handleClear = () => {
    store.clearComplete(studentId, treeId, activeId, reviewer);
    flash('↩ Зачёт снят');
  };

  const handleReject = (videoId, reason) => {
    store.rejectVideo(videoId, reason, reviewer);
    store.sendMessage(treeId, studentId, activeId, {
      id: `m-${Date.now()}`,
      senderId: user.id,
      name: user.name.split(' ')[0],
      body: `❌ Попытка отклонена. Причина: ${reason}`,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    flash('↩ Попытка отклонена — причина отправлена в чат узла');
  };

  const handleUpload = async (type, { file = null, note = '' } = {}) => {
    const parts = [];
    if (file) {
      flash('⏳ Загрузка файла…');
      try {
        const storagePath = await uploadAttemptFile(file, studentId);
        parts.push({ kind: partKind(file), payload: { storagePath, mime: file.type, name: file.name } });
      } catch (e) {
        flash(`⚠ ${e.message || 'Не удалось загрузить файл'}`);
        return;
      }
    }
    if (note) parts.push({ kind: 'text', payload: note });
    store.submitVideo(studentId, treeId, activeId, type, parts);
    flash(type === 'exam' ? '📤 Зачёт отправлен тренеру на проверку' : '📤 Черновик отправлен тренеру');
  };

  // Coach records an in-person pass (live nodes have no student upload).
  const handleAttestLive = (rating) => {
    store.attestLive(studentId, treeId, activeId, { rating, reviewer });
    flash(rating ? `✅ Очная сдача принята на ${rating}★` : '✅ Очная сдача отмечена');
  };

  const handleQuizPass = () => {
    store.completeTest(studentId, treeId, activeId);
    flash('✅ Тест пройден — следующие узлы открыты!');
  };

  return (
    <div className="relative h-full w-full">
      <SkillTree
        tree={tree}
        nodes={nodes}
        edges={edges}
        videosByNode={videosByNode}
        onNodeClick={(n) => setActiveId(n.id)}
        onReveal={(titles) => flash(`✨ Открыт навык: ${titles[0]}${titles.length > 1 ? ` +${titles.length - 1}` : ''}`)}
        onNodeContext={viewerRole === 'instructor' ? (n, e) => setMenu({ node: n, x: e.clientX, y: e.clientY }) : undefined}
      />

      {/* Coach quick actions — right-click a node to зачесть without opening it */}
      {menu && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="glass fixed z-[56] w-52 overflow-hidden rounded-xl border border-white/10 py-1 text-sm shadow-2xl"
            style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 160) }}>
            <div className="truncate px-3 py-1.5 text-[11px] text-ink-muted">{menu.node.title}</div>
            <button onClick={() => { setActiveId(menu.node.id); setMenu(null); }}
              className="block w-full px-3 py-2 text-left text-ink-primary transition hover:bg-white/5">Открыть</button>
            {menu.node.status !== 'completed' ? (
              <button onClick={() => { store.markComplete(studentId, treeId, menu.node.id, { rating: menu.node.rating || null, reviewer }); flash('✅ Узел зачтён'); setMenu(null); }}
                className="block w-full px-3 py-2 text-left text-skill-gold transition hover:bg-white/5">Зачесть выполнение</button>
            ) : (
              <button onClick={() => { store.clearComplete(studentId, treeId, menu.node.id, reviewer); flash('↩ Зачёт снят'); setMenu(null); }}
                className="block w-full px-3 py-2 text-left text-ink-secondary transition hover:bg-white/5">Снять зачёт</button>
            )}
          </div>
        </>
      )}

      {activeNode && (
        <NodeDetail
          key={activeNode.id}
          node={activeNode}
          videos={videosByNode[activeNode.id] || []}
          messages={store.messagesFor(treeId, studentId, activeId)}
          viewerRole={viewerRole}
          prereqTitles={prereqTitles}
          onClose={() => setActiveId(null)}
          onSend={handleSend}
          onPlay={(v) => flash(`▶ Воспроизведение «${v.label}» (${v.duration})`)}
          onUpload={handleUpload}
          onAttestLive={handleAttestLive}
          onAccept={handleAccept}
          onComplete={handleComplete}
          onClear={handleClear}
          onReject={handleReject}
          onQuizPass={handleQuizPass}
          onToggleComp={(id) => store.toggleCompilation(id)}
        />
      )}

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
