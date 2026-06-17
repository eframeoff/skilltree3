import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackIcon, PlusIcon, TrashIcon, CloseIcon } from './icons.jsx';
import { signedUrl, uploadGuideFile } from '../data/media.js';

// A guide is an ordered list of blocks: { kind:'text'|'photo'|'video'|'audio'|'file', payload }.
//   text  → payload: string (markdown-lite)
//   media → payload: { storagePath, name, caption }
// Coerce legacy shapes (string guide / steps / teach.blocks) so old nodes render.
export function guideBlocks(node) {
  const g = node?.guide;
  if (Array.isArray(g)) return g;
  if (typeof g === 'string' && g.trim()) return [{ kind: 'text', payload: g }];
  if (node?.steps?.length) return [{ kind: 'text', payload: node.steps.map((s) => `- ${s}`).join('\n') }];
  if (node?.teach?.blocks?.length) return node.teach.blocks;
  return [];
}

// ── markdown-lite text rendering (safe; no dangerouslySetInnerHTML) ───────────
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i} className="font-semibold text-ink-primary">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>);
}

function TextBlock({ text }) {
  if (!text?.trim()) return null;
  const out = [];
  let bullets = [];
  const flush = (k) => { if (bullets.length) { out.push(<ul key={`ul-${k}`} className="my-2 ml-5 list-disc space-y-1">{bullets}</ul>); bullets = []; } };
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('## ')) { flush(i); out.push(<h3 key={i} className="mb-1 mt-4 break-words font-display text-base font-bold text-ink-primary">{renderInline(line.slice(3))}</h3>); }
    else if (line.startsWith('# ')) { flush(i); out.push(<h2 key={i} className="mb-2 mt-4 break-words font-display text-lg font-bold text-ink-primary">{renderInline(line.slice(2))}</h2>); }
    else if (line.startsWith('- ')) { bullets.push(<li key={i} className="break-words text-sm leading-relaxed text-ink-primary/90">{renderInline(line.slice(2))}</li>); }
    else if (!line.trim()) { flush(i); }
    else { flush(i); out.push(<p key={i} className="my-1.5 break-words text-sm leading-relaxed text-ink-primary/90">{renderInline(line)}</p>); }
  });
  flush('end');
  return <div className="break-words">{out}</div>;
}

// Caption shown as text; double-click to edit inline (only in the editor).
function EditableCaption({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  if (editing) {
    return (
      <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft.trim()); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft.trim()); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
        className="mx-auto mt-1 block w-full max-w-sm rounded border border-accent-plasma/50 bg-bg-void px-2 py-1 text-center text-xs text-ink-primary focus:outline-none" />
    );
  }
  return (
    <figcaption onDoubleClick={() => setEditing(true)} title="Двойной клик — изменить подпись"
      className={`mt-1 cursor-text break-words text-center text-xs ${value ? 'text-ink-muted' : 'italic text-ink-muted/50'}`}>
      {value || 'Подпись (двойной клик)'}
    </figcaption>
  );
}

