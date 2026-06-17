import { PlayIcon, LockIcon, CheckIcon, ClockIcon, StarIcon } from './icons.jsx';
import StarRating from './StarRating.jsx';
import { NODE_SIZE_PX, nodeSize } from '../data/treeUtils.js';
import { skinStyle } from '../data/skins.js';

// Visual size by node tier (chosen at creation); shape still carries type.
const SIZE = { test: 58, practice: 92, exam: 104 };

// Shape carries TYPE, colour carries STATE (the visual grammar of the tree):
//   test → circle · practice → rounded square · exam → hexagon ("boss fight").
const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
function shapeStyle(type) {
  if (type === 'exam') return { clipPath: HEX };
  if (type === 'practice') return { borderRadius: 16 };
  return { borderRadius: 9999 }; // test
}

// Star ratings (1–5) escalate hue green → violet → gold so a coach sees
// mastery hotspots vs. bare passes at a glance, without counting pips.
// Exported: SkillTree colours edge-energy gradients with the same hues.
export function stateColor(node, pending) {
  if (pending) return '#FFB020';                       // state-pending
  if (node.status === 'completed') {
    if (node.rating >= 5) return '#FFD23F';            // gold mastery
    if (node.rating === 4) return '#7C5CFF';           // violet strong
    return '#36C26E';                                  // green pass
  }
  if (node.status === 'available' || node.status === 'in_progress') return '#2DD4FF';
  if (node.type === 'exam') return '#3a2330';          // locked checkpoint tint
  return '#2C3848';                                    // locked
}

// Tint helpers for the bezel bevel (browser-side colour math, zero deps).
const lighten = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #FFFFFF)`;
const darken = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #000000)`;

