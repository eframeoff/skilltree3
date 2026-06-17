// Cold-start helpers for the builder: turn a plain skill list into a laid-out
// tree so a coach never faces a blank canvas. Domain-agnostic — the same parser
// serves a confectioner, a guitarist or a football coach.
import { uid, LEVEL_PALETTE } from './treeUtils.js';

const COL_W = 720, ROW_H = 180, X0 = 360, Y0 = 220;

// Flat-list format (one idea per line):
//   "# Название"  → starts a new level
//   "Навык"        → a node in the current level, chained after the previous one
//   "Навык *"      → a checkpoint (level exam)
export function parseSkillList(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const levels = [];
  const nodes = [];
  let curLevel = 0;
  let rowInLevel = 0;
  let prevId = null;

  const startLevel = (label) => {
    curLevel += 1;
    levels.push({
      level: curLevel,
      label: (label || `УРОВЕНЬ ${curLevel}`).toUpperCase(),
      color: LEVEL_PALETTE[(curLevel - 1) % LEVEL_PALETTE.length],
    });
    rowInLevel = 0;
  };

  for (const line of lines) {
    if (line.startsWith('#')) { startLevel(line.replace(/^#+\s*/, '')); continue; }
    if (curLevel === 0) startLevel();
    const checkpoint = /\*\s*$/.test(line);
    const title = line.replace(/\*\s*$/, '').trim();
    if (!title) continue;
    const id = uid('node');
    nodes.push({
      id,
      title,
      type: checkpoint ? 'exam' : 'practice',
      level: curLevel,
      x: X0 + (curLevel - 1) * COL_W,
      y: Y0 + rowInLevel * ROW_H,
      prereqs: prevId ? [prevId] : [],
      checkpoint,
    });
    rowInLevel += 1;
    prevId = id;
  }

  if (!levels.length) levels.push({ level: 1, label: 'УРОВЕНЬ 1', color: LEVEL_PALETTE[0] });
  return { levels, nodes };
}

export const STARTER_TEMPLATES = [
  {
    id: 'linear',
    title: 'Линейный курс',
    desc: '3 уровня, зачёт в конце каждого',
    text: '# Основы\nЗнакомство\nПервый навык\nВторой навык\nЗачёт: основы *\n# Развитие\nСложнее 1\nСложнее 2\nЗачёт: развитие *\n# Мастерство\nПродвинутый навык\nИтоговый зачёт *',
  },
  {
    id: 'simple',
    title: 'Один уровень',
    desc: 'Короткий набор навыков',
    text: '# Программа\nНавык 1\nНавык 2\nНавык 3\nЗачёт *',
  },
];