// Media in the guide flow — uniform adaptive size; photo opens full-screen,
// video uses native controls (incl. fullscreen), files download. In the editor
// (onCaptionChange given) the caption is editable in place.
function GuideMedia({ block, onCaptionChange }) {
  const path = block.payload?.storagePath;
  const [url, setUrl] = useState(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path) signedUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);
  if (!path) return null;
  if (!url) return <div className="my-3 flex h-40 items-center justify-center rounded-xl bg-bg-surface text-xs text-ink-muted ring-1 ring-white/5">Загрузка…</div>;

  const cap = block.payload?.caption;
  let body;
  if (block.kind === 'photo') {
    body = (
      <button type="button" onClick={() => setZoom(true)} className="block w-full" title="Открыть на весь экран">
        <img src={url} alt={cap || ''} className="mx-auto max-h-72 w-full rounded-xl object-contain bg-black/20 ring-1 ring-white/10" />
      </button>
    );
  } else if (block.kind === 'video') {
    body = <video src={url} controls className="mx-auto max-h-72 w-full rounded-xl bg-black object-contain ring-1 ring-white/10" />;
  } else if (block.kind === 'audio') {
    body = <audio src={url} controls className="w-full" />;
  } else {
    body = (
      <a href={url} target="_blank" rel="noreferrer" download
        className="flex items-center gap-2 break-words rounded-xl bg-bg-surface p-3 text-sm text-accent-plasma ring-1 ring-white/5 transition hover:bg-accent-plasma/10">
        📎 {block.payload?.name || 'Файл'} — открыть / скачать
      </a>
    );
  }

  return (
    <figure className="my-3">
      {body}
      {onCaptionChange
        ? <EditableCaption value={cap} onChange={onCaptionChange} />
        : (cap && <figcaption className="mt-1 break-words text-center text-xs text-ink-muted">{cap}</figcaption>)}
      {zoom && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(false)}>
          <button className="absolute right-4 top-4 text-white/80" aria-label="Закрыть"><CloseIcon className="w-7 h-7" /></button>
          <img src={url} alt={cap || ''} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </figure>
  );
}

export function GuideContent({ blocks }) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return <p className="text-sm text-ink-muted">Тренер пока не добавил инструкцию к этому узлу.</p>;
  return (
    <div className="max-w-full">
      {list.map((b, i) => (b.kind === 'text' ? <TextBlock key={i} text={b.payload} /> : <GuideMedia key={i} block={b} />))}
    </div>
  );
}

// Full-screen surface with a clean header. Portaled to <body> so it always
// covers the viewport (any transformed/blurred ancestor would otherwise clip it).
export function FullscreenSheet({ title, onClose, footer, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-bg-void">
      <header className="flex shrink-0 items-center gap-3 border-b border-tunnel-line bg-tunnel-panel px-4 py-3">
        <button onClick={onClose} className="text-ink-secondary transition hover:text-ink-primary active:scale-90" aria-label="Закрыть">
          <BackIcon className="w-5 h-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink-primary">{title}</h2>
        {footer}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>,
    document.body,
  );
}

