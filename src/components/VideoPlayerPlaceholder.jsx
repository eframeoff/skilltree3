import { PlayIcon } from './icons.jsx';

// Simulated mobile video player. No real playback in MVP — clicking the play
// button fires onPlay so the parent can show a toast / fake "now playing".
export default function VideoPlayerPlaceholder({ thumb = '#1f2937', label, duration, onPlay }) {
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${thumb}, #0b0f1a)` }}
    >
      {/* bottom legibility scrim for label / scrubber */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />

      {/* faux scrubber — plasma progress with a soft glow */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
        <div className="h-full w-1/3 rounded-r-full bg-accent-plasma shadow-[0_0_8px_rgba(45,212,255,0.8)]" />
      </div>

      <button
        onClick={onPlay}
        className="absolute inset-0 flex items-center justify-center"
        aria-label="Воспроизвести видео"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-90">
          <PlayIcon className="w-6 h-6 ml-1" />
        </span>
      </button>

      {label && (
        <span className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/10">
          {label}
        </span>
      )}
      {duration && (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] text-white ring-1 ring-white/10">
          {duration}
        </span>
      )}
    </div>
  );
}
