// SL 8 — boss × library tableau integration tests.
//
// `tests/game/track/boss-with-debuff.test.ts` already pins the per-
// threshold-step boss math. This file is the higher-level integration
// shape called for in sub-plan 8: drive `resolveBoss` against a tableau
// that's been pushed past threshold-3 of one color and assert the
// boss's "gold-flavour" attack output is reduced by the right amount
// per the Wave 2 sub-plan 4 design.
//
// Per the V1 design shipped in `src/game/library/debuff.ts`, the
// reduction is a uniform aggregate: the sum of all four color debuff
// levels is subtracted from each attack's `strength` (floor 0). The
// "gold flavour" reading is therefore "an attack that came from the
// gold-themed side of the table" — concretely, the boss attacks
// resolve against the village grid, and a gold-coloured tableau
// reduces *every* attack identically. The TODO in `debuff.ts` flags
// the per-color flavour mapping as deferred until ThreatPattern grows
// a `flavor` field; until then, this test pins the V1 default
// (`totalDebuffReduction = sum-of-color-levels`) and asserts that
// reaching threshold-3 against gold reduces the boss's attack
// strength by exactly 3 (the level-3 magnitude per master plan).

import { describe, expect, it } from 'vitest';
import { resolveBoss } from '../../../src/game/track/boss.ts';
import {
  aggregateLibraryDebuffs,
  totalDebuffReduction,
} from '../../../src/game/library/debuff.ts';
import type { BossCard } from '../../../src/data/schema.ts';
import type { RandomAPI } from '../../../src/game/random.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  BuildingDef,
  LibraryColor,
} from '../../../src/data/schema.ts';
import {
  CENTER_CELL_KEY,
  cellKey,
} from '../../../src/game/roles/domestic/grid.ts';
import { seedFreshGame } from '../../helpers/factories.ts';
import { emptyLibraryState } from '../../../src/game/library/state.ts';

const detRandom = (): RandomAPI => ({
  shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
  pickOne: <T>(arr: ReadonlyArray<T>): T => {
    if (arr.length === 0) throw new Error('detRandom.pickOne: empty');
    return arr[0]!;
  },
  rangeInt: (lo: number) => lo,
});

const center: DomesticBuilding = {
  defID: 'Center',
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
};

const placedBuilding = (
  defID: string,
  hp: number,
  maxHp: number,
): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp,
  maxHp,
});

const fakeBuilding = (suffix: string): BuildingDef => ({
  name: `Fake-${suffix}`,
  cost: 1,
  benefit: '',
  note: '',
  maxHp: 1,
});

const card = (color: LibraryColor, suffix: string): LibraryCard => ({
  kind: 'building',
  tier: 1,
  scienceColor: color,
  def: fakeBuilding(`${color}-${suffix}`),
});

const repeat = (color: LibraryColor, n: number): LibraryCard[] => {
  const out: LibraryCard[] = [];
  for (let i = 0; i < n; i += 1) out.push(card(color, String(i)));
  return out;
};

const buildG = (): SettlementState => {
  const G = seedFreshGame(2);
  G.domestic = {
    hand: [],
    grid: {
      [CENTER_CELL_KEY]: center,
      [cellKey(0, 1)]: placedBuilding('Mill', 10, 10),
    },
  };
  G.defense = { hand: [], inPlay: [] };
  G.library = emptyLibraryState(['0', '1']);
  return G;
};

const goldFlavourBoss = (overrides: Partial<BossCard> = {}): BossCard => ({
  kind: 'boss',
  id: 'b-gold',
  name: 'Test Gold-Flavour Boss',
  phase: 10,
  description: 'A boss whose attacks are themed around gold pressure',
  baseAttacks: 1,
  thresholds: { science: 99, economy: 99 },
  // Strength 5 is chosen so a -3 reduction lands at exactly 2 (well
  // above the floor at 0) — leaves a clear "before/after" delta in the
  // building HP reading.
  attackPattern: [{ direction: 'N', offset: 0, strength: 5 }],
  ...overrides,
});

