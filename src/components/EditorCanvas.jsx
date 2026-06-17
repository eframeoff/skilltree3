import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { elbowPath } from './SkillTree.jsx';
import { treeEdges, treeCanvas, NODE_SIZE_PX, nodeSize } from '../data/treeUtils.js';
import { skinStyle } from '../data/skins.js';
import { BookIcon, VideoIcon, GradCapIcon } from './icons.jsx';

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.2;
const clamp = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const GRID = 24;      // blueprint cell — nodes snap to it while dragging
const SNAP_TOL = 6;   // px (world) — alignment-to-neighbour tolerance

const SIZE = { test: 58, practice: 88, exam: 100 };
const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
const shapeStyle = (type) =>
  type === 'exam' ? { clipPath: HEX } : type === 'practice' ? { borderRadius: 16 } : { borderRadius: 9999 };
const TYPE_ICON = { test: BookIcon, practice: VideoIcon, exam: GradCapIcon };

// Figma-style selection chrome: 1px accent frame + four corner manipulators.
// Square on purpose — it's a bounding box, not the node shape.
function SelectionFrame({ color }) {
  const corner = { width: 7, height: 7, background: '#0A0E14', border: `1.5px solid ${color}` };
  return (
    <span aria-hidden className="pointer-events-none absolute -inset-2.5" style={{ border: `1px solid ${color}` }}>
      <span className="absolute -left-1 -top-1" style={corner} />
      <span className="absolute -right-1 -top-1" style={corner} />
      <span className="absolute -left-1 -bottom-1" style={corner} />
      <span className="absolute -right-1 -bottom-1" style={corner} />
    </span>
  );
}

