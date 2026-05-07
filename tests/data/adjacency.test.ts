// 06.8 — Tests for the adjacency content loader and its integration with
// 06.5's `yieldAdjacencyBonus`.

import { describe, expect, it } from 'vitest';
import {
  ADJACENCY_RULES,
  validateAdjacencyRules,
} from '../../src/data/adjacency.ts';
import { BUILDINGS } from '../../src/data/index.ts';
import {
  adjacencyRules,
  yieldAdjacencyBonus,
} from '../../src/game/roles/domestic/adjacency.ts';
import { cellKey } from '../../src/game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../../src/game/roles/domestic/types.ts';

const knownBuildings = new Set(BUILDINGS.map((b) => b.name));
const building = (defID: string): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp: 1,
  maxHp: 1,
});

describe('ADJACENCY_RULES loader', () => {
  it('loads a non-empty, frozen array', () => {
    expect(ADJACENCY_RULES.length).toBeGreaterThan(0);
    expect(Object.isFrozen(ADJACENCY_RULES)).toBe(true);
    expect(Object.isFrozen(ADJACENCY_RULES[0])).toBe(true);
  });

  it("every rule's defID matches a real building name", () => {
    for (const r of ADJACENCY_RULES) {
      expect(knownBuildings.has(r.defID)).toBe(true);
    }
  });

  it("every rule's non-'*' whenAdjacentTo matches a real building name", () => {
    for (const r of ADJACENCY_RULES) {
      if (r.whenAdjacentTo === '*') continue;
      expect(knownBuildings.has(r.whenAdjacentTo)).toBe(true);
    }
  });

  it('each defID appears in at most a small number of rules (<=2)', () => {
    const counts = new Map<string, number>();
    for (const r of ADJACENCY_RULES) {
      counts.set(r.defID, (counts.get(r.defID) ?? 0) + 1);
    }
    for (const [defID, n] of counts) {
      expect(
        n,
        `defID "${defID}" appears in ${n} rules — power cap is 2`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it('rejects an unknown building id with a clear error', () => {
    expect(() =>
      validateAdjacencyRules(
        [
          {
            defID: 'NotARealBuilding',
            whenAdjacentTo: 'Granary',
            bonus: { food: 1 },
          },
        ],
        knownBuildings,
      ),
    ).toThrow(/NotARealBuilding/);
  });

  it("rejects an unknown whenAdjacentTo (when not '*')", () => {
    expect(() =>
      validateAdjacencyRules(
        [
          {
            defID: 'Mill',
            whenAdjacentTo: 'GhostBuilding',
            bonus: { food: 1 },
          },
        ],
        knownBuildings,
      ),
    ).toThrow(/GhostBuilding/);
  });

  it('rejects a non-array input', () => {
    expect(() => validateAdjacencyRules({} as unknown, knownBuildings)).toThrow(
      /AdjacencyRuleDef/,
    );
  });

  it('rejects an unknown resource key in bonus', () => {
    expect(() =>
      validateAdjacencyRules(
        [
          {
            defID: 'Mill',
            whenAdjacentTo: 'Granary',
            bonus: { magic: 1 } as unknown as Record<string, number>,
          },
        ],
        knownBuildings,
      ),
    ).toThrow(/magic/);
  });

  it('rejects a non-numeric bonus value', () => {
    expect(() =>
      validateAdjacencyRules(
        [
          {
            defID: 'Mill',
            whenAdjacentTo: 'Granary',
            bonus: { food: 'lots' } as unknown as Record<string, number>,
          },
        ],
        knownBuildings,
      ),
    ).toThrow(/food/);
  });

  it("accepts '*' as a wildcard whenAdjacentTo", () => {
    const out = validateAdjacencyRules(
      [
        {
          defID: 'Fight Circle',
          whenAdjacentTo: '*',
          bonus: { happiness: 1 },
        },
      ],
      knownBuildings,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.whenAdjacentTo).toBe('*');
  });

  it('preserves an optional flavor field when present', () => {
    const out = validateAdjacencyRules(
      [
        {
          defID: 'Mill',
          whenAdjacentTo: 'Granary',
          bonus: { food: 1 },
          flavor: 'mill-side note',
        },
      ],
      knownBuildings,
    );
    expect(out[0]?.flavor).toBe('mill-side note');
  });
});

describe('ADJACENCY_RULES x yieldAdjacencyBonus integration', () => {
  it('Mill next to Granary on the production grid yields +1 food', () => {
    // The shipped registry contains the Mill+Granary rule (see
    // src/data/adjacency.json). On a fixture grid placing them adjacent,
    // running the engine against the live registry should pick up at
    // least { food: >= 1 }.
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(1, 0)]: building('Granary'),
    };
    const bonus = yieldAdjacencyBonus(grid, adjacencyRules);
    expect(bonus.food).toBeGreaterThanOrEqual(1);
  });

  it("Fight Circle's wildcard rule fires for any neighbor", () => {
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Fight Circle'),
      [cellKey(1, 0)]: building('Mill'),
    };
    const bonus = yieldAdjacencyBonus(grid, adjacencyRules);
    expect(bonus.happiness).toBeGreaterThanOrEqual(1);
  });

  it('a starter-style buildable cluster produces a non-empty bonus', () => {
    // Two-building cluster reachable in early rounds: Mill placed
    // adjacent to Granary. Confirms the feature is reachable early in
    // a real game (per 06.8 plan note).
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Granary'),
      [cellKey(1, 0)]: building('Mill'),
    };
    const bonus = yieldAdjacencyBonus(grid, adjacencyRules);
    const totalUnits =
      bonus.food +
      bonus.production +
      bonus.science +
      bonus.gold +
      bonus.happiness;
    expect(totalUnits).toBeGreaterThan(0);
  });

  it('non-adjacent buildings produce no bonus from production rules', () => {
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('Mill'),
      [cellKey(3, 3)]: building('Granary'),
    };
    const bonus = yieldAdjacencyBonus(grid, adjacencyRules);
    // No matching cell has a matching neighbor.
    expect(bonus.food).toBe(0);
    expect(bonus.production).toBe(0);
    expect(bonus.science).toBe(0);
    expect(bonus.gold).toBe(0);
    expect(bonus.happiness).toBe(0);
  });
});
