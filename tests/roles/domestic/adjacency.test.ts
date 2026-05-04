// 06.5 — Tests for the adjacency-bonus engine.
//
// Each test stomps the module-level rule list via
// `__setAdjacencyRulesForTest`, so the production content shipped by 06.8
// doesn't leak into these unit assertions.

import { afterEach, describe, expect, it } from 'vitest';
import {
  __setAdjacencyRulesForTest,
  adjacencyRules,
  yieldAdjacencyBonus,
  type AdjacencyRule,
} from '../../../src/game/roles/domestic/adjacency.ts';
import { cellKey } from '../../../src/game/roles/domestic/grid.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { EMPTY_BAG } from '../../../src/game/resources/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';

const building = (defID: string): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp: 1,
  maxHp: 1,
});

// Snapshot the production rule set so each test can restore it after
// stomping. Cloning by value because the registry holds object references.
const productionRules: AdjacencyRule[] = adjacencyRules.map((r) => ({
  defID: r.defID,
  whenAdjacentTo: r.whenAdjacentTo,
  bonus: { ...r.bonus },
}));

afterEach(() => {
  __setAdjacencyRulesForTest(productionRules);
});

describe('yieldAdjacencyBonus (06.5)', () => {
  it('empty registry yields EMPTY_BAG even on a populated grid', () => {
    __setAdjacencyRulesForTest([]);
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(1, 0)]: building('Granary'),
    };
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(EMPTY_BAG);
  });

  it('empty grid yields EMPTY_BAG regardless of rules', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    expect(yieldAdjacencyBonus({}, adjacencyRules)).toEqual(EMPTY_BAG);
  });

  it('two adjacent matching buildings yield the bonus once', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(1, 0)]: building('Granary'),
    };
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(
      bagOf({ food: 1 }),
    );
  });

  it('non-adjacent matching buildings yield no bonus', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    // Mill at (0,0), Granary at (2,0) — diagonal/separated, no neighbor.
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(2, 0)]: building('Granary'),
    };
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(EMPTY_BAG);
  });

  it('diagonal neighbors do NOT count as adjacent', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(1, 1)]: building('Granary'),
    };
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(EMPTY_BAG);
  });

  it("'*' rule fires once per neighbor of any kind", () => {
    __setAdjacencyRulesForTest([
      { defID: 'Fight Circle', whenAdjacentTo: '*', bonus: { happiness: 1 } },
    ]);
    // Fight Circle at the center of a plus, surrounded by 3 neighbors.
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Fight Circle'),
      [cellKey(1, 0)]: building('Mill'),
      [cellKey(-1, 0)]: building('Granary'),
      [cellKey(0, 1)]: building('Library'),
    };
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(
      bagOf({ happiness: 3 }),
    );
  });

  it('rule fires once per matching neighbor (count, not boolean)', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    // Mill in the middle, Granary on two sides.
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(1, 0)]: building('Granary'),
      [cellKey(-1, 0)]: building('Granary'),
    };
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(
      bagOf({ food: 2 }),
    );
  });

  it('asymmetric rules: only the cell whose defID matches gets the bonus', () => {
    // Rule fires for Mill near Granary, but NOT for Granary near Mill.
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(1, 0)]: building('Granary'),
    };
    // Total: 1 (just from the Mill side).
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(
      bagOf({ food: 1 }),
    );
  });

  it('multiple rules can fire on the same cell', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Library', whenAdjacentTo: 'School', bonus: { science: 1 } },
      { defID: 'Library', whenAdjacentTo: '*', bonus: { happiness: 1 } },
    ]);
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Library'),
      [cellKey(1, 0)]: building('School'),
    };
    // Science: 1 (one School neighbor). Happiness: 1 ('*' counts the
    // School neighbor too). Total: { science: 1, happiness: 1 }.
    expect(yieldAdjacencyBonus(grid, adjacencyRules)).toEqual(
      bagOf({ science: 1, happiness: 1 }),
    );
  });

  it('__setAdjacencyRulesForTest fully replaces the previous list', () => {
    __setAdjacencyRulesForTest([
      { defID: 'Mill', whenAdjacentTo: 'Granary', bonus: { food: 1 } },
    ]);
    expect(adjacencyRules).toHaveLength(1);
    __setAdjacencyRulesForTest([]);
    expect(adjacencyRules).toHaveLength(0);
  });
});
