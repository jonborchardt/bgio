// 06.5 — Adjacency-effect registry.
//
// A pluggable list of "if Building X is adjacent to Building Y, add Z to
// produce yield" rules. Consumed by `domesticProduce` (06.4) so adjacency
// becomes a real V1 design lever rather than flavor.
//
// The plan API declares `yieldAdjacencyBonus(grid: Map<...>, ...)`, but the
// rest of the project uses `Record<string, DomesticBuilding>` (deviation
// already documented in `./types.ts`). We follow the project shape so the
// helper drops straight into `produce.ts` without conversion.
//
// Rules are stored in a module-level mutable array so that:
//   - 06.8's content loader can populate it once at module load
//     (`adjacencyRules.push(...ADJACENCY_RULES)`);
//   - tests can override the list deterministically via
//     `__setAdjacencyRulesForTest`.
//
// The matching is asymmetric on purpose. A rule
//   { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } }
// fires for each Mill that has at least one Granary neighbor (and gives
// `food: matchCount` if multiple neighbors match). The reverse direction
// (Granary near Mill) requires its own rule. This lets content tune
// directionality without symmetric-double-counting bugs.

import type { DomesticBuilding } from './types.ts';
import { cellKey } from './grid.ts';
import type { ResourceBag } from '../../resources/types.ts';
import { EMPTY_BAG } from '../../resources/types.ts';
import { add } from '../../resources/bag.ts';
import { ADJACENCY_RULES } from '../../../data/adjacency.ts';

/** A single registered adjacency rule. */
export interface AdjacencyRule {
  /** When this `defID` has a neighbor whose defID matches `whenAdjacentTo` */
  defID: string;
  /** `'*'` matches any building. */
  whenAdjacentTo: string | '*';
  /** Added to produce yield, multiplied by the count of matching neighbors. */
  bonus: Partial<ResourceBag>;
}

/**
 * Module-level registry. 06.8 populates this from `ADJACENCY_RULES` at
 * module load (see the `for (const r of ADJACENCY_RULES)` block below).
 * Tests should mutate via `__setAdjacencyRulesForTest`, not by reaching
 * into this array directly.
 */
export const adjacencyRules: AdjacencyRule[] = [];

/** Parse `'x,y'` back to numeric coords. Returns `null` on malformed input. */
const parseCellKey = (k: string): [number, number] | null => {
  const parts = k.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
};

/**
 * Walks the grid and returns the total adjacency-bonus bag.
 *
 * For each placed cell, looks at its 4 orthogonal neighbors. For each rule
 * whose `defID` matches the cell's defID, counts neighbors satisfying
 * `whenAdjacentTo` (or any neighbor when `whenAdjacentTo === '*'`) and adds
 * `bonus * matchCount` to the running total.
 *
 * Pure: does not mutate `grid` or `rules`.
 */
export const yieldAdjacencyBonus = (
  grid: Record<string, DomesticBuilding>,
  rules: ReadonlyArray<AdjacencyRule>,
): ResourceBag => {
  let total: ResourceBag = { ...EMPTY_BAG };

  for (const [key, cell] of Object.entries(grid)) {
    const coords = parseCellKey(key);
    if (coords === null) continue;
    // Defense redesign D2 — the synthetic center tile is a coordinate
    // anchor, not a producing building. It carries no def, no rules, and
    // shouldn't satisfy `whenAdjacentTo: '*'` neighbor checks for nearby
    // buildings either. We skip it as a rule-source here, and filter it
    // out of the neighbor pool below.
    if (cell.isCenter === true) continue;
    const [x, y] = coords;

    // Collect the (up to four) orthogonal neighbors that exist. The center
    // tile is excluded — see the note at the top of the loop.
    const neighbors: DomesticBuilding[] = [];
    const neighborKeys = [
      cellKey(x + 1, y),
      cellKey(x - 1, y),
      cellKey(x, y + 1),
      cellKey(x, y - 1),
    ];
    for (const nk of neighborKeys) {
      const nb = grid[nk];
      if (nb !== undefined && nb.isCenter !== true) neighbors.push(nb);
    }
    if (neighbors.length === 0) continue;

    for (const rule of rules) {
      if (rule.defID !== cell.defID) continue;
      let matchCount = 0;
      for (const nb of neighbors) {
        if (rule.whenAdjacentTo === '*' || nb.defID === rule.whenAdjacentTo) {
          matchCount += 1;
        }
      }
      if (matchCount === 0) continue;
      // Multiply each bonus entry by `matchCount` before folding in.
      const scaled: Partial<ResourceBag> = {};
      for (const [r, v] of Object.entries(rule.bonus)) {
        if (typeof v === 'number') {
          (scaled as Record<string, number>)[r] = v * matchCount;
        }
      }
      total = add(total, scaled);
    }
  }

  return total;
};

/**
 * Test-only registry setter. Clears the module array and reseeds it with
 * the supplied rules. Tests should call this in `beforeEach` (or wrap with
 * try/finally) and restore the production set when done if subsequent
 * tests in the same file rely on it.
 */
export const __setAdjacencyRulesForTest = (
  rules: ReadonlyArray<AdjacencyRule>,
): void => {
  adjacencyRules.length = 0;
  for (const r of rules) adjacencyRules.push(r);
};

// 06.8 wiring: at module load, append the curated content rules. Append
// (rather than assign) so `__setAdjacencyRulesForTest` keeps working —
// tests overwrite by length-zeroing, then re-pushing.
for (const r of ADJACENCY_RULES) {
  adjacencyRules.push({
    defID: r.defID,
    whenAdjacentTo: r.whenAdjacentTo,
    bonus: r.bonus,
  });
}
