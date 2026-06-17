import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../data/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Resolve the signed-in user into our app shape (id, role, name, avatarColor).
    const resolve = async (session) => {
      if (!session?.user) { if (active) { setUser(null); setLoading(false); } return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!active) return;
      setUser(p
        ? { id: p.id, role: p.role, name: p.name, avatarColor: p.avatar_color, email: p.email, headline: p.headline, skins: p.skins || [] }
        : { id: session.user.id, role: 'student', name: session.user.email, avatarColor: '#38bdf8', skins: [] });
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => resolve(session));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Returns a Supabase error (or null on success) so the caller can surface it.
  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };
  const logout = () => supabase.auth.signOut();

  // Edit the signed-in user's own profile (name / headline / avatar colour).
  const updateProfile = async (patch) => {
    if (!user) return;
    const row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.headline !== undefined) row.headline = patch.headline;
    if (patch.avatarColor !== undefined) row.avatar_color = patch.avatarColor;
    setUser((u) => ({ ...u, ...patch }));
    await supabase.from('profiles').update(row).eq('id', user.id);
  };

  // Unlock a node skin in the shop (no currency yet — instant add).
  const buySkin = async (skinId) => {
    if (!user || (user.skins || []).includes(skinId)) return;
    const skins = [...(user.skins || []), skinId];
    setUser((u) => ({ ...u, skins }));
    await supabase.from('profiles').update({ skins }).eq('id', user.id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, buySkin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
