import { stateColor } from './SkillNode.jsx';
import { PlayIcon, BookIcon, GradCapIcon, LockIcon } from './icons.jsx';

// A small tree-node glyph for use inline (chat activity chips). Shape carries
// type, colour carries state — same grammar as the full tree.
const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
const shapeOf = (t) => (t === 'exam' ? { clipPath: HEX } : t === 'practice' ? { borderRadius: 7 } : { borderRadius: 9999 });

export default function NodeChip({ node, size = 40 }) {
  const type = node?.type || 'practice';
  const base = stateColor(node || { status: 'available' }, false);
  const shape = shapeOf(type);
  const Icon = node?.status === 'locked' ? LockIcon : type === 'test' ? BookIcon : type === 'exam' ? GradCapIcon : PlayIcon;
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0" style={{ ...shape, background: base }} />
      <span className="absolute inset-[2px]" style={{ ...shape, background: '#10151F' }} />
      <span className="absolute inset-[2px]" style={{ ...shape, background: `radial-gradient(120% 120% at 30% 25%, ${base}33, rgba(0,0,0,0) 65%)` }} />
      <Icon className="relative w-4 h-4" style={{ color: base }} />
    </span>
  );
}
