import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { Card, StatusPill, Screen, SectionTitle, btn } from '../../components/ui.jsx';
import StarRating from '../../components/StarRating.jsx';
import VideoPlayerPlaceholder from '../../components/VideoPlayerPlaceholder.jsx';
import { ShareIcon, VideoIcon } from '../../components/icons.jsx';

// Cross-tree portfolio: every approved clip is proof of a real-life skill.
export default function StudentVideosScreen() {
  const { user } = useAuth();
  const store = useStore();
  const videos = store.videosFor(user.id);
  const [toast, setToast] = useState(null);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1600); };

  const skillTitle = (v) => store.nodeOf(v.treeId, v.nodeId)?.title || '—';
  const treeEmoji = (v) => store.tree(v.treeId)?.emoji || '🌳';

  const approved = videos.filter((v) => v.status === 'approved');
  const pending = videos.filter((v) => v.status === 'pending');
  const reelCount = videos.filter((v) => v.compilation_ready).length;

  return (
    <Screen wide>
      <div>
        <h1 className="font-display text-lg font-bold text-ink-primary">Мои видео</h1>
        <p className="text-sm text-ink-secondary">
          Видео-паспорт ваших навыков · {reelCount} в подборке
        </p>
      </div>

      {/* Highlight reel banner — the one gold moment on this screen */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-skill-gold/15 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-skill-gold/15 text-skill-gold ring-1 ring-skill-gold/30">
              <VideoIcon className="w-5 h-5" />
            </span>
            <div>
              <div className="font-semibold text-ink-primary">Подборка лучших моментов</div>
              <div className="text-xs text-ink-secondary">{reelCount} клипов готово к авто-нарезке для соцсетей</div>
            </div>
          </div>
          <button onClick={() => flash('🚀 Нарезка поставлена в очередь (Фаза 2)')}
            className={`${btn.gold} shrink-0 !py-2 !text-xs`}>
            Создать
          </button>
        </div>
      </Card>

      {pending.length > 0 && (
        <section>
          <SectionTitle>На проверке</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {pending.map((v) => (
              <div key={v.id}>
                <VideoPlayerPlaceholder thumb={v.thumb} label={v.label} duration={v.duration} onPlay={() => flash(`▶ ${v.label}`)} />
                <div className="mt-1 flex items-center justify-between">
                  <span className="truncate text-xs text-ink-secondary">{treeEmoji(v)} {skillTitle(v)}</span>
                  <StatusPill status={v.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Освоенные навыки ({approved.length})</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {approved.length === 0 && <p className="text-sm text-ink-muted">Пока нет одобренных видео.</p>}
          {approved.map((v) => (
            <Card key={v.id} className="p-3">
              <VideoPlayerPlaceholder thumb={v.thumb} label={v.type === 'exam' ? 'Зачёт' : 'Практика'} duration={v.duration} onPlay={() => flash(`▶ ${skillTitle(v)}`)} />
              <div className="mt-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink-primary">{treeEmoji(v)} {skillTitle(v)}</div>
                  {v.type === 'exam' && v.rating > 0 && <StarRating value={v.rating} size="w-3.5 h-3.5" />}
                </div>
                <button onClick={() => flash('🔗 Опубликовано в соцсетях (Фаза 2)')} aria-label="Поделиться"
                  className="shrink-0 rounded-lg border border-tunnel-line p-2 text-accent-plasma transition hover:border-accent-plasma/40 active:scale-90">
                  <ShareIcon className="w-4 h-4" />
                </button>
              </div>
              <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg bg-bg-void px-3 py-2 ring-1 ring-white/5">
                <span className="text-xs text-ink-secondary">Добавить в подборку</span>
                <input type="checkbox" checked={!!v.compilation_ready} onChange={() => store.toggleCompilation(v.id)} className="h-4 w-4 accent-skill-gold" />
              </label>
            </Card>
          ))}
        </div>
      </section>

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
