import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { getUser } from '../../data/users.js';
import { isBoss, submitKinds, gradeMode, SUBMIT_LABELS } from '../../data/treeUtils.js';
import { Card, StatusPill, Avatar, Screen, btn } from '../../components/ui.jsx';
import StarRating from '../../components/StarRating.jsx';
import AttemptMedia from '../../components/AttemptMedia.jsx';
import { ShareIcon, VideoIcon, ClockIcon } from '../../components/icons.jsx';

const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Wait time since submission — drives the "oldest first" queue and a conscience nudge.
function waitLabel(createdAt) {
  if (!createdAt) return 'давно';
  const h = Math.floor((Date.now() - createdAt) / 3600000);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

// One-tap praise presets so accepting isn't a silent star-tap.
const PRAISE = ['Чисто!', 'Отличный темп', 'Стало заметно лучше', 'Следи за техникой'];

export default function InstructorVideosScreen() {
  const { user } = useAuth();
  const store = useStore();
  const [tab, setTab] = useState('review');
  const [filterTree, setFilterTree] = useState('all');
  const [groupByNode, setGroupByNode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1600); };

  const mine = store.videosForCoach(user.id);
  const provisional = mine.filter((v) => v.status === 'approved' && v.provisional);
  const reel = mine.filter((v) => v.compilation_ready || v.is_featured);
  const live = store.liveDue(user.id);

  const attestLive = (item, rating) => {
    store.attestLive(item.studentId, item.treeId, item.node.id, { rating, reviewer: { id: user.id, role: 'coach' } });
    flash(rating ? `✅ Очно принято на ${rating}★` : '✅ Очная сдача отмечена');
  };

  // Grade-leniency: a mentor's average stars vs the coach's own baseline,
  // so grade inflation is visible at confirmation time.
  const avgRating = (pred) => {
    const r = mine.filter((v) => v.status === 'approved' && v.rating > 0 && pred(v));
    return r.length ? r.reduce((s, v) => s + v.rating, 0) / r.length : null;
  };
  const coachAvg = avgRating((v) => !v.reviewerRole || v.reviewerRole === 'coach');

  const nodeOf = (v) => store.nodeOf(v.treeId, v.nodeId);
  const titleOf = (v) => nodeOf(v)?.title || '—';
  const treeEmoji = (v) => store.tree(v.treeId)?.emoji || '🌳';
  const studentName = (v) => getUser(v.studentId)?.name;
  const formatLabel = (v) => {
    const node = nodeOf(v);
    if (node && isBoss(node)) return 'Зачёт';
    const k = node ? submitKinds(node).find((x) => x !== 'none') : null;
    return SUBMIT_LABELS[k] || 'Практика';
  };

  // Oldest-first queue (the conscience: longest-waiting student goes first).
  const pendingAll = mine
    .filter((v) => v.status === 'pending')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const treeIds = [...new Set(pendingAll.map((v) => v.treeId))];
  const queue = pendingAll.filter((v) => filterTree === 'all' || v.treeId === filterTree);
  const current = queue.find((v) => v.id === selectedId) || queue[0] || null;
  const idx = current ? queue.findIndex((v) => v.id === current.id) : -1;
  const grouped = queue.reduce((acc, v) => { (acc[v.nodeId] ||= []).push(v); return acc; }, {});

  const renderRow = (v) => (
    <button key={v.id} onClick={() => { setSelectedId(v.id); setRejecting(false); }}
      className={`flex items-center gap-2 rounded-xl p-2 text-left transition ${
        current?.id === v.id ? 'bg-accent-plasma/10 ring-1 ring-accent-plasma/40' : 'hover:bg-white/5'
      }`}>
      <Avatar user={getUser(v.studentId)} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink-primary">{studentName(v)}</div>
        <div className="truncate text-[11px] text-ink-secondary">{treeEmoji(v)} {titleOf(v)}</div>
      </div>
      <span className="shrink-0 text-[10px] text-ink-muted">{waitLabel(v.createdAt)}</span>
    </button>
  );

  const postChat = (v, body) =>
    store.sendMessage(v.treeId, v.studentId, v.nodeId, {
      id: `m-${Date.now()}`, senderId: user.id, name: user.name.split(' ')[0], body, at: time(),
    });

  const accept = (stars) => {
    if (!current) return;
    const c = comment.trim();
    store.acceptVideo(current.id, stars, { id: user.id, role: 'coach' }, c);
    if (c) postChat(current, `Принято на ${stars}★. ${c}`);
    flash(`✅ ${studentName(current)}: ${stars}★`);
    setComment(''); setRejecting(false); setSelectedId(null);
  };

  const submitReject = () => {
    if (!current || !reason.trim()) return;
    store.rejectVideo(current.id, reason.trim(), { id: user.id, role: 'coach' });
    postChat(current, `❌ Попытка отклонена. Причина: ${reason.trim()}`);
    flash('↩ Отклонено — причина отправлена в чат');
    setReason(''); setRejecting(false); setSelectedId(null);
  };

  const go = (d) => { if (queue.length) setSelectedId(queue[(idx + d + queue.length) % queue.length].id); };

  // Keyboard review: 1–5 grade, R reject, ←/→ navigate. Ignored while typing.
  useEffect(() => {
    if (tab !== 'review' || !current) return;
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
        if (e.key === 'Escape') { setRejecting(false); t.blur(); }
        return;
      }
      if (e.key >= '1' && e.key <= '5') { e.preventDefault(); accept(Number(e.key)); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); setRejecting(true); }
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bind each render so accept()/go() see the latest current/comment

  const quickReject = (v) => {
    const r = window.prompt('Причина отказа (ученик увидит её в чате узла):');
    if (!r?.trim()) return;
    store.rejectVideo(v.id, r.trim(), { id: user.id, role: 'coach' });
    postChat(v, `❌ Попытка отклонена. Причина: ${r.trim()}`);
    flash('↩ Попытка отклонена');
  };

  return (
    <Screen wide>
      <h1 className="font-display text-lg font-bold text-ink-primary">Проверка видео</h1>

      <div className="flex rounded-xl border border-tunnel-line bg-bg-void p-1">
        {[['review', `Проверка (${pendingAll.length})`], ['confirm', `Подтвердить (${provisional.length})`], ['live', `Очно (${live.length})`], ['reel', `Подборка (${reel.length})`]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition sm:text-sm ${
              tab === k ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'text-ink-muted hover:text-ink-secondary'
            }`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ───── Focused review: list (lg) + one-at-a-time ───── */}
      {tab === 'review' && (
        pendingAll.length === 0 ? (
          <p className="text-sm text-ink-muted">Нечего проверять — всё разобрано! 🎉</p>
        ) : (
          <div className="lg:grid lg:grid-cols-[300px,1fr] lg:gap-4">
            {/* Queue list */}
            <div className="mb-4 flex flex-col gap-2 lg:mb-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {treeIds.length > 1 && ['all', ...treeIds].map((tid) => (
                  <button key={tid} onClick={() => setFilterTree(tid)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      filterTree === tid ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'border border-tunnel-line text-ink-muted'
                    }`}>
                    {tid === 'all' ? 'Все' : store.tree(tid)?.emoji + ' ' + store.tree(tid)?.title}
                  </button>
                ))}
                <button onClick={() => setGroupByNode((g) => !g)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    groupByNode ? 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/40' : 'border border-tunnel-line text-ink-muted'
                  }`}>
                  По узлам
                </button>
              </div>
              <div className="hidden max-h-[70vh] flex-col gap-1.5 overflow-y-auto no-scrollbar lg:flex">
                {!groupByNode
                  ? queue.map(renderRow)
                  : Object.entries(grouped).map(([nid, vids]) => (
                      <div key={nid} className="space-y-1.5">
                        <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                          {store.nodeOf(vids[0].treeId, nid)?.title || '—'} · {vids.length}
                        </div>
                        {vids.map(renderRow)}
                      </div>
                    ))}
              </div>
            </div>

            {/* Focused item */}
            {current && (
              <Card className="p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar user={getUser(current.studentId)} size={32} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-ink-primary">{studentName(current)}</div>
                    <div className="text-[11px] text-ink-secondary">{treeEmoji(current)} {titleOf(current)}</div>
                  </div>
                  <span className="rounded-full bg-bg-void px-2 py-0.5 text-[10px] font-semibold text-ink-muted ring-1 ring-white/10">{formatLabel(current)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-warning"><ClockIcon className="w-3.5 h-3.5" /> {waitLabel(current.createdAt)}</span>
                </div>

                <AttemptMedia attempt={current} label={current.label} onPlay={() => flash(`▶ ${current.label}`)} />

                {/* Combined-attempt text parts (e.g. the student's note) */}
                {(current.parts || []).filter((p) => p.kind === 'text' && p.payload).map((p, i) => (
                  <p key={i} className="mt-2 rounded-lg bg-bg-void p-2.5 text-xs italic text-ink-secondary ring-1 ring-white/5">«{p.payload}»</p>
                ))}

                <div className="mt-3 space-y-2 rounded-xl bg-bg-void p-2.5 ring-1 ring-white/5">
                  {!rejecting ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {PRAISE.map((p) => (
                          <button key={p} onClick={() => setComment((c) => (c ? c : p))}
                            className="rounded-full border border-tunnel-line px-2.5 py-1 text-[11px] text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
                            {p}
                          </button>
                        ))}
                      </div>
                      <input value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder="Комментарий к приёмке (необязательно)…"
                        className="w-full rounded-lg border border-tunnel-line bg-tunnel-bg px-3 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-primary/90">Принять с оценкой</span>
                        <StarRating value={0} onRate={accept} />
                      </div>
                      <button onClick={() => setRejecting(true)}
                        className="w-full rounded-lg border border-danger/50 py-2 text-sm text-rose-300 transition hover:bg-danger/10 active:scale-95">
                        Отклонить попытку
                      </button>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted">
                        <span>{idx + 1} из {queue.length} · клавиши 1–5, R, ← →</span>
                        <span className="flex gap-2">
                          <button onClick={() => go(-1)} className="rounded px-2 py-0.5 hover:text-ink-secondary">← Назад</button>
                          <button onClick={() => go(1)} className="rounded px-2 py-0.5 hover:text-ink-secondary">Дальше →</button>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
                        placeholder="Причина отказа — ученик сразу увидит её в чате узла…"
                        className="min-h-[72px] w-full rounded-xl border border-tunnel-line bg-tunnel-bg px-3 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-rose-400 focus:outline-none" />
                      <div className="flex gap-2">
                        <button disabled={!reason.trim()} onClick={submitReject}
                          className="flex-1 rounded-lg bg-danger py-2 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40">
                          Отклонить и отправить в чат
                        </button>
                        <button onClick={() => { setRejecting(false); setReason(''); }}
                          className="rounded-lg border border-tunnel-line px-3 py-2 text-sm text-ink-secondary transition active:scale-95">
                          Отмена
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
        )
      )}

      {/* ───── Confirm mentor (provisional) grades ───── */}
      {tab === 'confirm' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {provisional.length === 0 && <p className="text-sm text-ink-muted">Нет оценок наставников на подтверждение.</p>}
          {provisional.map((v) => (
            <Card key={v.id} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Avatar user={getUser(v.studentId)} size={28} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-primary">{studentName(v)}</div>
                  <div className="text-[11px] text-ink-secondary">
                    {treeEmoji(v)} {titleOf(v)} · наставник: {getUser(v.reviewerId)?.name || '—'}
                  </div>
                  {(() => {
                    const mAvg = avgRating((x) => x.reviewerId === v.reviewerId);
                    if (mAvg == null || coachAvg == null) return null;
                    const lenient = mAvg - coachAvg >= 0.7;
                    return (
                      <div className={`text-[10px] ${lenient ? 'text-warning' : 'text-ink-muted'}`}>
                        в среднем {mAvg.toFixed(1)}★ · вы {coachAvg.toFixed(1)}★{lenient ? ' — мягче вас' : ''}
                      </div>
                    );
                  })()}
                </div>
                {v.rating > 0 && <StarRating value={v.rating} size="w-4 h-4" />}
              </div>
              <AttemptMedia attempt={v} label={v.label} onPlay={() => flash(`▶ ${v.label}`)} />
              <div className="mt-3 flex gap-2">
                <button onClick={() => { store.confirmProvisional(v.id); flash('✅ Оценка наставника подтверждена'); }}
                  className={`${btn.primary} flex-1 !py-2`}>Подтвердить</button>
                <button onClick={() => quickReject(v)}
                  className="rounded-lg border border-danger/50 px-3 py-2 text-sm text-rose-300 transition hover:bg-danger/10 active:scale-95">
                  Отклонить
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ───── In-person attestations due ───── */}
      {tab === 'live' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {live.length === 0 && <p className="text-sm text-ink-muted">Нет навыков, ожидающих очной сдачи.</p>}
          {live.map((item) => (
            <Card key={`${item.studentId}-${item.node.id}`} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Avatar user={getUser(item.studentId)} size={28} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-primary">{getUser(item.studentId)?.name}</div>
                  <div className="text-[11px] text-ink-secondary">{store.tree(item.treeId)?.emoji} {item.node.title}</div>
                </div>
                <span className="rounded-full bg-bg-void px-2 py-0.5 text-[10px] font-semibold text-ink-muted ring-1 ring-white/10">очно</span>
              </div>
              {gradeMode(item.node) === 'stars-5' ? (
                <div className="flex items-center justify-between rounded-xl bg-bg-void p-2.5 ring-1 ring-white/5">
                  <span className="text-sm text-ink-primary/90">Принять с оценкой</span>
                  <StarRating value={0} onRate={(s) => attestLive(item, s)} />
                </div>
              ) : (
                <button onClick={() => attestLive(item, null)} className={`${btn.gold} w-full !py-2`}>Отметить пройденным</button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ───── Highlight reel ───── */}
      {tab === 'reel' && (
        <div className="space-y-3">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-skill-gold/15 via-transparent to-transparent" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-skill-gold/15 text-skill-gold ring-1 ring-skill-gold/30">
                  <VideoIcon className="w-5 h-5" />
                </span>
                <div>
                  <div className="font-semibold text-ink-primary">Подборка группы</div>
                  <div className="text-xs text-ink-secondary">{reel.length} клипов · авто-нарезка</div>
                </div>
              </div>
              <button onClick={() => flash('🚀 Нарезка поставлена в очередь (Фаза 2)')} className={`${btn.gold} shrink-0 !py-2 !text-xs`}>Создать</button>
            </div>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {reel.map((v) => (
              <Card key={v.id} className="p-3">
                <AttemptMedia attempt={v} label={titleOf(v)} onPlay={() => flash(`▶ ${titleOf(v)}`)} />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar user={getUser(v.studentId)} size={24} />
                    <div>
                      <div className="text-sm text-ink-primary">{studentName(v)}</div>
                      {v.rating > 0 && <StarRating value={v.rating} size="w-3 h-3" />}
                    </div>
                  </div>
                  <button onClick={() => flash('🔗 Опубликовано в соцсетях (Фаза 2)')}
                    className="flex items-center gap-1 rounded-lg border border-tunnel-line px-3 py-2 text-xs text-accent-plasma transition hover:border-accent-plasma/40 active:scale-90">
                    <ShareIcon className="w-4 h-4" /> Репост
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
