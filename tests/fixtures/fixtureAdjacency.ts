// Mirrors the production `src/data/adjacency.ts` export shape but reads
// from the fixture deck. Wired via the test alias in vite.config.ts.
//
// The validator is imported from `src/data/adjacencyValidator.ts` —
// that module is NOT aliased, so this re-export is safe (no circular
// alias).

export {
  validateAdjacencyRules,
  type AdjacencyRuleDef,
} from '../../src/data/adjacencyValidator.ts';
export { ADJACENCY_RULES } from './deck.ts';
