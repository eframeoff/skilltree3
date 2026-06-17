import { useEffect, useState } from 'react';
import { signedUrl } from '../data/media.js';
import VideoPlayerPlaceholder from './VideoPlayerPlaceholder.jsx';

// Renders an attempt's real uploaded media (video/photo/audio/file) via a
// short-lived signed URL. Falls back to the mock placeholder for legacy/seed
// attempts that carry no uploaded file.
export default function AttemptMedia({ attempt, label, onPlay }) {
  const part = (attempt?.parts || []).find((p) => p.payload?.storagePath);
  const path = part?.payload?.storagePath;
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path) signedUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);

  if (!part) {
    return <VideoPlayerPlaceholder thumb={attempt?.thumb} label={label || attempt?.label} duration={attempt?.duration} onPlay={onPlay} />;
  }
  if (!url) {
    return <div className="flex aspect-video items-center justify-center rounded-xl bg-bg-surface text-xs text-ink-muted ring-1 ring-white/5">Загрузка медиа…</div>;
  }
  if (part.kind === 'photo') {
    return <img src={url} alt={label || 'Фото попытки'} className="w-full rounded-xl ring-1 ring-white/10" />;
  }
  if (part.kind === 'audio') {
    return <audio controls src={url} className="w-full" />;
  }
  if (part.kind === 'file') {
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="block rounded-xl bg-bg-surface p-3 text-sm text-accent-plasma ring-1 ring-white/5">
        📎 {part.payload.name || 'Открыть файл'}
      </a>
    );
  }
  return <video controls src={url} className="aspect-video w-full rounded-xl bg-black ring-1 ring-white/10" />;
}
