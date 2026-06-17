import { useState } from 'react';
import { SendIcon } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Node-scoped Q&A thread between student and coach. Available only on unlocked
// or active nodes (the drawer decides whether to render it).
export default function ContextChat({ messages, onSend }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="flex flex-col">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        Спросить тренера
      </h4>

      <div className="mb-3 max-h-44 space-y-2 overflow-y-auto pr-1 no-scrollbar">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted">Сообщений пока нет. Начните диалог 👇</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm
                  ${mine
                    ? 'rounded-br-sm bg-gradient-to-br from-accent-plasma to-accent-plasma-deep text-black shadow-[0_2px_12px_rgba(45,212,255,0.25)]'
                    : 'rounded-bl-sm bg-bg-elevated text-ink-primary ring-1 ring-white/5'}`}
              >
                {!mine && <div className="text-[10px] font-semibold text-accent-plasma">{m.name}</div>}
                {m.body}
                <div className={`mt-0.5 text-[9px] ${mine ? 'text-black/60' : 'text-ink-muted'}`}>{m.at}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Введите вопрос…"
          className="flex-1 rounded-full border border-tunnel-line bg-bg-void px-4 py-2 text-sm text-ink-primary placeholder-ink-muted transition-colors focus:border-accent-plasma/60 focus:outline-none focus:ring-1 focus:ring-accent-plasma/25"
        />
        <button
          type="submit"
          aria-label="Отправить"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-plasma text-black shadow-[0_2px_12px_rgba(45,212,255,0.3)] transition hover:brightness-110 active:scale-90"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