// Auto-growing textarea so text blocks read like a flowing document.
function AutoTextarea({ value, ...props }) {
  const ref = useRef(null);
  const grow = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(() => { grow(ref.current); }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

// ── Flowing block editor: text and media interleaved in one scroll ───────────
const MEDIA_LABEL = { photo: 'фото', video: 'видео', audio: 'аудио', file: 'файл' };
const MEDIA_ACCEPT = { photo: 'image/*', video: 'video/*', audio: 'audio/*', file: '*/*' };

export function GuideEditor({ initial, treeId, onSave, onClose }) {
  const [blocks, setBlocks] = useState(() => guideBlocks({ guide: initial }));
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [busy, setBusy] = useState(false);
  const active = useRef(null); // insert position: after this index (null = end)

  // Add an empty block (text or media). Media blocks start without a file — the
  // coach uploads into the placeholder, mirroring how text blocks work.
  const insert = (block) => setBlocks((b) => {
    const at = active.current == null ? b.length : active.current + 1;
    const c = [...b]; c.splice(at, 0, block); active.current = at; return c;
  });
  const addText = () => insert({ kind: 'text', payload: '' });
  const addMedia = (kind) => insert({ kind, payload: { caption: '' } });

  const uploadInto = async (i, file) => {
    setBusy(true);
    try {
      const storagePath = await uploadGuideFile(file, treeId);
      setBlocks((b) => b.map((x, xi) => (xi === i ? { ...x, payload: { ...x.payload, storagePath, name: file.name } } : x)));
    } catch (err) {
      alert(err.message || 'Не удалось загрузить файл');
    } finally {
      setBusy(false);
    }
  };
  const patch = (i, payload) => setBlocks((b) => b.map((x, xi) => (xi === i ? { ...x, payload } : x)));
  const remove = (i) => setBlocks((b) => b.filter((_, xi) => xi !== i));
  const move = (i, d) => setBlocks((b) => {
    const j = i + d; if (j < 0 || j >= b.length) return b;
    const c = [...b]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  const toolBtn = 'flex items-center gap-1 rounded-lg border border-dashed border-tunnel-line px-2.5 py-1.5 text-xs text-skill-available transition hover:border-accent-plasma/40 active:scale-95';

  return (
    <FullscreenSheet
      title="Инструкция узла"
      onClose={onClose}
      footer={
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onClose} className="rounded-xl border border-tunnel-line px-3 py-2 text-sm text-ink-secondary active:scale-95">Отмена</button>
          <button onClick={() => { onSave(blocks); onClose(); }} className="rounded-xl bg-skill-available px-4 py-2 text-sm font-bold text-black active:scale-95">Сохранить</button>
        </div>
      }
    >
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 border-b border-tunnel-line bg-bg-void/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 px-4 py-2">
          <button onClick={addText} className={toolBtn}><PlusIcon className="w-3.5 h-3.5" /> Текст</button>
          <button onClick={() => addMedia('photo')} className={toolBtn}><PlusIcon className="w-3.5 h-3.5" /> Фото</button>
          <button onClick={() => addMedia('video')} className={toolBtn}><PlusIcon className="w-3.5 h-3.5" /> Видео</button>
          <button onClick={() => addMedia('file')} className={toolBtn}><PlusIcon className="w-3.5 h-3.5" /> Файл</button>
          <button onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
            className="ml-auto rounded-lg border border-tunnel-line px-2.5 py-1.5 text-xs text-ink-secondary active:scale-95">
            {mode === 'edit' ? 'Просмотр' : 'Редактор'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4">
        {busy && <p className="mb-2 text-xs text-warning">⏳ Загрузка файла…</p>}

        {mode === 'preview' ? (
          <GuideContent blocks={blocks} />
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Инструкция состоит из блоков — добавьте блок текста, видео, фото или файла.
            </p>
            {blocks.length === 0 && (
              <p className="rounded-xl border border-dashed border-tunnel-line p-6 text-center text-sm text-ink-muted">
                Пусто. Добавьте блок кнопками выше.
              </p>
            )}
            <div className="space-y-1">
              {blocks.map((b, i) => (
                <div key={i} className="group relative">
                  {b.kind === 'text' ? (
                    <AutoTextarea value={b.payload || ''}
                      onFocus={() => { active.current = i; }}
                      onChange={(e) => patch(i, e.target.value)}
                      placeholder="Текст инструкции…"
                      className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent p-2 text-sm leading-relaxed text-ink-primary placeholder-ink-muted hover:border-tunnel-line focus:border-accent-plasma/50 focus:bg-bg-void focus:outline-none" />
                  ) : b.payload?.storagePath ? (
                    <GuideMedia block={b} onCaptionChange={(c) => patch(i, { ...b.payload, caption: c })} />
                  ) : (
                    <label className="my-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-tunnel-line py-8 text-sm text-ink-secondary transition hover:border-accent-plasma/40">
                      <PlusIcon className="w-5 h-5" />
                      Загрузить {MEDIA_LABEL[b.kind] || 'файл'}
                      <input type="file" accept={MEDIA_ACCEPT[b.kind] || '*/*'} className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadInto(i, f); }} />
                    </label>
                  )}
                  {/* hover controls */}
                  <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-lg bg-bg-void/90 p-0.5 opacity-0 ring-1 ring-tunnel-line transition group-hover:opacity-100">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 disabled:opacity-30" aria-label="Выше">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="rounded p-1 text-slate-400 disabled:opacity-30" aria-label="Ниже">↓</button>
                    <button onClick={() => remove(i)} className="rounded p-1 text-rose-400" aria-label="Удалить"><TrashIcon className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </FullscreenSheet>
  );
}
