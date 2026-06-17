import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import NodeChip from './NodeChip.jsx';
import StarRating from './StarRating.jsx';
import { SendIcon } from './icons.jsx';

const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Activity events are encoded `EVT|kind|nodeId|title` (see store.postActivity).
const ACT = {
  submit: 'отправил(а) попытку', done: 'зачтено', test: 'тест пройден',
  reject: 'попытка отклонена', cleared: 'зачёт снят', question: 'вопрос по узлу', live: 'очно зачтено',
};
const parseEvent = (body) => {
  if (!body?.startsWith('EVT|')) return null;
  const p = body.split('|');
  return { kind: p[1], nodeId: p[2], title: p.slice(3).join('|') };
};
// Legacy text events (older rows) — show as a plain pill.
const isLegacyEvent = (m) => m.kind === 'event' || /^[✅📤↩❓🚀⭐]/.test(m.body || '');

export default function ChatThread({ treeId, studentId }) {
  const { user } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const msgs = store.generalMessages(treeId, studentId);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null); // { id, text }

  // ✓✓ when any OTHER participant has read past this message's time.
  const readMap = store.chatReads(treeId, studentId);
  const otherRead = Math.max(0, ...Object.entries(readMap).filter(([rid]) => rid !== user.id).map(([, t]) => t));

  const saveEdit = () => {
    const t = editing.text.trim();
    if (t) store.editGeneral(treeId, studentId, editing.id, t);
    setEditing(null);
  };

  const openNode = (nodeId) => {
    if (!nodeId) return;
    const base = user.role === 'instructor' ? `/coach/students/${studentId}/tree/${treeId}` : `/app/tree/${treeId}`;
    navigate(`${base}?n=${nodeId}`);
  };

  const send = (e) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    store.sendGeneral(treeId, studentId, {
      id: `m-${Date.now()}`, senderId: user.id, name: user.name.split(' ')[0], body: t, at: time(), ts: Date.now(),
    });
    setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-muted">Здесь переписка и события по этому дереву.</p>
        )}
        {msgs.map((m) => {
          const ev = parseEvent(m.body);
          if (ev) {
            const node = store.nodesFor(studentId, treeId).find((n) => n.id === ev.nodeId);
            const chip = node || { title: ev.title, type: 'practice', status: 'available' };
            return (
              <button key={m.id} onClick={() => openNode(ev.nodeId)}
                className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-tunnel-line bg-bg-surface px-3 py-2 text-left transition hover:border-accent-plasma/40 active:scale-[0.99]">
                <NodeChip node={chip} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-primary">{ev.title}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
                    <span className="truncate">{m.name} · {ACT[ev.kind] || 'обновление'}</span>
                    {node?.rating > 0 && <StarRating value={node.rating} size="w-3 h-3" />}
                    <span className="shrink-0 text-ink-muted">· {m.at}</span>
                  </div>
                </div>
              </button>
            );
          }
          if (isLegacyEvent(m)) {
            return (
              <div key={m.id} className="text-center">
                <span className="inline-block break-words rounded-full bg-bg-surface px-3 py-1 text-xs text-ink-secondary ring-1 ring-white/5">{m.body} · {m.at}</span>
              </div>
            );
          }
          const mine = m.senderId === user?.id;
          const isRead = mine && m.ts && otherRead >= m.ts;
          if (editing?.id === m.id) {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="flex w-[80%] items-center gap-2">
                  <input autoFocus value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                    className="flex-1 rounded-full border border-accent-plasma/50 bg-bg-void px-3 py-1.5 text-sm text-ink-primary focus:outline-none" />
                  <button onClick={saveEdit} className="text-xs font-semibold text-accent-plasma">OK</button>
                  <button onClick={() => setEditing(null)} className="text-xs text-ink-muted">✕</button>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm ${
                mine
                  ? 'rounded-br-sm bg-gradient-to-br from-accent-plasma to-accent-plasma-deep text-black'
                  : 'rounded-bl-sm bg-bg-elevated text-ink-primary ring-1 ring-white/5'}`}>
                {!mine && <div className="text-[10px] font-semibold text-accent-plasma">{m.name}</div>}
                {m.body}
                <div className={`mt-0.5 flex items-center justify-end gap-1.5 text-[9px] ${mine ? 'text-black/60' : 'text-ink-muted'}`}>
                  {mine && (
                    <button onClick={() => setEditing({ id: m.id, text: m.body })}
                      className="opacity-0 transition group-hover:opacity-100" title="Изменить">изменить</button>
                  )}
                  {m.edited && <span className="italic">изменено</span>}
                  <span>{m.at}</span>
                  {mine && <span className={isRead ? 'text-cyan-200' : ''} title={isRead ? 'Прочитано' : 'Отправлено'}>{isRead ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex shrink-0 items-center gap-2 border-t border-tunnel-line p-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Написать сообщение…"
          className="flex-1 rounded-full border border-tunnel-line bg-bg-void px-4 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none" />
        <button type="submit" aria-label="Отправить"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-plasma text-black transition hover:brightness-110 active:scale-90">
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
