// Seed trees for the prototype (Phase 2: fetched from the API).
// Migrated through `migrateTree` on load so every node carries the new
// teach/submit/grade/delegation axes while authored defs stay legacy-simple.
import windtunnel from './windtunnel.js';
import guitar from './guitar.js';
import football from './football.js';
import { migrateTree } from '../treeUtils.js';

export const seedTrees = Object.fromEntries(
  [windtunnel, guitar, football].map((t) => [t.id, migrateTree(t)])
);