// A single tree node, built like an ARPG talent SOCKET — stacked clipped layers
// (all plain gradients, no filters, so 80 of them stay cheap):
//   bezel (bevelled metal rim, state-coloured) → dark gap → [exam: ornament
//   line] → surface (carbon texture / video thumb) → inner state glow → content.
export default function SkillNode({ node, hasVideo, thumb, pending, fogged, reveal, lod = 'near', onClick, onContext }) {
  const size = NODE_SIZE_PX[nodeSize(node)] || SIZE[node.type];
  const isVideoNode = node.type !== 'test';
  const isBoss = node.type === 'exam';
  const { status } = node;
  const shape = skinStyle(node.skin) || shapeStyle(node.type);
  const base = stateColor(node, pending);
  const compact = lod === 'far';
  const lit = status !== 'locked';
  const isGold = isBoss && status === 'completed' && node.rating >= 5;

  // Positioned via margins (not translate) so `transform` stays free for the
  // materialize / active-press animations.
  const place = (s) => ({ left: node.x, top: node.y, width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 });

  // Glow animations: pending always shimmers (must be findable from afar);
  // breathe/bloom are dropped at far LOD — animated drop-shadows are the one
  // genuinely expensive effect here.
  const glow =
    pending ? 'animate-shimmer' :
    compact ? '' :
    status === 'completed' && node.rating >= 5 ? 'animate-bloom' :
    status === 'available' || status === 'in_progress' ? 'animate-breathe' :
    '';

  // Bevelled rim: light catches the top-left edge, shadow pools bottom-right.
  const bezel = `linear-gradient(150deg, ${lighten(base, 55)} 0%, ${base} 40%, ${darken(base, 45)} 75%, ${base} 100%)`;

  // Surface: sheen highlight + faint carbon weave over the base fill.
  const surfBase =
    isVideoNode && status === 'completed' && thumb
      ? `linear-gradient(135deg, ${thumb}, #0A0E14)`
      : status === 'locked' ? '#10151F' : '#121823';
  const surface = [
    'radial-gradient(130% 130% at 30% 20%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%)',
    'repeating-linear-gradient(-35deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1.5px, rgba(0,0,0,0) 1.5px, rgba(0,0,0,0) 4px)',
    surfBase,
  ].join(', ');

  // Exam "boss" sockets get a heavier mount: extra dark gap + thin ornament ring.
  const surfaceInset = isBoss ? 8 : 4.5;

  // Fog of War: distant locked skills are unlabelled silhouettes — mystery +
  // less clutter, with a satisfying reveal when a prerequisite is cleared.
  if (fogged) {
    return (
      <button
        type="button"
        onClick={() => onClick(node)}
        style={place(size * 0.7)}
        className="absolute opacity-25 focus:outline-none"
        aria-label="Скрытый навык"
      >
        <span className="absolute inset-0" style={{ ...shape, background: 'linear-gradient(150deg, #232C3C, #10151F)' }} />
        <span className="absolute inset-[2px]" style={{ ...shape, background: '#0D121C' }} />
        <span className="absolute inset-0 flex items-center justify-center text-ink-muted text-lg font-mono">?</span>
      </button>
    );
  }

  const dim = status === 'locked' ? 'opacity-60' : '';

  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      onContextMenu={onContext ? (e) => { e.preventDefault(); onContext(node, e); } : undefined}
      title={pending ? 'Видео на проверке у тренера' : undefined}
      style={place(size)}
      className={`absolute flex items-center justify-center transition-transform active:scale-95
                  focus:outline-none ${dim} ${reveal ? 'animate-materialize' : ''}`}
    >
      {/* 5★ exam: rotating gold mastery rays behind the socket (near LOD only) */}
      {isGold && !compact && (
        <span
          aria-hidden
          className="absolute -inset-5 rounded-full animate-spin-slow"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(255,210,63,0) 0deg 12deg, rgba(255,210,63,0.22) 16deg 20deg, rgba(255,210,63,0) 24deg 28deg)',
            WebkitMaskImage: 'radial-gradient(closest-side, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 72%)',
            maskImage: 'radial-gradient(closest-side, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 72%)',
          }}
        />
      )}

      {/* Attention halo: radar pulse that stays visible even zoomed far out */}
      {pending && (
        <span className="absolute -inset-1 rounded-full bg-warning/30 animate-ping" />
      )}

      {/* Bezel — bevelled state-coloured rim; breathing glow lives here so the
          drop-shadow follows the clip-path outline (hexagons included) */}
      <span className={`absolute inset-0 ${glow}`} style={{ ...shape, background: bezel }} />

      {/* Dark gap ring — reads as the recess between rim and surface */}
      <span className="absolute" style={{ ...shape, inset: isBoss ? 4 : 3, background: '#0A0E14' }} />

      {/* Exam ornament: thin engraved ring inside the mount ("boss fight" mass) */}
      {isBoss && (
        <span className="absolute" style={{ ...shape, inset: 5.5, background: `${base}80` }} />
      )}
      {isBoss && (
        <span className="absolute" style={{ ...shape, inset: 6.5, background: '#0A0E14' }} />
      )}

      {/* Surface — video thumbnail for completed video nodes, else carbon */}
      <span className="absolute" style={{ ...shape, inset: surfaceInset, background: surface }} />

      {/* Inner state glow hugging the surface edge (any unlocked state) */}
      {lit && (
        <span
          className="absolute"
          style={{
            ...shape,
            inset: surfaceInset,
            background: `radial-gradient(closest-side, rgba(0,0,0,0) 55%, ${base}1F 78%, ${base}55 100%)`,
          }}
        />
      )}

      {/* Foreground content (hidden at far zoom to cut clutter + draw cost) */}
      {!compact && (
        <span className="relative flex flex-col items-center justify-center gap-1 text-ink-primary">
          {status === 'locked' && <LockIcon className="w-5 h-5 text-ink-muted" />}

          {status !== 'locked' && isVideoNode && (
            <span
              className="flex items-center justify-center rounded-full w-8 h-8 shadow-lg text-black"
              style={{
                background: pending ? 'rgba(255,176,32,0.95)' : status === 'completed' ? base : 'rgba(45,212,255,0.95)',
                boxShadow: `0 2px 10px ${base}66`,
              }}
            >
              <PlayIcon className="w-4 h-4 ml-0.5" />
            </span>
          )}

          {status === 'completed' && node.type === 'test' && (
            <span style={{ color: base }}>
              <CheckIcon className="w-5 h-5" />
            </span>
          )}

          {/* Stars on any graded node (exam or accepted practice) */}
          {status === 'completed' && node.rating > 0 && (
            <span className="absolute -bottom-4">
              <StarRating value={node.rating} size="w-3 h-3" />
            </span>
          )}

          {/* "has draft" dot */}
          {!pending && hasVideo && status !== 'completed' && (
            <span className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-accent-plasma animate-pulse" />
          )}
        </span>
      )}

      {/* 5★ exam crown star perched on the hexagon's top vertex */}
      {isGold && !compact && (
        <span className="absolute -top-3.5 left-1/2 -ml-2 text-skill-gold drop-shadow-[0_0_6px_rgba(255,210,63,0.8)]">
          <StarIcon filled className="w-4 h-4" />
        </span>
      )}

      {/* "awaiting coach" badge — ALWAYS visible (it's exactly what you need
          to spot from afar), with a dark ring so it pops on any node colour */}
      {pending && (
        <span className="absolute -top-2.5 -right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-warning text-black shadow-lg ring-2 ring-bg-void">
          <ClockIcon className="w-4 h-4" />
        </span>
      )}

      {/* Label below node — hidden at far zoom, EXCEPT when awaiting review */}
      {(!compact || pending) && (
        <span className={`absolute -bottom-7 left-1/2 w-32 -ml-16 text-center text-[11px] leading-tight ${pending ? 'font-semibold text-warning' : 'text-ink-secondary'}`}>
          {node.title}
        </span>
      )}
    </button>
  );
}
