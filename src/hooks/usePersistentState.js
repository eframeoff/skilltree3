import { useEffect, useRef, useState } from 'react';

// Thin persistence seam over useState: survives refresh during dev/demo and
// keeps the store honest about serializability (the future API/DB will store
// exactly these shapes — see docs/adr/0002-backend-and-persistence.md).
//
// VERSION is bumped whenever the seed/model shape changes so stale local data
// is dropped in favour of fresh seeds instead of half-migrated junk.
const VERSION = 'v3';
const keyOf = (k) => `skilltree:${VERSION}:${k}`;

// Standalone load/save for state that needs custom wrapping (e.g. the undoable
// `trees` history in the store).
export function loadPersisted(key, fallback, revive) {
  try {
    const raw = localStorage.getItem(keyOf(key));
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return revive ? revive(parsed) : parsed;
  } catch {
    return fallback;
  }
}
export function savePersisted(key, value) {
  try { localStorage.setItem(keyOf(key), JSON.stringify(value)); } catch { /* quota / private mode */ }
}

export function usePersistentState(key, initial, revive) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(keyOf(key));
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      return revive ? revive(parsed) : parsed;
    } catch {
      return initial;
    }
  });

  // Debounced write so rapid edits (dragging a node) don't thrash localStorage.
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { localStorage.setItem(keyOf(key), JSON.stringify(state)); } catch { /* quota / private mode */ }
    }, 200);
    return () => clearTimeout(timer.current);
  }, [key, state]);

  return [state, setState];
}
