import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { FullscreenSheet } from './Guide.jsx';
import { SendIcon } from './icons.jsx';

const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// Events render as centred pills; free messages render as chat bubbles. (kind is
// lost after a reload, so also detect by the leading status emoji.)
const isEvent = (m) => m.kind === 'event' || /^[✅📤↩❓🚀]/.test(m.body || '');

// General per-(student, tree) thread: free chat + the student's activity feed.
export default function GeneralChat({ treeId, studentId, title = 'Чат по дереву', onClose }) {
  const { user } = useAuth();
  const store = useStore();
  const msgs = store.generalMessages(treeId, studentId);
  const [draft, setDraft] = useState('');

  const send = (e) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    store.sendGeneral(treeId, studentId, {
      id: `m-${Date.now()}`, senderId: user.id, name: user.name.split(' ')[0], body: t, at: time(),
    });
    setDraft('');
  };

  return (
    <FullscreenSheet title={title} onClose={onClose}>
      <div className="mx-auto flex h-full max-w-2xl flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <p className="py-12 text-center text-sm text-ink-muted">Здесь переписка и события по этому дереву.</p>
          )}
          {msgs.map((m) => {
            if (isEvent(m)) {
              return (
                <div key={m.id} className="text-center">
                  <span className="inline-block break-words rounded-full bg-bg-surface px-3 py-1 text-xs text-ink-secondary ring-1 ring-white/5">
                    {m.body} · {m.at}
                  </span>
                </div>
              );
            }
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? 'rounded-br-sm bg-gradient-to-br from-accent-plasma to-accent-plasma-deep text-black'
                    : 'rounded-bl-sm bg-bg-elevated text-ink-primary ring-1 ring-white/5'}`}>
                  {!mine && <div className="text-[10px] font-semibold text-accent-plasma">{m.name}</div>}
                  {m.body}
                  <div className={`mt-0.5 text-[9px] ${mine ? 'text-black/60' : 'text-ink-muted'}`}>{m.at}</div>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={send} className="flex items-center gap-2 border-t border-tunnel-line p-3">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Написать сообщение…"
            className="flex-1 rounded-full border border-tunnel-line bg-bg-void px-4 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none" />
          <button type="submit" aria-label="Отправить"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-plasma text-black transition hover:brightness-110 active:scale-90">
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </FullscreenSheet>
  );
}
