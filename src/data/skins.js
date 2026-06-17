// Node skins = swappable geometric shapes a coach unlocks in the shop and then
// applies to nodes in the builder. `style` is a plain CSS object (clipPath /
// borderRadius) layered onto every node layer, so any polygon works.
// No currency yet — "buying" just unlocks (adds the id to profile.skins).
const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

export const SKINS = [
  // The only standard skin: shape follows the node TYPE (test → круг, зачёт →
  // квадрат, экзамен → шестиугольник). Everything else is unlocked in the shop.
  { id: 'classic',  name: 'Стандарт (по типу)', free: true, style: null },
  { id: 'diamond',  name: 'Ромб',         free: false, style: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' } },
  { id: 'triangle', name: 'Треугольник',  free: false, style: { clipPath: 'polygon(50% 4%, 100% 100%, 0% 100%)' } },
  { id: 'pentagon', name: 'Пятиугольник', free: false, style: { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' } },
  { id: 'octagon',  name: 'Октагон',      free: false, style: { clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' } },
  { id: 'star',     name: 'Звезда',       free: false, style: { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' } },
  { id: 'shield',   name: 'Щит',          free: false, style: { clipPath: 'polygon(50% 0%, 100% 18%, 100% 60%, 50% 100%, 0% 60%, 0% 18%)' } },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || null;

// CSS shape for a node's skin (null → fall back to the type-based shape).
export const skinStyle = (skinId) => (skinId ? skinById(skinId)?.style || null : null);

// A skin is usable if it's free or the coach has unlocked it.
export const ownsSkin = (user, id) => {
  const s = skinById(id);
  return !!s && (s.free || (user?.skins || []).includes(id));
};
export const ownedSkins = (user) => SKINS.filter((s) => s.free || (user?.skins || []).includes(s.id));
