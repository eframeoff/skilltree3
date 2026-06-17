import { useState } from 'react';
import VideoPlayerPlaceholder from './VideoPlayerPlaceholder.jsx';
import AttemptMedia from './AttemptMedia.jsx';
import { GuideContent, FullscreenSheet, guideBlocks } from './Guide.jsx';
import ContextChat from './ContextChat.jsx';
import StarRating from './StarRating.jsx';
import { StatusPill, btn } from './ui.jsx';
import { isLiveNode, submitKinds, gradeMode } from '../data/treeUtils.js';
import {
  BackIcon, BookIcon, GradCapIcon, VideoIcon, ChatIcon, PlusIcon, LockIcon, CheckIcon, ClockIcon,
} from './icons.jsx';

const TYPE_LABEL = { test: 'Теория', practice: 'Практика', exam: 'Зачёт' };
const TYPE_ICON = { test: BookIcon, practice: VideoIcon, exam: GradCapIcon };
const STATUS_BADGE = {
  locked:      { text: 'Заблокировано', cls: 'bg-skill-locked/30 text-ink-secondary ring-1 ring-white/10' },
  available:   { text: 'Доступно',      cls: 'bg-accent-plasma/15 text-accent-plasma ring-1 ring-accent-plasma/30' },
  in_progress: { text: 'На проверке',   cls: 'bg-warning/15 text-warning ring-1 ring-warning/30' },
  completed:   { text: 'Пройдено',      cls: 'bg-skill-gold/15 text-skill-gold ring-1 ring-skill-gold/30' },
};

// Fallback instruction steps when the author hasn't written custom ones.
const DEFAULT_STEPS = [
  'Изучите видео-инструкцию и описание навыка.',
  'Повторите элемент медленно, контролируя каждое движение.',
  'Доведите выполнение до уверенного темпа.',
  'Запишите попытку на видео и отправьте тренеру.',
];

