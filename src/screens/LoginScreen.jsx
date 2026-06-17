import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authors, students } from '../data/users.js';
import { Avatar, SectionTitle } from '../components/ui.jsx';
import { ChevronRightIcon, TreeIcon } from '../components/icons.jsx';

// Demo accounts seeded into Supabase (scripts/seed-supabase.mjs) all share this
// password — the persona picker just signs in with the chosen email.
const DEMO_PASSWORD = 'skilltree123';

function UserRow({ user, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-tunnel-line bg-bg-surface/80 p-3 text-left
                 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition
                 hover:border-accent-plasma/40 hover:shadow-[0_0_24px_rgba(45,212,255,0.10)] active:scale-[0.98]"
    >
      <Avatar user={user} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink-primary">{user.name}</div>
        <div className="truncate text-xs text-ink-secondary">{subtitle}</div>
      </div>
      <ChevronRightIcon className="w-5 h-5 text-ink-muted" />
    </button>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const enter = async (user) => {
    setBusy(true); setError(null);
    const err = await login(user.email, DEMO_PASSWORD);
    setBusy(false);
    if (err) { setError(`Не удалось войти: ${err.message}`); return; }
    navigate(user.role === 'instructor' ? '/coach' : '/app');
  };

  return (
    <div className="aurora-bg min-h-[100dvh] w-full">
      <div className="mx-auto flex w-full max-w-md flex-col px-5 py-10 lg:max-w-4xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-plasma to-skill-gold text-black shadow-[0_0_40px_rgba(45,212,255,0.4)]">
            <TreeIcon className="w-9 h-9" />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary" style={{ textShadow: '0 0 30px rgba(45,212,255,0.35)' }}>
            Skill<span className="text-accent-plasma">Tree</span>
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary">Любой навык — как RPG-дерево талантов</p>
          <p className="mt-3 inline-block rounded-full border border-tunnel-line bg-bg-surface/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            Демо · выберите профиль
          </p>
        </div>

        {error && <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-center text-sm text-rose-300">{error}</p>}

        <div className={`grid gap-8 lg:grid-cols-2 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <div>
            <SectionTitle>Авторы и тренеры</SectionTitle>
            <div className="space-y-2">
              {authors.map((a) => (
                <UserRow key={a.id} user={a} subtitle={a.headline} onClick={() => enter(a)} />
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Ученики</SectionTitle>
            <div className="space-y-2">
              {students.map((s) => (
                <UserRow key={s.id} user={s} subtitle={s.email} onClick={() => enter(s)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
