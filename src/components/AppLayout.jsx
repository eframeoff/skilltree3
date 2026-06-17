import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { unreadCount } from '../data/unread.js';
import { Avatar } from './ui.jsx';
import {
  HomeIcon, TreeIcon, VideoIcon, UsersIcon, LogoutIcon, CompassIcon, GradCapIcon, ChatIcon, PlusIcon, ShopIcon,
} from './icons.jsx';

const STUDENT_NAV = [
  { to: '/app',         label: 'Главная',     icon: HomeIcon, end: true },
  { to: '/app/trees',   label: 'Мои деревья', icon: TreeIcon },
  { to: '/app/chat',    label: 'Чаты',        icon: ChatIcon },
  { to: '/app/catalog', label: 'Каталог',     icon: CompassIcon },
  { to: '/app/videos',  label: 'Видео',       icon: VideoIcon },
];

const AUTHOR_NAV = [
  { to: '/coach',          label: 'Главная',  icon: HomeIcon, end: true },
  { to: '/coach/courses',  label: 'Мои деревья', icon: TreeIcon },
  { to: '/coach/students', label: 'Ученики',  icon: ChatIcon },
  { to: '/coach/trees',    label: 'Создать',  icon: PlusIcon },
  { to: '/coach/shop',     label: 'Магазин',  icon: ShopIcon },
];

// Logo mark: tree glyph on a plasma→gold tile with a faint glow. SVG, not emoji.
export function Brand({ size = 'base' }) {
  const lg = size === 'lg';
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-accent-plasma to-skill-gold text-black shadow-[0_0_18px_rgba(45,212,255,0.35)] ${lg ? 'h-10 w-10' : 'h-8 w-8'}`}>
        <TreeIcon className={lg ? 'w-6 h-6' : 'w-5 h-5'} />
      </span>
      <div className={`font-display font-bold tracking-tight text-ink-primary ${lg ? 'text-lg' : 'text-base'}`}>
        Skill<span className="text-accent-plasma">Tree</span>
      </div>
    </div>
  );
}

function BottomNav({ items }) {
  return (
    <nav className="glass z-20 flex shrink-0 items-stretch justify-around border-t border-white/10 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(({ to, label, icon: Icon, end, badge = 0 }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-accent-plasma' : 'text-ink-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* active indicator: thin plasma bar tucked under the top edge */}
              {isActive && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-plasma shadow-[0_0_8px_rgba(45,212,255,0.8)]" />
              )}
              <span className="relative">
                <Icon className="w-6 h-6" />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-plasma px-1 text-[9px] font-bold text-black">{badge}</span>
                )}
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar({ items, user, roleLabel, onSignOut }) {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-tunnel-line bg-tunnel-panel">
      <div className="px-5 py-5"><Brand size="lg" /></div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon, end, badge = 0 }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-plasma/10 text-accent-plasma shadow-[inset_0_0_0_1px_rgba(45,212,255,0.18)]'
                  : 'text-ink-secondary hover:bg-white/5 hover:text-ink-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* active accent bar on the left edge */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-plasma shadow-[0_0_8px_rgba(45,212,255,0.8)]" />
                )}
                <Icon className="w-5 h-5" />
                {label}
                {badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-plasma px-1.5 text-[10px] font-bold text-black">{badge}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-tunnel-line p-3">
        <div className="flex items-center gap-3 rounded-xl bg-bg-void/50 px-2.5 py-2.5 ring-1 ring-white/5">
          <Avatar user={user} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink-primary">{user.name}</div>
            <div className="text-[11px] text-ink-muted">{roleLabel}</div>
          </div>
          <button onClick={onSignOut} aria-label="Выйти" className="rounded-full p-2 text-ink-muted transition hover:text-ink-primary active:scale-90">
            <LogoutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// Responsive shell: bottom-nav phone layout < lg, sidebar web app ≥ lg.
export default function AppLayout({ role }) {
  const { user, logout } = useAuth();
  const store = useStore();
  const navigate = useNavigate();
  const isAuthor = role === 'instructor';
  // Student-mentors get an extra "Наставник" tab once a coach grants the role.
  const showMentor = !isAuthor && store.isMentor(user.id);
  const baseNav = isAuthor
    ? AUTHOR_NAV
    : showMentor
      ? [...STUDENT_NAV, { to: '/app/review', label: 'Наставник', icon: GradCapIcon }]
      : STUDENT_NAV;

  // Unread chat badge on the chat nav item.
  const chatUnread = (store.chatThreads(user) || []).reduce((a, c) => a + unreadCount(user.id, c.key, c.count), 0);
  const chatTo = isAuthor ? '/coach/students' : '/app/chat';
  const nav = baseNav.map((i) => (i.to === chatTo ? { ...i, badge: chatUnread } : i));

  const signOut = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-[100dvh] w-full bg-tunnel-bg">
      <Sidebar items={nav} user={user} roleLabel={isAuthor ? 'Автор · Тренер' : 'Ученик'} onSignOut={signOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center justify-between border-b border-tunnel-line bg-tunnel-panel px-4 py-3 lg:hidden">
          <Brand />
          <button onClick={signOut} aria-label="Выйти" className="rounded-full p-2 text-ink-muted transition hover:text-ink-primary active:scale-90">
            <LogoutIcon className="w-5 h-5" />
          </button>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          <Outlet />
        </main>

        <BottomNav items={nav} />
      </div>
    </div>
  );
}
