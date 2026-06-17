import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Screen, btn } from '../../components/ui.jsx';
import { SKINS, ownsSkin } from '../../data/skins.js';
import { CheckIcon } from '../../components/icons.jsx';

// Preview swatch — the skin's shape filled with a plasma gradient.
function SkinSwatch({ skin, size = 56 }) {
  const style = skin.style || { borderRadius: 14 }; // 'classic' previews as a square
  return (
    <span className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0" style={{ ...style, background: 'linear-gradient(150deg, #2DD4FF, #7C5CFF)' }} />
      <span className="absolute inset-[2px]" style={{ ...style, background: '#10151F' }} />
      <span className="absolute inset-[2px]" style={{ ...style, background: 'radial-gradient(120% 120% at 30% 25%, rgba(45,212,255,0.35), rgba(0,0,0,0) 65%)' }} />
    </span>
  );
}

// Coach skin shop — unlock geometric node skins (no currency yet).
export default function ShopScreen() {
  const { user, buySkin } = useAuth();
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1600); };

  const buy = (skin) => { buySkin(skin.id); flash(`✨ Скин «${skin.name}» получен`); };

  return (
    <Screen wide>
      <div>
        <h1 className="font-display text-lg font-bold text-ink-primary">Магазин скинов</h1>
        <p className="text-sm text-ink-secondary">Открывайте формы узлов и применяйте их в конструкторе дерева.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SKINS.map((skin) => {
          const owned = ownsSkin(user, skin.id);
          return (
            <Card key={skin.id} className="flex flex-col items-center gap-3 text-center">
              <SkinSwatch skin={skin} />
              <div className="text-sm font-semibold text-ink-primary">{skin.name}</div>
              {owned ? (
                <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success ring-1 ring-success/30">
                  <CheckIcon className="w-3.5 h-3.5" /> {skin.free ? 'Доступно' : 'Получено'}
                </span>
              ) : (
                <button onClick={() => buy(skin)} className={`${btn.primary} w-full !py-2 !text-xs`}>Получить</button>
              )}
            </Card>
          );
        })}
      </div>

      {toast && (
        <div className="glass fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm text-ink-primary shadow-xl">{toast}</div>
      )}
    </Screen>
  );
}
