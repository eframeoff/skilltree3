import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import SkillNode, { stateColor } from './SkillNode.jsx';
import { LockIcon, CompassIcon, CheckIcon } from './icons.jsx';
import { treeCanvas, requiredExams, sortedLevels } from '../data/treeUtils.js';

// Map node id -> node for fast edge/status lookup.
function nodeMap(nodes) {
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.2;
const LOD_FAR = 0.45; // below this we drop labels/badges/edge particles (semantic zoom)
const clamp = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// Orthogonal "elbow" connector with rounded corners (vertical → horizontal →
// vertical via the mid-Y). Right angles read far cleaner than crossing
// diagonals — used by BOTH the student tree and the editor.
export function elbowPath(a, b, r = 18) {
  if (Math.abs(a.x - b.x) < 1) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`; // pure vertical
  const my = (a.y + b.y) / 2;
  const sx = b.x > a.x ? 1 : -1;            // horizontal direction
  const sy1 = my > a.y ? 1 : -1;            // a → mid vertical direction
  const sy2 = b.y > my ? 1 : -1;            // mid → b vertical direction
  const rr = Math.min(r, Math.abs(a.x - b.x) / 2, Math.abs(my - a.y), Math.abs(b.y - my)) || 0;
  return [
    `M ${a.x} ${a.y}`,
    `L ${a.x} ${my - sy1 * rr}`,
    `Q ${a.x} ${my} ${a.x + sx * rr} ${my}`,
    `L ${b.x - sx * rr} ${my}`,
    `Q ${b.x} ${my} ${b.x} ${my + sy2 * rr}`,
    `L ${b.x} ${b.y}`,
  ].join(' ');
}

// A locked node is "revealed" (not fogged) once at least one prerequisite is
// already in play — gives a one-tier Fog-of-War horizon.
const REVEALING = new Set(['completed', 'available', 'in_progress', 'pending']);
const LIVE = new Set(['available', 'in_progress']);

// Parallax constellation: a handful of tinted "stars" tiled as one cheap
// background-image. The layer translates at 0.18× pan speed (CSS transform).
const STARFIELD = [
  'radial-gradient(1.5px 1.5px at 40px 60px, rgba(255,255,255,0.35), rgba(255,255,255,0) 100%)',
  'radial-gradient(1px 1px at 150px 200px, rgba(160,210,255,0.30), rgba(160,210,255,0) 100%)',
  'radial-gradient(1.2px 1.2px at 320px 120px, rgba(255,255,255,0.22), rgba(255,255,255,0) 100%)',
  'radial-gradient(1px 1px at 230px 380px, rgba(124,92,255,0.25), rgba(124,92,255,0) 100%)',
  'radial-gradient(1.4px 1.4px at 80px 320px, rgba(45,212,255,0.22), rgba(45,212,255,0) 100%)',
  'radial-gradient(1px 1px at 400px 300px, rgba(255,255,255,0.18), rgba(255,255,255,0) 100%)',
].join(', ');

// One-shot celebration at an accepted node: shockwave ring + 12 particles
// flying out on per-particle CSS vars. Unmounted by SkillTree after ~1.3s.
function CelebrationBurst({ x, y, color }) {
  const N = 12;
  return (
    <div className="pointer-events-none absolute z-20" style={{ left: x, top: y }}>
      <span
        className="absolute animate-flashRing rounded-full"
        style={{ left: -44, top: -44, width: 88, height: 88, border: `2px solid ${color}`, boxShadow: `0 0 30px ${color}` }}
      />
      {Array.from({ length: N }).map((_, i) => {
        const ang = (i / N) * Math.PI * 2;
        const r = 58 + (i % 3) * 22;
        const s = i % 3 ? 4 : 6;
        return (
          <span
            key={i}
            className="absolute animate-burst rounded-full"
            style={{
              width: s, height: s, left: -s / 2, top: -s / 2,
              background: i % 2 ? color : '#FFFFFF',
              '--tx': `${Math.cos(ang) * r}px`,
              '--ty': `${Math.sin(ang) * r}px`,
            }}
          />
        );
      })}
    </div>
  );
}

// Pannable / zoomable PoE-style tree canvas for ANY tree definition.
// Connectors are SVG; nodes are absolutely-positioned buttons on the same
// virtual canvas so everything pans and zooms together as one layer.
export default function SkillTree({ tree, nodes, edges, videosByNode = {}, onNodeClick, onReveal, onNodeContext }) {
  const map = nodeMap(nodes);
  const levels = sortedLevels(tree);
  const canvas = treeCanvas(tree);
  const reqExams = requiredExams(tree);

  const wrapRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.82 });
  const [flying, setFlying] = useState(false); // enables transition during recenter
  const [focusLevel, setFocusLevel] = useState(levels[0]?.level ?? 1);
  const pointers = useRef(new Map()); // pointerId -> {x,y}
  const drag = useRef(null);
  const pinch = useRef(null);
  const movedRef = useRef(false);
  const flyTimer = useRef(null);

  // Nodes currently awaiting a coach (have a pending video submission).
  const pendingNodes = new Set(
    Object.entries(videosByNode)
      .filter(([, vids]) => vids.some((v) => v.status === 'pending'))
      .map(([id]) => id)
  );

  // The level the student is actively working on (earliest unfinished).
  const frontierLevel = (() => {
    const active = nodes.filter(
      (n) => n.status === 'available' || n.status === 'in_progress' || pendingNodes.has(n.id)
    );
    if (active.length) return Math.min(...active.map((n) => n.level));
    const done = nodes.filter((n) => n.status === 'completed');
    return done.length ? Math.max(...done.map((n) => n.level)) : (levels[0]?.level ?? 1);
  })();

  const isFogged = (n) =>
    n.status === 'locked' &&
    !n.prereqs.some((p) => REVEALING.has(map[p]?.status) || pendingNodes.has(p));

  // Per-level mastery (required exams completed) → drives the locked-band overlay.
  const masteredLevel = {};
  for (const lv of levels) {
    const req = reqExams[lv.level] || [];
    masteredLevel[lv.level] = req.length > 0 && req.every((id) => map[id]?.status === 'completed');
  }
  const levelIdx = (level) => levels.findIndex((l) => l.level === level);
  const levelLocked = (level) => {
    const i = levelIdx(level);
    return i > 0 && !masteredLevel[levels[i - 1].level];
  };

  // ── Celebrations ───────────────────────────────────────────────────────────
  // Diff node statuses & fog between renders: a node turning 'completed' fires
  // a burst + a light wave along its outgoing edges; a node leaving the fog
  // materializes. Pure view-layer — store/unlock logic is untouched.
  const [bursts, setBursts] = useState([]);          // [{key,x,y,color}]
  const [waves, setWaves] = useState(() => new Set());     // 'from>to' edge keys
  const [reveals, setReveals] = useState(() => new Set()); // node ids leaving fog
  const prevSnap = useRef(null);

  useEffect(() => {
    const cur = {};
    for (const n of nodes) cur[n.id] = { s: n.status, f: isFogged(n) };
    const prev = prevSnap.current;
    prevSnap.current = cur;
    if (!prev) return;

    const doneNow = nodes.filter((n) => cur[n.id].s === 'completed' && prev[n.id] && prev[n.id].s !== 'completed');
    const revealed = nodes.filter((n) => prev[n.id] && prev[n.id].f && !cur[n.id].f);
    const timers = [];

    if (doneNow.length) {
      const stamp = Date.now();
      setBursts((b) => [...b, ...doneNow.map((n) => ({ key: `${n.id}-${stamp}`, x: n.x, y: n.y, color: stateColor(n, false) }))]);
      const ids = new Set(doneNow.map((n) => n.id));
      setWaves(new Set(edges.filter((e) => ids.has(e.from)).map((e) => `${e.from}>${e.to}`)));
      timers.push(setTimeout(() => setWaves(new Set()), 1000));
      timers.push(setTimeout(() => setBursts((b) => b.filter((x) => !x.key.endsWith(String(stamp)))), 1300));
    }
    if (revealed.length) {
      setReveals(new Set(revealed.map((n) => n.id)));
      onReveal?.(revealed.map((n) => n.title));
      timers.push(setTimeout(() => setReveals(new Set()), 900));
    }
    return () => timers.forEach(clearTimeout);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera helpers ─────────────────────────────────────────────────────────
  const zoomTo = useCallback((nextScale, fx, fy) => {
    setView((v) => {
      const s2 = clamp(nextScale);
      const wx = (fx - v.x) / v.scale;
      const wy = (fy - v.y) / v.scale;
      return { scale: s2, x: fx - wx * s2, y: fy - wy * s2 };
    });
  }, []);

  // Fit the camera so an ENTIRE level fills the viewport.
  const focusOnLevel = useCallback((level, animate = true) => {
    const el = wrapRef.current;
    if (!el) return;
    const { clientWidth: w, clientHeight: h } = el;
    const cols = nodes.filter((n) => n.level === level);
    if (!cols.length) return;
    const PAD_X = 130, PAD_TOP = 120, PAD_BOTTOM = 200; // room for nodes + labels
    const minX = Math.min(...cols.map((n) => n.x)) - PAD_X;
    const maxX = Math.max(...cols.map((n) => n.x)) + PAD_X;
    const minY = Math.min(...cols.map((n) => n.y)) - PAD_TOP;
    const maxY = Math.max(...cols.map((n) => n.y)) + PAD_BOTTOM;
    const scale = clamp(Math.min(w / (maxX - minX), h / (maxY - minY)));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (animate) setFlying(true);
    setView({ scale, x: w / 2 - cx * scale, y: h / 2 - cy * scale });
    setFocusLevel(level);
    if (animate) {
      clearTimeout(flyTimer.current);
      flyTimer.current = setTimeout(() => setFlying(false), 520);
    }
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centre the camera on a single node (used by the "to goal" beacon).
  const focusOnNode = useCallback((node, animate = true) => {
    const el = wrapRef.current;
    if (!el || !node) return;
    const { clientWidth: w, clientHeight: h } = el;
    const scale = clamp(Math.max(view.scale, 0.85));
    if (animate) setFlying(true);
    setView({ scale, x: w / 2 - node.x * scale, y: h / 2 - node.y * scale });
    setFocusLevel(node.level);
    if (animate) {
      clearTimeout(flyTimer.current);
      flyTimer.current = setTimeout(() => setFlying(false), 520);
    }
  }, [view.scale]);

  // The student's next objective: what they're mid-way on, else the nearest open node.
  const goalNode =
    nodes.find((n) => n.status === 'in_progress') ||
    nodes.find((n) => n.status === 'available') || null;

  const stepLevel = (dir) => {
    const i = Math.min(levels.length - 1, Math.max(0, levelIdx(focusLevel) + dir));
    if (levels[i]) focusOnLevel(levels[i].level);
  };

  // On mount, frame the level the student is actively working on.
  useLayoutEffect(() => { focusOnLevel(frontierLevel, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const localPt = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // NOTE: no setPointerCapture — capturing retargets the click and breaks taps.
  const onPointerDown = useCallback((e) => {
    setFlying(false);
    pointers.current.set(e.pointerId, localPt(e));
    movedRef.current = false;
    if (pointers.current.size === 1) {
      drag.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y };
      pinch.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d0: dist(a, b), s0: view.scale };
      drag.current = null;
    }
  }, [view.x, view.y, view.scale]);

  const onPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, localPt(e));

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      if (pinch.current.d0 > 0) {
        const m = mid(a, b);
        zoomTo((pinch.current.s0 * d) / pinch.current.d0, m.x, m.y);
        movedRef.current = true;
      }
      return;
    }

    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) movedRef.current = true;
    setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
  }, [zoomTo]);

  const onPointerUp = useCallback((e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      // Lift one finger after a pinch → resume panning from the survivor.
      const [p] = [...pointers.current.entries()];
      drag.current = { px: p[1].x + wrapRef.current.getBoundingClientRect().left,
                       py: p[1].y + wrapRef.current.getBoundingClientRect().top,
                       ox: view.x, oy: view.y };
      pinch.current = null;
    } else if (pointers.current.size === 0) {
      drag.current = null;
      pinch.current = null;
    }
  }, [view.x, view.y]);

  // Desktop wheel zoom about the cursor.
  const onWheel = useCallback((e) => {
    const p = localPt(e);
    zoomTo(view.scale * (e.deltaY < 0 ? 1.1 : 0.9), p.x, p.y);
  }, [view.scale, zoomTo]);

  // Swallow the click that follows a pan/pinch; let genuine taps through.
  const handleNodeClick = useCallback((node) => {
    if (movedRef.current) return;
    onNodeClick(node);
  }, [onNodeClick]);

  const lod = view.scale < LOD_FAR ? 'far' : 'near';
  const near = lod === 'near';
  const focusMeta = levels.find((l) => l.level === focusLevel) || levels[0] || { label: '', color: '#2DD4FF' };

  // Shared HUD button chrome (glass kit).
  const hudBtn = 'glass border border-white/10 text-ink-primary shadow-lg transition hover:bg-white/10 active:scale-90 disabled:opacity-30 flex items-center justify-center';

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-bg-void">
      {/* Parallax constellation — drifts at 0.18× pan speed (transform-only) */}
      <div
        className="pointer-events-none absolute -inset-[40%] opacity-60"
        style={{
          backgroundImage: STARFIELD,
          backgroundSize: '460px 460px',
          transform: `translate3d(${view.x * 0.18}px, ${view.y * 0.18}px, 0)`,
        }}
      />

      <div
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className={`absolute origin-top-left ${flying ? 'transition-transform duration-500 ease-out' : ''}`}
          style={{
            width: canvas.w,
            height: canvas.h,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          {/* Level nebulas (world-space): mastered zones glow warm in the level
              colour, the frontier glows softly, locked zones sink into cold dark */}
          {levels.map((lv) => {
            const own = nodes.filter((n) => n.level === lv.level);
            if (!own.length) return null;
            const PAD = 220;
            const minX = Math.min(...own.map((n) => n.x)) - PAD;
            const maxX = Math.max(...own.map((n) => n.x)) + PAD;
            const minY = Math.min(...own.map((n) => n.y)) - PAD;
            const maxY = Math.max(...own.map((n) => n.y)) + PAD;
            const locked = levelLocked(lv.level);
            const alpha = masteredLevel[lv.level] ? '30' : lv.level === frontierLevel ? '26' : '16';
            return (
              <div
                key={`neb-${lv.level}`}
                className="pointer-events-none absolute"
                style={{
                  left: minX, top: minY, width: maxX - minX, height: maxY - minY,
                  background: locked
                    ? 'radial-gradient(closest-side, rgba(5,8,14,0.65), rgba(5,8,14,0) 78%)'
                    : `radial-gradient(closest-side, ${lv.color}${alpha}, rgba(0,0,0,0) 74%)`,
                }}
              />
            );
          })}

          {/* Level headers — neon signage set into the background, not UI text */}
          {levels.map((lv, i) => {
            const locked = levelLocked(lv.level);
            const own = nodes.filter((n) => n.level === lv.level);
            if (!own.length) return null;
            const baseY = Math.max(...own.map((n) => n.y));
            const cx = own.reduce((s, n) => s + n.x, 0) / own.length;
            return (
              <div
                key={lv.level}
                className="absolute pointer-events-none -translate-x-1/2 text-center"
                style={{ left: cx, top: baseY + 80, width: 360 }}
              >
                {/* engraved divider that carries the neon */}
                <div
                  className="mx-auto mb-2 h-px w-56"
                  style={{
                    background: `linear-gradient(90deg, rgba(0,0,0,0), ${locked ? '#2C3848' : lv.color}99, rgba(0,0,0,0))`,
                    boxShadow: locked ? 'none' : `0 0 12px ${lv.color}66`,
                  }}
                />
                <div
                  className="flex items-center justify-center gap-2.5 font-display font-extrabold uppercase"
                  style={{
                    color: locked ? '#5A6679' : lv.color,
                    fontSize: 32,
                    letterSpacing: '0.16em',
                    textShadow: locked ? 'none' : `0 0 16px ${lv.color}66, 0 0 46px ${lv.color}33`,
                    opacity: locked ? 0.55 : 1,
                  }}
                >
                  {locked && <LockIcon className="w-6 h-6" />}
                  {lv.label}
                </div>
                <div className="mt-0.5 font-mono text-[13px] tracking-[0.3em]"
                     style={{ color: locked ? '#5A6679' : lv.color, opacity: locked ? 0.5 : 0.7 }}>
                  {lv.level} УРОВЕНЬ{masteredLevel[lv.level] ? ' · ОСВОЕН ✓' : ''}
                </div>
                {locked && i > 0 && (
                  <div className="mt-1.5 font-sans text-[13px] normal-case tracking-normal text-ink-muted">
                    Сначала освойте «{levels[i - 1].label}»
                  </div>
                )}
              </div>
            );
          })}

          {/* Connectors — three energy tiers:
              completed→completed  plasma flow (glow + gradient core + particles)
              completed→available  smouldering dashes creeping toward the node
              into locked          faint engraving in the carbon                */}
          <svg
            width={canvas.w}
            height={canvas.h}
            className="absolute inset-0 pointer-events-none"
          >
            {edges.map((e, i) => {
              const a = map[e.from];
              const b = map[e.to];
              if (!a || !b) return null;
              if (isFogged(a) && isFogged(b)) return null; // hide deep-fog edges
              const d = elbowPath(a, b);
              const waveKey = `${e.from}>${e.to}`;
              const wave = waves.has(waveKey) && (
                <path d={d} pathLength="100" fill="none" stroke="#EAFBFF" strokeWidth={3.5}
                      strokeLinecap="round" className="path-wave" />
              );

              const aDone = a.status === 'completed';
              const bDone = b.status === 'completed';
              const bLive = LIVE.has(b.status) || pendingNodes.has(b.id);

              if (aDone && (bDone || bLive)) {
                const c1 = stateColor(a, pendingNodes.has(a.id));
                const c2 = stateColor(b, pendingNodes.has(b.id));
                const gid = `eg-${i}`;
                return (
                  <g key={i}>
                    {/* per-edge gradient: energy inherits the grade colours of its endpoints */}
                    <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
                      <stop offset="0%" stopColor={c1} />
                      <stop offset="100%" stopColor={c2} />
                    </linearGradient>
                    {/* soft halo under the core (near LOD only — it's a wide stroke, not a filter) */}
                    {near && (
                      <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={bDone ? 10 : 8}
                            opacity={bDone ? 0.2 : 0.12} strokeLinecap="round" />
                    )}
                    {/* core: solid for a walked path, smouldering dashes toward an open node */}
                    <path
                      d={d} fill="none" stroke={`url(#${gid})`}
                      strokeWidth={bDone ? 3.5 : 2.5} strokeLinecap="round"
                      strokeDasharray={bDone ? undefined : '3 9'}
                      className={!bDone && near ? 'path-smolder' : ''}
                      opacity={bDone ? 1 : 0.9}
                    />
                    {/* running sparks on a fully walked path (near LOD only) */}
                    {bDone && near && (
                      <path d={d} fill="none" stroke="#EAFBFF" strokeWidth={1.8}
                            strokeLinecap="round" className="path-particles" />
                    )}
                    {wave}
                  </g>
                );
              }

              // Locked edge — engraving, barely raised out of the carbon.
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke="#1C2535" strokeWidth={2} strokeLinecap="round" />
                  {wave}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const vids = videosByNode[n.id] || [];
            return (
              <SkillNode
                key={n.id}
                node={n}
                hasVideo={vids.length > 0}
                thumb={vids[0]?.thumb}
                pending={pendingNodes.has(n.id)}
                fogged={isFogged(n)}
                reveal={reveals.has(n.id)}
                lod={lod}
                onClick={handleNodeClick}
                onContext={onNodeContext}
              />
            );
          })}

          {/* Acceptance celebrations (one-shot, world-space) */}
          {bursts.map((b) => (
            <CelebrationBurst key={b.key} x={b.x} y={b.y} color={b.color} />
          ))}
        </div>
      </div>

      {/* Vignette — pulls the eye to the centre, sinks the edges (static) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(115% 95% at 50% 42%, rgba(0,0,0,0) 58%, rgba(4,7,12,0.55) 100%)' }}
      />

      {/* Level rail — all levels' progress at a glance; tap to fly there */}
      {levels.length > 1 && (
        <div className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex">
          {levels.map((lv) => {
            const own = nodes.filter((n) => n.level === lv.level);
            const done = own.filter((n) => n.status === 'completed').length;
            const pct = own.length ? Math.round((done / own.length) * 100) : 0;
            const locked = levelLocked(lv.level);
            const active = lv.level === focusLevel;
            return (
              <button key={lv.level} onClick={() => focusOnLevel(lv.level)} title={`${lv.label} · ${pct}%`}
                className={`flex items-center gap-2 rounded-full glass border px-2 py-1 shadow-lg transition active:scale-95 ${active ? 'border-white/30' : 'border-white/10'}`}>
                <span className="w-3 text-center font-mono text-[10px]" style={{ color: locked ? '#5A6679' : lv.color }}>{lv.level}</span>
                <span className="h-1 w-10 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: locked ? '#5A6679' : lv.color }} />
                </span>
                {masteredLevel[lv.level]
                  ? <CheckIcon className="w-3 h-3 text-success" />
                  : locked ? <LockIcon className="w-3 h-3 text-ink-muted" /> : <span className="w-3" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Level navigator — step ◀ / ▶ between levels (bottom centre) */}
      {levels.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button
            onClick={() => stepLevel(-1)}
            disabled={levelIdx(focusLevel) <= 0}
            aria-label="Предыдущий уровень"
            className={`w-10 h-10 rounded-full text-lg ${hudBtn}`}
          >‹</button>

          <button
            onClick={() => focusOnLevel(focusLevel)}
            className="min-w-[150px] rounded-full glass border px-4 py-1.5 text-center shadow-lg transition hover:bg-white/10 active:scale-95"
            style={{ borderColor: `${focusMeta.color}66`, boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 18px ${focusMeta.color}22` }}
          >
            <div className="font-display font-bold leading-tight" style={{ color: focusMeta.color }}>
              {focusMeta.label}
            </div>
            <div className="font-mono text-[10px] text-ink-secondary">{levelIdx(focusLevel) + 1}/{levels.length} уровень</div>
          </button>

          <button
            onClick={() => stepLevel(1)}
            disabled={levelIdx(focusLevel) >= levels.length - 1}
            aria-label="Следующий уровень"
            className={`w-10 h-10 rounded-full text-lg ${hudBtn}`}
          >›</button>
        </div>
      )}

      {/* Goal beacon — pan straight to the student's next objective (top left) */}
      {goalNode && (
        <button
          onClick={() => focusOnNode(goalNode)}
          className={`absolute right-4 top-4 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${hudBtn}`}
        >
          <CompassIcon className="w-4 h-4" /> К цели
        </button>
      )}

      {/* Zoom controls (bottom right) — one glass capsule, same kit as the nav */}
      <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-full glass border border-white/10 shadow-lg">
        <button
          onClick={() => { const el = wrapRef.current; zoomTo(view.scale + 0.2, el.clientWidth / 2, el.clientHeight / 2); }}
          aria-label="Приблизить"
          className="flex h-10 w-10 items-center justify-center text-xl text-ink-primary transition hover:bg-white/10 active:scale-90"
        >+</button>
        <div className="mx-2 h-px bg-white/10" />
        <button
          onClick={() => { const el = wrapRef.current; zoomTo(view.scale - 0.2, el.clientWidth / 2, el.clientHeight / 2); }}
          aria-label="Отдалить"
          className="flex h-10 w-10 items-center justify-center text-xl text-ink-primary transition hover:bg-white/10 active:scale-90"
        >−</button>
      </div>
    </div>
  );
}