describe('SL 8 — boss × library tableau (gold flavour at threshold-3)', () => {
  it('15 gold cards in the tableau pushes the gold debuff to level 3', () => {
    const G = buildG();
    G.library!.discountTableaus['0'] = repeat('gold', 15);
    const debuffs = aggregateLibraryDebuffs(G);
    expect(debuffs.gold).toBe(3);
    expect(totalDebuffReduction(debuffs)).toBe(3);
  });

  it('threshold-3 against gold reduces the boss attack strength by 3 (V1 uniform aggregate)', () => {
    // Baseline: no tableau → the strength-5 attack hits the Mill for 5,
    // dropping its HP from 10 to 5.
    const baseline = buildG();
    resolveBoss(baseline, detRandom(), goldFlavourBoss());
    expect(baseline.domestic!.grid[cellKey(0, 1)]!.hp).toBe(5);
    expect(baseline.bossResolved).toBe(true);

    // Threshold-3 gold tableau: -3 reduction → strength 2 → Mill 10 → 8.
    const debuffed = buildG();
    debuffed.library!.discountTableaus['0'] = repeat('gold', 15);
    resolveBoss(debuffed, detRandom(), goldFlavourBoss());
    expect(debuffed.domestic!.grid[cellKey(0, 1)]!.hp).toBe(8);
    expect(debuffed.bossResolved).toBe(true);

    // The exact "reduced by 3" delta: difference between baseline damage
    // (5) and debuffed damage (2) is 3 — the level-3 magnitude.
    const baselineDamage = 10 - baseline.domestic!.grid[cellKey(0, 1)]!.hp;
    const debuffedDamage = 10 - debuffed.domestic!.grid[cellKey(0, 1)]!.hp;
    expect(baselineDamage - debuffedDamage).toBe(3);
  });

  it('threshold-3 against gold reduces every attack across a multi-attack boss by 3', () => {
    // 3 attacks, strength 4 each. Baseline: Mill 10 - 4 - 4 - 2 (clamp
    // floor 1 in resolveThreat)? The resolver doesn't floor the
    // building's HP at 1 — Mills can be razed. But damage clamps at the
    // available HP, so 10 → 6 → 2 → 0 if 4+4+2; the third attack hits
    // a 2-HP Mill for 4 but only consumes 2. Pin the actual numbers.
    const baseline = buildG();
    resolveBoss(
      baseline,
      detRandom(),
      goldFlavourBoss({
        baseAttacks: 3,
        attackPattern: [{ direction: 'N', offset: 0, strength: 4 }],
      }),
    );
    const baselineHp = baseline.domestic!.grid[cellKey(0, 1)]!.hp;

    // With threshold-3 gold tableau, each attack lands at strength 1
    // (4 - 3). Three strength-1 attacks chip Mill: 10 → 9 → 8 → 7.
    const debuffed = buildG();
    debuffed.library!.discountTableaus['0'] = repeat('gold', 15);
    resolveBoss(
      debuffed,
      detRandom(),
      goldFlavourBoss({
        baseAttacks: 3,
        attackPattern: [{ direction: 'N', offset: 0, strength: 4 }],
      }),
    );
    expect(debuffed.domestic!.grid[cellKey(0, 1)]!.hp).toBe(7);
    expect(baselineHp).toBeLessThan(7);
  });

  it('the gold debuff is independent of the other colors (no double-counting)', () => {
    // Threshold-3 against gold (15 cards) plus a stray 4 reds (below
    // gold's first threshold) — the debuff reduction stays 3, not 4,
    // because red 4 < 5 falls below tier-1.
    const G = buildG();
    G.library!.discountTableaus['0'] = [
      ...repeat('gold', 15),
      ...repeat('red', 4),
    ];
    const debuffs = aggregateLibraryDebuffs(G);
    expect(debuffs.gold).toBe(3);
    expect(debuffs.red).toBe(0);
    expect(totalDebuffReduction(debuffs)).toBe(3);

    // Strength-5 attack lands at strength 2 — Mill 10 → 8, same as the
    // pure-gold case above.
    resolveBoss(G, detRandom(), goldFlavourBoss());
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(8);
  });

  it('threshold-3 plus a different color at threshold-1 stacks (V1 uniform aggregate sum)', () => {
    // Confirms the V1 "sum across colors" rule from `debuff.ts`. Reaching
    // threshold-3 in gold + threshold-1 in blue gives total 4 reduction.
    const G = buildG();
    G.library!.discountTableaus['0'] = [
      ...repeat('gold', 15),
      ...repeat('blue', 5),
    ];
    const debuffs = aggregateLibraryDebuffs(G);
    expect(debuffs.gold).toBe(3);
    expect(debuffs.blue).toBe(1);
    expect(totalDebuffReduction(debuffs)).toBe(4);

    // Strength-5 attack lands at strength 1 — Mill 10 → 9.
    resolveBoss(G, detRandom(), goldFlavourBoss());
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(9);
  });
});
