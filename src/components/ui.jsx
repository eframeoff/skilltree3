// Small shared presentational primitives — the "Carbon & Plasma" product kit.
// Every list/dashboard screen composes these, so depth and accents live here.

// ── Button kit (class strings, composable with extra utilities) ─────────────
export const btn = {
  // Plasma CTA — the one bright thing on a card.
  primary:
    'flex items-center justify-center gap-2 rounded-xl bg-accent-plasma py-2.5 px-4 text-sm font-bold text-black shadow-[0_4px_18px_rgba(45,212,255,0.28)] transition hover:brightness-110 active:scale-95',
  // Gold — reserved for "exam / mastery / publish" moments.
  gold:
    'flex items-center justify-center gap-2 rounded-xl bg-skill-gold py-2.5 px-4 text-sm font-bold text-black shadow-[0_4px_18px_rgba(255,210,63,0.25)] transition hover:brightness-110 active:scale-95',
  // Quiet outline — secondary actions.
  ghost:
    'flex items-center justify-center gap-2 rounded-xl border border-tunnel-line bg-bg-surface py-2.5 px-4 text-sm font-medium text-ink-secondary transition hover:border-accent-plasma/40 hover:text-ink-primary active:scale-95',
  // Destructive outline.
  danger:
    'flex items-center justify-center gap-2 rounded-xl border border-danger/50 py-2.5 px-4 text-sm font-medium text-rose-300 transition hover:bg-danger/10 active:scale-95',
};

// Uppercase micro-header above each content section.
export function SectionTitle({ children, className = '', action }) {
  return (
    <div className={`mb-2 flex items-center justify-between ${className}`}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{children}</h2>
      {action}
    </div>
  );
}

// Responsive page container: phone-width feed < lg, comfortable web width ≥ lg.
export function Screen({ children, className = '', wide = false }) {
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} space-y-4 p-4 lg:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Avatar({ user, size = 40 }) {
  if (!user) return null;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-black ring-1 ring-white/15"
      style={{
        width: size,
        height: size,
        // top-lit sphere instead of a flat disc
        background: `radial-gradient(120% 120% at 30% 22%, color-mix(in srgb, ${user.avatarColor} 60%, #fff), ${user.avatarColor} 55%, color-mix(in srgb, ${user.avatarColor} 70%, #000))`,
        fontSize: size * 0.4,
      }}
    >
      {user.name[0]}
    </span>
  );
}

export function ProgressBar({ percent, className = '' }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-bg-void shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent-plasma-deep via-accent-plasma to-skill-gold shadow-[0_0_8px_rgba(45,212,255,0.45)] transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// Card surface: carbon panel with a hairline top sheen so it reads as a slab,
// not a flat rectangle. All elevation is shadow/border — no blur on scrollers.
const CARD_SURFACE =
  'rounded-card border border-tunnel-line bg-bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.35)]';

export function Card({ children, className = '' }) {
  return <div className={`${CARD_SURFACE} p-4 ${className}`}>{children}</div>;
}

export function StatCard({ icon, label, value, hint }) {
  return (
    <div className={`${CARD_SURFACE} p-3`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-accent-plasma/80">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      </div>
      <div className="font-display text-xl font-bold text-ink-primary">{value}</div>
      {hint && <div className="text-[11px] text-ink-muted">{hint}</div>}
    </div>
  );
}

// Emoji emblem tile for a tree — tinted in the tree's colour with a soft glow.
export function TreeEmblem({ tree, size = 48, className = '' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `radial-gradient(120% 120% at 30% 22%, ${tree.color}33, ${tree.color}14)`,
        border: `1px solid ${tree.color}55`,
        boxShadow: `0 0 18px ${tree.color}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {tree.emoji}
    </span>
  );
}

const STATUS_PILL = {
  pending:  'bg-warning/15 text-warning ring-1 ring-warning/30',
  approved: 'bg-success/15 text-success ring-1 ring-success/30',
  rejected: 'bg-danger/15 text-rose-300 ring-1 ring-danger/30',
};
const STATUS_LABEL = {
  pending: 'на проверке',
  approved: 'одобрено',
  rejected: 'отклонено',
};
export function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL[status] || 'bg-slate-600/30 text-slate-300'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}
