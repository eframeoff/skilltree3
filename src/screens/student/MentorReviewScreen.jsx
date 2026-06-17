import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { Card, StatusPill, Avatar, Screen } from '../../components/ui.jsx';
import StarRating from '../../components/StarRating.jsx';
import VideoPlayerPlaceholder from '../../components/VideoPlayerPlaceholder.jsx';

// A learner who the coach promoted to mentor reviews delegated attempts here.
// Boss/checkpoint exams never reach this queue (they aren't delegable); grades
// on `provisional` nodes go to the coach for confirmation.
export default function MentorReviewScreen() {
  const { user } = useAuth();
  const store = useStore();
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1600); };

  const queue = store.videosForMentor(user.id);
  const titleOf = (v) => store.nodeOf(v.treeId, v.nodeId)?.title || '—';
  const treeEmoji = (v) => store.tree(v.treeId)?.emoji || '🌳';

  const accept = (v, stars) => {
    const node = store.nodeOf(v.treeId, v.nodeId);
    const provisional = node?.delegation?.mode === 'provisional';
    store.acceptVideo(v.id, stars, { id: user.id, role: 'mentor', provisional });
    flash(provisional ? `✅ Принято на ${stars}★ — уйдёт тренеру на подтверждение` : `✅ Принято на ${stars}★`);
  };

  const reject = (v) => {
    const reason = window.prompt('Причина (ученик увидит её в чате узла):');
    if (!reason?.trim()) return;
    store.rejectVideo(v.id, reason.trim(), { id: user.id, role: 'mentor' });
    store.sendMessage(v.treeId, v.studentId, v.nodeId, {
      id: `m-${Date.now()}`,
      senderId: user.id,
      name: user.name.split(' ')[0],
      body: `❌ Попытка отклонена. Причина: ${reason.trim()}`,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    flash('↩ Отклонено — причина отправлена в чат');
  };

  return (
    <Screen wide>
      <h1 className="font-display text-lg font-bold text-ink-primary">Проверка как наставник</h1>
      <p className="text-sm text-ink-secondary">
        Тренер доверил вам проверку доступных навыков. Зачёты-контрольные точки остаются за тренером.
      </p>

      {queue.length === 0 && <p className="text-sm text-ink-muted">Нет попыток на проверку — всё разобрано! 🎉</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {queue.map((v) => (
          <Card key={v.id} className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <Avatar user={getUser(v.studentId)} size={28} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink-primary">{getUser(v.studentId)?.name}</div>
                <div className="text-[11px] text-ink-secondary">{treeEmoji(v)} {titleOf(v)}</div>
              </div>
              <StatusPill status={v.status} />
            </div>
            <VideoPlayerPlaceholder thumb={v.thumb} label={v.label} duration={v.duration} onPlay={() => flash(`▶ ${v.label}`)} />
            <div className="mt-3 space-y-2 rounded-xl bg-bg-void p-2.5 ring-1 ring-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-primary/90">Принять с оценкой</span>
                <StarRating value={0} onRate={(s) => accept(v, s)} />
              </div>
              <button onClick={() => reject(v)}
                className="w-full rounded-lg border border-danger/50 py-2 text-sm text-rose-300 transition hover:bg-danger/10 active:scale-95">
                Отклонить попытку
              </button>
            </div>
          </Card>
        ))}
      </div>

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