// One authored teach block (text or media). Media is a placeholder card until
// real upload/playback lands (Phase 7 / ADR-0001).
function TeachBlockView({ block, onPlay }) {
  const { kind, payload } = block;
  if (kind === 'text') {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-ink-primary/90">{payload}</p>;
  }
  if (kind === 'video') {
    const label = payload?.label || 'Видео-инструкция';
    return (
      <VideoPlayerPlaceholder thumb="#1e3a8a" label={label} duration={payload?.duration || ''}
        onPlay={() => onPlay?.({ label, duration: payload?.duration || '' })} />
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-bg-surface p-3 text-sm text-ink-secondary ring-1 ring-white/5">
      <VideoIcon className="w-4 h-4 shrink-0" />
      {payload?.label || ({ photo: 'Фото', audio: 'Аудио', file: 'Файл' }[kind] || kind)}
    </div>
  );
}

// Auto-checked quiz for 'test' nodes — the in-app «срез знаний».
function QuizBlock({ node, onPass }) {
  const quiz = node.quiz || [];
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null); // null | 'fail'
  const done = node.status === 'completed';

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
        <CheckIcon className="w-4 h-4" /> Тест пройден — узел зачтён.
      </div>
    );
  }
  if (node.status === 'locked') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-bg-surface p-3 text-sm text-ink-secondary ring-1 ring-white/5">
        <LockIcon className="w-4 h-4" /> Сначала откройте этот узел.
      </div>
    );
  }

  // Theory node without a quiz: a simple self-check confirmation.
  if (!quiz.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-primary/90">Изучите теорию во вкладке «Теория», затем отметьте узел пройденным.</p>
        <button onClick={onPass} className={`${btn.primary} w-full py-3`}>
          <CheckIcon className="w-4 h-4" /> Отметить изученным
        </button>
      </div>
    );
  }

  const submit = () => {
    const allCorrect = quiz.every((q, i) => answers[i] === q.answer);
    if (allCorrect) onPass();
    else setResult('fail');
  };

  return (
    <div className="space-y-4">
      {quiz.map((q, qi) => (
        <div key={qi} className="rounded-xl bg-bg-surface p-3 ring-1 ring-white/5">
          <div className="mb-2 text-sm font-semibold text-ink-primary">{qi + 1}. {q.q}</div>
          <div className="space-y-1.5">
            {q.options.map((opt, oi) => (
              <label key={oi}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  answers[qi] === oi
                    ? 'border-accent-plasma bg-accent-plasma/10 text-ink-primary'
                    : 'border-tunnel-line text-ink-secondary hover:border-accent-plasma/30'
                }`}>
                <input type="radio" name={`q-${node.id}-${qi}`} className="accent-accent-plasma"
                  checked={answers[qi] === oi}
                  onChange={() => { setAnswers((a) => ({ ...a, [qi]: oi })); setResult(null); }} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      {result === 'fail' && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-rose-300">
          Есть ошибки — перечитайте теорию и попробуйте ещё раз.
        </div>
      )}
      <button onClick={submit}
        disabled={Object.keys(answers).length < quiz.length}
        className={`${btn.gold} w-full py-3 disabled:opacity-40 disabled:shadow-none`}>
        Проверить ответы
      </button>
    </div>
  );
}

// Chronological history of every attempt at a node — turns the scattered
// drafts + chat rejections into one readable progression: try → reason → retry
// → pass. The coach's praise/reason lands on each attempt's `feedback`.
function AttemptTimeline({ videos, onPlay }) {
  const sorted = [...videos].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const dot = { approved: 'bg-success', rejected: 'bg-danger', pending: 'bg-warning' };
  return (
    <ol className="space-y-3">
      {sorted.map((v, i) => (
        <li key={v.id} className="relative pl-6">
          {i < sorted.length - 1 && <span className="absolute left-[6px] top-5 -bottom-3 w-px bg-tunnel-line" />}
          <span className={`absolute left-0 top-2 h-3.5 w-3.5 rounded-full ring-2 ring-bg-void ${dot[v.status] || 'bg-skill-locked'}`} />
          <div className="rounded-xl bg-bg-surface p-2.5 ring-1 ring-white/5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-ink-primary">Попытка {i + 1}{v.label ? ` · ${v.label}` : ''}</span>
              <div className="flex items-center gap-2">
                {v.rating > 0 && <StarRating value={v.rating} size="w-3.5 h-3.5" />}
                <StatusPill status={v.status} />
              </div>
            </div>
            <AttemptMedia attempt={v} label={v.label} onPlay={() => onPlay?.(v)} />
            {(v.parts || []).filter((p) => p.kind === 'text' && p.payload).map((p, pi) => (
              <p key={pi} className="mt-2 text-xs text-ink-secondary">📝 {p.payload}</p>
            ))}
            {v.feedback && (
              <p className={`mt-2 text-xs italic ${v.status === 'rejected' ? 'text-rose-300' : 'text-ink-secondary'}`}>«{v.feedback}»</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// Full-screen (mobile) / right-drawer (desktop) view for one tree node.
// Tabs: description, theory/video instruction, attempt-or-quiz, node chat.
export default function NodeDetail({
  node, videos, messages, viewerRole = 'student', prereqTitles = [],
  onClose, onSend, onPlay, onUpload, onAttestLive, onQuizPass, onToggleComp, onAccept, onComplete, onClear, onReject,
}) {
  const [tab, setTab] = useState('about');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [attView, setAttView] = useState('best');
  const [showGuide, setShowGuide] = useState(false);
  const [grade, setGrade] = useState(node.rating || 0);
  if (!node) return null;

  const isInstructor = viewerRole === 'instructor';
  const liveNode = isLiveNode(node);
  const isVideoNode = !submitKinds(node).includes('none') && !liveNode;
  const examVideo = videos.find((v) => v.type === 'exam');
  const drafts = videos.filter((v) => v.type === 'practice');
  const hasPending = videos.some((v) => v.status === 'pending');
  // "Best attempt" = approved exam if present, else latest draft.
  const bestAttempt =
    videos.find((v) => v.type === 'exam' && v.status === 'approved') ||
    examVideo || drafts[drafts.length - 1] || null;
  const badge = STATUS_BADGE[node.status];
  const chatAllowed = node.status !== 'locked';
  const steps = node.steps?.length ? node.steps : DEFAULT_STEPS;
  const teachBlocks = node.teach?.blocks || [];
  // The guide as a block list (text + media); coerces legacy shapes too.
  const guideList = guideBlocks(node);
  const pendingVideo = videos.find((v) => v.status === 'pending');
  const TypeIcon = TYPE_ICON[node.type] || BookIcon;

  // Coach review controls — live in the «Попытка» tab, right under the video:
  // accept with a 1–5★ grade, or reject with a reason that goes to the node chat.
  // Coach controls: rating the video is SEPARATE from completing the node.
  // Grading just records a star score; «Зачесть выполнение» is what passes the
  // node, and «Снять зачёт» reverses it.
  const coachReview = (isInstructor && isVideoNode && node.status !== 'locked') ? (
    <div className="space-y-3 rounded-xl border border-tunnel-line bg-bg-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Тренер</div>

      {bestAttempt && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-primary/90">Оценка видео</span>
          <StarRating value={grade} onRate={(s) => { setGrade(s); onAccept?.((pendingVideo || bestAttempt).id, s); }} />
        </div>
      )}

      {node.status === 'completed' ? (
        <button onClick={() => onClear?.()}
          className="w-full rounded-lg border border-tunnel-line py-2 text-sm text-ink-secondary transition hover:bg-white/5 active:scale-95">
          Снять зачёт
        </button>
      ) : !rejecting ? (
        <>
          <button onClick={() => onComplete?.(grade || null)} className={`${btn.gold} w-full !py-2.5`}>
            <CheckIcon className="w-4 h-4" /> Зачесть выполнение
          </button>
          {pendingVideo && (
            <button onClick={() => setRejecting(true)}
              className="w-full rounded-lg border border-danger/50 py-2 text-sm font-medium text-rose-300 transition hover:bg-danger/10 active:scale-95">
              Отклонить попытку
            </button>
          )}
        </>
      ) : (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
            placeholder="Причина отказа — ученик сразу увидит её в чате этого узла…"
            className="min-h-[72px] w-full rounded-xl border border-tunnel-line bg-bg-void px-3 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-rose-400 focus:outline-none" />
          <div className="flex gap-2">
            <button disabled={!reason.trim()}
              onClick={() => { onReject?.(pendingVideo.id, reason.trim()); setRejecting(false); setReason(''); }}
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
  ) : null;

  // Student upload (video nodes) — lives in the «Попытка» tab, not «Описание».
  const uploadArea = (!isInstructor && isVideoNode && node.status !== 'locked' && node.status !== 'completed') ? (
    hasPending ? (
      <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        <ClockIcon className="w-4 h-4 shrink-0" /> Отправлено — ждёт проверки тренера. Подсказки появятся в чате.
      </div>
    ) : (
      <div className="space-y-2 rounded-xl border border-tunnel-line bg-bg-surface p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Загрузить попытку</div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-tunnel-line py-3 text-sm text-ink-secondary transition hover:border-accent-plasma/40">
          <PlusIcon className="w-4 h-4" />
          <span className="truncate">{file ? file.name : 'Выбрать файл (видео / фото / аудио)'}</span>
          <input type="file" accept="video/*,image/*,audio/*,application/pdf" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Комментарий к попытке (необязательно)…"
          className="min-h-[56px] w-full rounded-xl border border-tunnel-line bg-bg-void px-3 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none" />
        <button disabled={!file}
          onClick={() => { onUpload?.(node.type === 'exam' ? 'exam' : 'practice', { file, note: note.trim() }); setNote(''); setFile(null); }}
          className={`${node.type === 'exam' ? btn.gold : btn.primary} w-full py-3 disabled:opacity-40`}>
          <PlusIcon className="w-4 h-4" /> {node.type === 'exam' ? 'Отправить зачёт' : 'Загрузить попытку'}
        </button>
      </div>
    )
  ) : null;

  const autoGraded = gradeMode(node) === 'auto-quiz';
  const TABS = [
    { key: 'about',   label: 'Описание',   icon: BookIcon },
    { key: 'guide',   label: autoGraded ? 'Теория' : 'Инструкция', icon: GradCapIcon },
    { key: 'attempt', label: isVideoNode ? 'Попытка' : liveNode ? 'Сдача' : 'Тест', icon: VideoIcon },
    { key: 'chat',    label: 'Чат',        icon: ChatIcon },
  ];

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-tunnel-bg lg:left-auto lg:w-[600px] lg:border-l lg:border-tunnel-line lg:shadow-2xl">
      {/* Header */}
      <header className="shrink-0 border-b border-tunnel-line bg-tunnel-panel px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-ink-secondary transition hover:text-ink-primary active:scale-90" aria-label="Закрыть"><BackIcon /></button>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-ink-secondary ring-1 ring-white/10">
            <TypeIcon className="w-3.5 h-3.5" />
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
            {badge.text} · {TYPE_LABEL[node.type]}
          </span>
          {node.optional && (
            <span className="rounded-full bg-accent-violet/15 px-2 py-0.5 text-[10px] font-semibold text-accent-violet ring-1 ring-accent-violet/30">
              side-quest
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-lg font-bold text-ink-primary">{node.title}</h1>
      </header>

      {/* Tabs */}
      <nav className="flex shrink-0 border-b border-tunnel-line bg-tunnel-panel">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-[10px] font-medium transition-colors ${
              tab === key
                ? 'border-accent-plasma text-accent-plasma'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            }`}>
            <Icon className="w-5 h-5" /> {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {/* ───── Описание (только текст: о чём этот узел) ───── */}
        {tab === 'about' && (
          <div className="space-y-4">
            {node.description?.trim() ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-primary/90">{node.description}</p>
            ) : (
              <p className="text-sm text-ink-muted">Описание пока не добавлено.</p>
            )}
          </div>
        )}

        {/* ───── Материал урока: авторские teach-блоки, иначе шаги ───── */}
        {tab === 'guide' && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Инструкция</div>
                {guideList.length > 0 && (
                  <button onClick={() => setShowGuide(true)}
                    className="rounded-lg border border-tunnel-line px-2.5 py-1 text-xs font-medium text-accent-plasma transition hover:border-accent-plasma/40 active:scale-95">
                    На весь экран ⤢
                  </button>
                )}
              </div>
              <GuideContent blocks={guideList} />
            </div>
          </div>
        )}

        {/* ───── Тест (для теории) / лучшая попытка (для видео-узлов) ───── */}
        {tab === 'attempt' && liveNode && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-surface ring-1 ring-white/5">
                <GradCapIcon className="w-8 h-8 text-ink-muted" />
              </span>
              <p className="text-sm text-ink-secondary">
                {node.status === 'completed' ? 'Очная сдача принята тренером.' : 'Этот навык сдаётся очно тренеру.'}
              </p>
              {node.status === 'completed' && node.rating > 0 && <StarRating value={node.rating} />}
            </div>
            {/* Coach records the in-person result here */}
            {isInstructor && node.status !== 'locked' && node.status !== 'completed' && (
              <div className="space-y-2 rounded-xl border border-skill-gold/30 bg-bg-surface p-3">
                <div className="text-sm text-ink-primary/90">Отметить очную сдачу</div>
                {gradeMode(node) === 'stars-5' ? (
                  <StarRating value={0} onRate={(s) => onAttestLive?.(s)} />
                ) : (
                  <button onClick={() => onAttestLive?.(null)} className={`${btn.gold} w-full !py-2.5`}>
                    <CheckIcon className="w-4 h-4" /> Отметить пройденным
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {tab === 'attempt' && !isVideoNode && !liveNode && (
          <QuizBlock node={node} onPass={() => onQuizPass?.()} />
        )}
        {tab === 'attempt' && isVideoNode && (
          <div className="space-y-4">
            {uploadArea}
            {bestAttempt ? (
              <>
                {videos.length > 1 && (
                  <div className="flex rounded-lg border border-tunnel-line bg-bg-void p-0.5 text-xs font-medium">
                    <button onClick={() => setAttView('best')}
                      className={`flex-1 rounded-md py-1.5 transition ${attView === 'best' ? 'bg-accent-plasma/15 text-accent-plasma' : 'text-ink-muted'}`}>Лучшая</button>
                    <button onClick={() => setAttView('all')}
                      className={`flex-1 rounded-md py-1.5 transition ${attView === 'all' ? 'bg-accent-plasma/15 text-accent-plasma' : 'text-ink-muted'}`}>Все попытки ({videos.length})</button>
                  </div>
                )}

                {attView === 'all' && videos.length > 1 ? (
                  <>
                    <AttemptTimeline videos={videos} onPlay={onPlay} />
                    {coachReview}
                  </>
                ) : (
                  <div>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      {pendingVideo ? 'Попытка на проверке' : 'Лучшая попытка'}
                    </div>
                    <AttemptMedia attempt={bestAttempt}
                      label={bestAttempt.type === 'exam' ? 'Зачёт' : 'Практика'}
                      onPlay={() => onPlay?.(bestAttempt)} />
                    <div className="mt-2 flex items-center justify-between">
                      <StatusPill status={bestAttempt.status} />
                      {bestAttempt.rating > 0 && <StarRating value={bestAttempt.rating} size="w-4 h-4" />}
                    </div>
                    <div className="mt-3">{coachReview}</div>
                    {bestAttempt.feedback && <p className="mt-2 text-xs italic text-ink-secondary">«{bestAttempt.feedback}»</p>}
                    {bestAttempt.status === 'approved' && !isInstructor && (
                      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-bg-surface p-3 ring-1 ring-white/5">
                        <span className="text-sm text-ink-primary/90">⭐ В подборку лучших</span>
                        <input type="checkbox" checked={!!bestAttempt.compilation_ready}
                          onChange={() => onToggleComp?.(bestAttempt.id)} className="h-5 w-5 accent-skill-gold" />
                      </label>
                    )}
                    {/* Escalation: a mentor graded this — let the student ask the head coach */}
                    {!isInstructor && bestAttempt.status === 'approved' && bestAttempt.reviewerRole === 'mentor' && (
                      <button onClick={() => { onSend?.('Прошу тренера перепроверить эту сдачу.'); setTab('chat'); }}
                        className="mt-3 w-full rounded-xl border border-tunnel-line py-2 text-xs font-medium text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
                        Запросить проверку тренера
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {!uploadArea && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-surface ring-1 ring-white/5">
                      <VideoIcon className="w-8 h-8 text-ink-muted" />
                    </span>
                    <p className="text-sm text-ink-secondary">
                      {isInstructor ? 'Ученик ещё не загрузил попытку — можно зачесть вручную.' : 'Здесь появятся ваши попытки.'}
                    </p>
                  </div>
                )}
                {coachReview}
              </>
            )}
          </div>
        )}

        {/* ───── Чат с тренером ───── */}
        {tab === 'chat' && (
          chatAllowed ? (
            <ContextChat messages={messages} onSend={onSend} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-bg-surface p-3 text-sm text-ink-secondary ring-1 ring-white/5">
              <LockIcon className="w-4 h-4" /> Чат откроется, когда узел станет доступен.
            </div>
          )
        )}
      </div>

      {/* Full-screen reader for a long guide */}
      {showGuide && (
        <FullscreenSheet title={`Инструкция · ${node.title}`} onClose={() => setShowGuide(false)}>
          <div className="mx-auto max-w-3xl p-5">
            <GuideContent blocks={guideList} />
          </div>
        </FullscreenSheet>
      )}
    </div>
  );
}