// Node as the author sees it — DRAFTING state, not the student's jewel:
// thin level-coloured rim, dark surface with a faint level wash, mono icon.
function EditorNode({ node, color, selected, connectSource, onPointerDown }) {
  const size = NODE_SIZE_PX[nodeSize(node)] || SIZE[node.type] || 88;
  const shape = skinStyle(node.skin) || shapeStyle(node.type);
  const Icon = TYPE_ICON[node.type] || VideoIcon;
  const rim = connectSource ? '#FFB020' : selected ? '#2DD4FF' : `${color}B3`;
  return (
    <div
      onPointerDown={(e) => onPointerDown(e, node)}
      style={{ left: node.x, top: node.y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      className="absolute flex cursor-grab items-center justify-center active:cursor-grabbing"
    >
      {/* thin rim (1.5px of the level colour showing around the surface) */}
      <span className="absolute inset-0" style={{ ...shape, background: rim }} />
      <span className="absolute inset-[1.5px]" style={{ ...shape, background: '#10161F' }} />
      {/* faint level-colour wash so columns read at a glance */}
      <span
        className="absolute inset-[1.5px]"
        style={{ ...shape, background: `radial-gradient(120% 120% at 30% 25%, ${color}1A, rgba(0,0,0,0) 62%)` }}
      />
      <Icon className={`relative w-5 h-5 ${selected || connectSource ? 'text-ink-primary' : 'text-ink-secondary'}`} />
      {node.optional && (
        <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-accent-violet shadow" title="side-quest" />
      )}
      <span className={`absolute -bottom-7 left-1/2 w-32 -ml-16 text-center text-[10px] leading-tight ${
        selected ? 'font-semibold text-ink-primary' : 'text-ink-secondary'}`}>
        {node.title}
      </span>
      {(selected || connectSource) && <SelectionFrame color={selected ? '#2DD4FF' : '#FFB020'} />}
    </div>
  );
}

// End an edge slightly BEFORE the target node so the direction arrow stays
// visible (nodes are drawn above the SVG and would swallow it).
function trimEnd(a, b, off) {
  if (Math.abs(b.y - a.y) < 1) return { x: b.x - (b.x >= a.x ? 1 : -1) * off, y: b.y };
  return { x: b.x, y: b.y - (b.y >= a.y ? 1 : -1) * off };
}

// Pannable / zoomable EDIT canvas: drag nodes to reposition (grid snap +
// alignment guides), click to select, connect mode wires prerequisites with a
// live rubber band. `apiRef.current.center()` returns the world-space viewport
// centre (used to spawn new nodes where the author looks).
export default function EditorCanvas({
  tree, selectedIds = [], connectFrom, onNodeClick, onBackgroundClick, onMoveNode, onLasso, apiRef, showMinimap = true, showGrid = true,
}) {
  const wrapRef = useRef(null);
  const [view, setView] = useState({ x: 60, y: 60, scale: 0.7 });
  const [guides, setGuides] = useState(null); // {x?, y?} alignment guides while dragging
  const [cursor, setCursor] = useState(null); // world-space pointer in connect mode
  const [lasso, setLasso] = useState(null);   // {x0,y0,x1,y1} world-space selection box
  const pan = useRef(null);      // background pan
  const dragNode = useRef(null); // node being dragged
  const lassoRef = useRef(null); // {start, rect} during a Shift+drag selection
  const movedRef = useRef(false);

  const edges = treeEdges(tree);
  const canvas = treeCanvas(tree);
  const map = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  const levelColor = Object.fromEntries(tree.levels.map((l) => [l.level, l.color]));

  if (apiRef) {
    apiRef.current = {
      center: () => {
        const el = wrapRef.current;
        if (!el) return { x: 400, y: 400 };
        return {
          x: (el.clientWidth / 2 - view.x) / view.scale,
          y: (el.clientHeight / 2 - view.y) / view.scale,
        };
      },
      // Pan a node to the viewport centre (used by Cmd+K search).
      focusNode: (id) => {
        const n = tree.nodes.find((x) => x.id === id);
        const el = wrapRef.current;
        if (!n || !el) return;
        setView((v) => ({ ...v, x: el.clientWidth / 2 - n.x * v.scale, y: el.clientHeight / 2 - n.y * v.scale }));
      },
    };
  }

  // Fit all nodes on mount.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || !tree.nodes.length) return;
    const xs = tree.nodes.map((n) => n.x);
    const ys = tree.nodes.map((n) => n.y);
    const PAD = 160;
    const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD;
    const minY = Math.min(...ys) - PAD, maxY = Math.max(...ys) + PAD;
    const scale = clamp(Math.min(el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY)));
    setView({
      scale,
      x: el.clientWidth / 2 - ((minX + maxX) / 2) * scale,
      y: el.clientHeight / 2 - ((minY + maxY) / 2) * scale,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const localPt = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const worldPt = (e) => {
    const p = localPt(e);
    return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
  };

  const zoomTo = useCallback((nextScale, fx, fy) => {
    setView((v) => {
      const s2 = clamp(nextScale);
      const wx = (fx - v.x) / v.scale;
      const wy = (fy - v.y) / v.scale;
      return { scale: s2, x: fx - wx * s2, y: fy - wy * s2 };
    });
  }, []);

  // ── background pan / lasso ───────────────────────────────────────────────────
  const onBgPointerDown = useCallback((e) => {
    movedRef.current = false;
    if (e.shiftKey) { // Shift+drag on empty canvas = rubber-band selection
      const p = worldPt(e);
      lassoRef.current = { start: p, rect: null };
      setLasso({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      pan.current = null;
      return;
    }
    pan.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y };
  }, [view.x, view.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    // Lasso selection in progress.
    if (lassoRef.current) {
      const p = worldPt(e);
      const rect = { x0: lassoRef.current.start.x, y0: lassoRef.current.start.y, x1: p.x, y1: p.y };
      lassoRef.current.rect = rect;
      setLasso(rect);
      movedRef.current = true;
      return;
    }
    // Connect mode: feed the rubber band a live world-space cursor.
    if (connectFrom && !dragNode.current) setCursor(worldPt(e));

    if (dragNode.current) {
      const d = dragNode.current;
      const dx = (e.clientX - d.px) / view.scale;
      const dy = (e.clientY - d.py) / view.scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
      // Group drag: move every selected node by the same grid-snapped delta.
      if (d.groupIds) {
        const sdx = Math.round(dx / GRID) * GRID;
        const sdy = Math.round(dy / GRID) * GRID;
        for (const id of d.groupIds) { const st = d.starts[id]; if (st) onMoveNode(id, st.x + sdx, st.y + sdy); }
        return;
      }
      // Blueprint snap: grid first, then neighbour alignment overrides it.
      let nx = Math.round((d.ox + dx) / GRID) * GRID;
      let ny = Math.round((d.oy + dy) / GRID) * GRID;
      let gx = null, gy = null;
      for (const n of tree.nodes) {
        if (n.id === d.id) continue;
        if (Math.abs(n.x - nx) <= SNAP_TOL) { nx = n.x; gx = n.x; }
        if (Math.abs(n.y - ny) <= SNAP_TOL) { ny = n.y; gy = n.y; }
      }
      setGuides(gx !== null || gy !== null ? { x: gx, y: gy } : null);
      onMoveNode(d.id, nx, ny);
      return;
    }
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.px;
    const dy = e.clientY - p.py;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) movedRef.current = true;
    setView((v) => ({ ...v, x: p.ox + dx, y: p.oy + dy }));
  }, [view.scale, view.x, view.y, onMoveNode, connectFrom, tree.nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerUp = useCallback(() => {
    // Commit a lasso selection.
    if (lassoRef.current) {
      const rect = lassoRef.current.rect;
      lassoRef.current = null;
      setLasso(null);
      if (rect) {
        const minX = Math.min(rect.x0, rect.x1), maxX = Math.max(rect.x0, rect.x1);
        const minY = Math.min(rect.y0, rect.y1), maxY = Math.max(rect.y0, rect.y1);
        const ids = tree.nodes
          .filter((n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
          .map((n) => n.id);
        onLasso?.(ids);
      } else {
        onBackgroundClick();
      }
      return;
    }
    const wasNode = dragNode.current;
    dragNode.current = null;
    const wasPan = pan.current;
    pan.current = null;
    setGuides(null);
    if (!movedRef.current) {
      if (wasNode) onNodeClick(wasNode.id, wasNode.shift);
      else if (wasPan) onBackgroundClick();
    }
  }, [onNodeClick, onBackgroundClick, onLasso, tree.nodes]);

  // ── node drag ──────────────────────────────────────────────────────────────
  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    movedRef.current = false;
    // Dragging any node of a multi-selection moves the whole group together.
    const groupIds = selectedIds.length > 1 && selectedIds.includes(node.id) ? selectedIds : null;
    const starts = {};
    if (groupIds) for (const id of groupIds) { const m = map[id]; if (m) starts[id] = { x: m.x, y: m.y }; }
    dragNode.current = { id: node.id, px: e.clientX, py: e.clientY, ox: node.x, oy: node.y, shift: e.shiftKey, groupIds, starts };
  };

  const onWheel = useCallback((e) => {
    const p = localPt(e);
    zoomTo(view.scale * (e.deltaY < 0 ? 1.1 : 0.9), p.x, p.y);
  }, [view.scale, zoomTo]);

  const gs = GRID * view.scale;      // minor cell in screen px
  const connectSrc = connectFrom ? map[connectFrom] : null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-bg-void">
      {/* Blueprint grid — minor + major cells, panning/zooming with the view
          (pure background-position/size updates on a static div) */}
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(56,82,124,0.08) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(56,82,124,0.08) 1px, transparent 1px)',
              'linear-gradient(rgba(56,82,124,0.18) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(56,82,124,0.18) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: `${gs}px ${gs}px, ${gs}px ${gs}px, ${gs * 5}px ${gs * 5}px, ${gs * 5}px ${gs * 5}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        />
      )}

      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onBgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute origin-top-left"
          style={{
            width: canvas.w,
            height: canvas.h,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          <svg width={canvas.w} height={canvas.h} className="absolute inset-0 pointer-events-none">
            <defs>
              <marker id="editArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 z" fill="#44557A" />
              </marker>
              <marker id="rubberArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 z" fill="#FFB020" />
              </marker>
            </defs>

            {/* Existing prerequisites — calm drafting lines, arrow = direction */}
            {edges.map((e, i) => {
              const a = map[e.from];
              const b = map[e.to];
              if (!a || !b) return null;
              const end = trimEnd(a, b, (NODE_SIZE_PX[nodeSize(b)] || SIZE[b.type] || 88) / 2 + 8);
              return (
                <path
                  key={i}
                  d={elbowPath(a, end)}
                  fill="none"
                  stroke="#3A4A66"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#editArrow)"
                />
              );
            })}

            {/* Connect mode: rubber band from the source node to the cursor */}
            {connectSrc && cursor && (
              <path
                d={elbowPath(connectSrc, cursor)}
                fill="none"
                stroke="#FFB020"
                strokeWidth={2}
                strokeLinecap="round"
                className="path-rubber"
                markerEnd="url(#rubberArrow)"
              />
            )}

            {/* Alignment guides while dragging (Figma-pink, zoom-invariant width) */}
            {guides?.x != null && (
              <line x1={guides.x} y1={0} x2={guides.x} y2={canvas.h} stroke="#FF4D6D"
                    strokeWidth={1 / view.scale} strokeDasharray={`${4 / view.scale} ${4 / view.scale}`} />
            )}
            {guides?.y != null && (
              <line x1={0} y1={guides.y} x2={canvas.w} y2={guides.y} stroke="#FF4D6D"
                    strokeWidth={1 / view.scale} strokeDasharray={`${4 / view.scale} ${4 / view.scale}`} />
            )}

            {/* Rubber-band selection box (Shift+drag) */}
            {lasso && (
              <rect
                x={Math.min(lasso.x0, lasso.x1)} y={Math.min(lasso.y0, lasso.y1)}
                width={Math.abs(lasso.x1 - lasso.x0)} height={Math.abs(lasso.y1 - lasso.y0)}
                fill="rgba(45,212,255,0.08)" stroke="#2DD4FF"
                strokeWidth={1 / view.scale} strokeDasharray={`${5 / view.scale} ${4 / view.scale}`} />
            )}
          </svg>

          {tree.nodes.map((n) => (
            <EditorNode
              key={n.id}
              node={n}
              color={levelColor[n.level] || '#2C3848'}
              selected={selectedIds.includes(n.id)}
              connectSource={n.id === connectFrom}
              onPointerDown={onNodePointerDown}
            />
          ))}
        </div>
      </div>

      {/* Empty canvas — ghost mini-tree onboarding state */}
      {tree.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5">
          <svg width="220" height="190" viewBox="0 0 220 190" fill="none" className="opacity-40">
            <g stroke="#3A4658" strokeWidth="1.5" strokeDasharray="5 5">
              <circle cx="110" cy="30" r="22" />
              <rect x="38" y="110" width="44" height="44" rx="12" />
              <path d="M178 102 L198 113.5 L198 138.5 L178 150 L158 138.5 L158 113.5 Z" />
              <path d="M110 52 C 110 82, 60 80, 60 110" />
              <path d="M110 52 C 110 82, 178 72, 178 102" />
            </g>
          </svg>
          <div className="text-center">
            <p className="font-display text-sm font-semibold text-ink-secondary">Холст пуст</p>
            <p className="mx-auto mt-1 max-w-[250px] text-xs leading-relaxed text-ink-muted">
              Нажмите «+ Узел», чтобы добавить первый навык. Форма узла задаёт тип:
              круг — теория, квадрат — практика, гексагон — зачёт.
            </p>
          </div>
        </div>
      )}

      {/* Minimap — overview + click-to-pan on a large tree (pairs with Cmd+K search) */}
      {showMinimap && tree.nodes.length > 1 && (() => {
        const xs = tree.nodes.map((n) => n.x), ys = tree.nodes.map((n) => n.y);
        const PAD = 200;
        const bx = Math.min(...xs) - PAD, by = Math.min(...ys) - PAD;
        const bw = Math.max(...xs) - Math.min(...xs) + PAD * 2;
        const bh = Math.max(...ys) - Math.min(...ys) + PAD * 2;
        const MW = 168, MH = 112;
        const s = Math.min(MW / bw, MH / bh);
        const el = wrapRef.current;
        const vw = el ? (el.clientWidth / view.scale) * s : 0;
        const vh = el ? (el.clientHeight / view.scale) * s : 0;
        const vx = (-view.x / view.scale - bx) * s;
        const vy = (-view.y / view.scale - by) * s;
        const jump = (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const wx = bx + (e.clientX - r.left) / s;
          const wy = by + (e.clientY - r.top) / s;
          const c = wrapRef.current;
          setView((v) => ({ ...v, x: c.clientWidth / 2 - wx * v.scale, y: c.clientHeight / 2 - wy * v.scale }));
        };
        return (
          <div
            className="absolute bottom-4 left-3 z-30 overflow-hidden rounded-lg glass border border-white/10 shadow-lg"
            style={{ width: MW, height: MH }}
            onPointerDown={(e) => { e.stopPropagation(); jump(e); }}
          >
            {tree.nodes.map((n) => (
              <span key={n.id} className="absolute rounded-full"
                style={{ left: (n.x - bx) * s - 1.5, top: (n.y - by) * s - 1.5, width: 3, height: 3, background: levelColor[n.level] || '#5A6679' }} />
            ))}
            <span className="absolute border border-accent-plasma/80 bg-accent-plasma/10"
              style={{ left: vx, top: vy, width: vw, height: vh }} />
          </div>
        );
      })()}

      {/* Zoom controls — same glass capsule kit as the student tree */}
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
