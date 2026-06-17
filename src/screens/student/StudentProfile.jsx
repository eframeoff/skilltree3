import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { Card, StatCard, Avatar, Screen, btn } from '../../components/ui.jsx';
import { TreeIcon, CheckIcon, PencilIcon } from '../../components/icons.jsx';
import StarRating from '../../components/StarRating.jsx';

// Student home = personal profile (editable) + a quick overview.
export default function StudentProfile() {
  const { user, updateProfile } = useAuth();
  const store = useStore();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [headline, setHeadline] = useState(user.headline || '');

  const enrolled = store.enrollmentsOf(user.id);
  const stats = enrolled.map((e) => store.stats(user.id, e.treeId)).filter(Boolean);
  const stars = stats.reduce((a, s) => a + s.stars, 0);
  const exams = stats.reduce((a, s) => a + s.examsPassed, 0);

  const field = 'w-full rounded-lg border border-tunnel-line bg-bg-void px-3 py-2 text-sm text-ink-primary placeholder-ink-muted focus:border-accent-plasma/60 focus:outline-none';
  const save = () => { updateProfile({ name: name.trim() || user.name, headline: headline.trim() }); setEditing(false); };

  return (
    <Screen wide>
      <h1 className="font-display text-lg font-bold text-ink-primary">Профиль</h1>

      <Card>
        {!editing ? (
          <div className="flex items-center gap-3">
            <Avatar user={user} size={56} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-bold text-ink-primary">{user.name}</div>
              {user.headline && <div className="text-xs text-ink-secondary">{user.headline}</div>}
              <div className="mt-0.5 text-[11px] text-ink-muted">{user.email}</div>
            </div>
            <button onClick={() => { setName(user.name); setHeadline(user.headline || ''); setEditing(true); }}
              className="flex items-center gap-1.5 rounded-xl border border-tunnel-line px-3 py-2 text-sm text-ink-secondary transition hover:border-accent-plasma/40 active:scale-95">
              <PencilIcon className="w-4 h-4" /> Изменить
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar user={user} size={56} />
              <div className="flex-1 space-y-2">
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
                <input className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="О себе (необязательно)" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} className={`${btn.primary} flex-1`}><CheckIcon className="w-4 h-4" /> Сохранить</button>
              <button onClick={() => setEditing(false)} className="rounded-xl border border-tunnel-line px-4 text-sm text-ink-secondary active:scale-95">Отмена</button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<TreeIcon className="w-4 h-4" />} label="Деревьев" value={enrolled.length} />
        <StatCard icon={<CheckIcon className="w-4 h-4" />} label="Зачётов" value={exams} />
        <StatCard icon={<StarRating value={1} size="w-3.5 h-3.5" />} label="Звёзд" value={stars} />
      </div>
    </Screen>
  );
}
