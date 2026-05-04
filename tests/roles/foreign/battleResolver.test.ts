// 07.3 — Tests for the pure deterministic battle resolver.
//
// We use the `unitLookup` injection point on `ResolverInput` to feed in
// synthetic UnitDefs so each test is local and doesn't depend on the
// shape of the real UNITS table — except for one smoke test that runs
// real Spearman vs Cutter through the resolver to make sure the
// integration with `abilitiesForUnit` / UNITS still works.

import { describe, expect, it } from 'vitest';
import { resolveBattle } from '../../../src/game/roles/foreign/battleResolver.ts';
import type {
  ResolverInput,
  DamageAllocation,
} from '../../../src/game/roles/foreign/battleResolver.ts';
import { parseAbilities } from '../../../src/game/roles/foreign/abilities.ts';
import type { UnitDef } from '../../../src/data/schema.ts';

// --- helpers ---------------------------------------------------------------

interface SyntheticDef {
  name: string;
  initiative: number;
  attack: number;
  hp: number;
  altStats?: string;
  note?: string;
  cost?: number;
  requires?: string;
}

const makeDef = (s: SyntheticDef): UnitDef => ({
  name: s.name,
  cost: s.cost ?? 0,
  initiative: s.initiative,
  attack: s.attack,
  hp: s.hp,
  altStats: s.altStats ?? '',
  requires: s.requires ?? '',
  note: s.note ?? '',
  range: 1,
  regen: 0,
  firstStrike: false,
  placementBonus: [],
});

const lookupFromTable = (
  defs: ReadonlyArray<UnitDef>,
): ((defID: string) => UnitDef | undefined) => {
  return (defID) => defs.find((d) => d.name === defID);
};

const alloc = (byUnit: Record<string, number>): DamageAllocation => ({
  byUnit,
});

// --- tests -----------------------------------------------------------------

describe('parseAbilities', () => {
  it('finds known V1 ability tags case-insensitively', () => {
    expect(parseAbilities('Focus, Splash, Armor, Heal +2, Single Use')).toEqual(
      ['focus', 'splash', 'armor', 'heal', 'singleUse'],
    );
  });

  it('returns [] for empty input', () => {
    expect(parseAbilities('')).toEqual([]);
  });

  it('ignores unknown V1 keywords like "ammo" / "reload"', () => {
    expect(parseAbilities('3 uses, reload')).toEqual([]);
  });
});

describe('resolveBattle — basic smoke', () => {
  it('runs a 1v1 with real UNITS Spearman vs Cutter to completion', () => {
    // Real Spearman: init 5, atk 3, def 3.
    // Real Cutter:   init 5, atk 3, def 3.
    const input: ResolverInput = {
      player: [{ defID: 'Spearman', count: 1 }],
      enemy: [{ defID: 'Cutter', count: 1 }],
      enemyDamageRule: 'attacksClosest',
      // Two enemy hits of 3 damage each — Spearman dies on the second.
      damageAllocations: [
        alloc({ Spearman: 3 }),
        // Will not actually be consumed because the player kills the
        // Cutter on tick 1 (player goes first by input order on init 5
        // ties). Empty allocations array would be cleaner, but giving
        // an extra entry exercises the "didn't need this one" path
        // without surfacing a validation error.
      ],
    };
    const out = resolveBattle(input);
    expect(out.outcome).toBe('win');
    expect(out.log.length).toBeGreaterThan(0);
    expect(out.validationErrors).toEqual([]);
    expect(out.finalPlayer).toEqual([{ defID: 'Spearman', count: 1 }]);
    expect(out.finalEnemy).toEqual([]);
  });
});

describe('resolveBattle — abilities', () => {
  it('splash hits a second enemy at full damage (alongside the primary)', () => {
    const defs = [
      makeDef({
        name: 'Bomber',
        initiative: 9,
        attack: 5,
        hp: 5,
        note: 'splash',
      }),
      makeDef({ name: 'Mook', initiative: 1, attack: 1, hp: 5 }),
    ];
    const input: ResolverInput = {
      player: [{ defID: 'Bomber', count: 1 }],
      enemy: [{ defID: 'Mook', count: 2 }],
      enemyDamageRule: 'attacksClosest',
      damageAllocations: [alloc({ Bomber: 1 }), alloc({ Bomber: 1 })],
      unitLookup: lookupFromTable(defs),
    };
    const out = resolveBattle(input);
    const splashEvents = out.log.filter((e) => e.kind === 'splash');
    expect(splashEvents.length).toBeGreaterThan(0);
    // Splash damage equals the bomber's attack (no armor on Mook).
    expect(splashEvents[0].kind === 'splash' && splashEvents[0].amount).toBe(5);
  });

  it('armor reduces incoming damage by 1', () => {
    const defs = [
      makeDef({ name: 'Slugger', initiative: 1, attack: 3, hp: 5 }),
      makeDef({
        name: 'Tank',
        initiative: 9,
        attack: 1,
        hp: 5,
        note: 'armor',
      }),
    ];
    const input: ResolverInput = {
      // Slugger is the player so the Tank's armor reduces what Slugger
      // (the player attacker) does to the Tank.
      player: [{ defID: 'Slugger', count: 1 }],
      enemy: [{ defID: 'Tank', count: 1 }],
      enemyDamageRule: 'attacksClosest',
      // Tank goes first (init 9) and hits the Slugger for 1.
      damageAllocations: [alloc({ Slugger: 1 })],
      unitLookup: lookupFromTable(defs),
    };
    const out = resolveBattle(input);
    // Find the player's attack on the tank. Slugger atk 3, armor -1 ⇒ 2.
    const sluggerHit = out.log.find(
      (e) => e.kind === 'attack' && e.attacker.startsWith('Slugger'),
    );
    expect(sluggerHit).toBeDefined();
    expect(sluggerHit?.kind === 'attack' && sluggerHit.amount).toBe(2);
  });

  it('medic heals the lowest-HP ally', () => {
    const defs = [
      makeDef({
        name: 'Medic',
        initiative: 1,
        attack: 1,
        hp: 5,
        note: 'heal +1',
      }),
      makeDef({ name: 'Tanky', initiative: 1, attack: 0, hp: 10 }),
      makeDef({ name: 'Hitter', initiative: 9, attack: 3, hp: 5 }),
    ];
    const input: ResolverInput = {
      player: [
        { defID: 'Medic', count: 1 },
        { defID: 'Tanky', count: 1 },
      ],
      enemy: [{ defID: 'Hitter', count: 1 }],
      enemyDamageRule: 'attacksClosest', // hits Medic first (input index 0)
      // Hitter goes first, Tanky absorbs the 3 damage (Tanky has 10 HP).
      // Then Medic heals Tanky for 1.
      damageAllocations: [
        alloc({ Tanky: 3 }),
        // possibly more if the fight drags on
        alloc({ Tanky: 3 }),
        alloc({ Tanky: 3 }),
        alloc({ Tanky: 1 }),
      ],
      unitLookup: lookupFromTable(defs),
    };
    const out = resolveBattle(input);
    const healEvents = out.log.filter((e) => e.kind === 'heal');
    expect(healEvents.length).toBeGreaterThan(0);
    expect(healEvents[0].kind === 'heal' && healEvents[0].target).toMatch(
      /^Tanky/,
    );
  });

  it('single-use unit drops out after one attack', () => {
    const defs = [
      makeDef({
        name: 'OneShot',
        initiative: 9,
        attack: 2,
        hp: 5,
        altStats: 'single use',
      }),
      makeDef({ name: 'Mook', initiative: 1, attack: 1, hp: 10 }),
    ];
    const input: ResolverInput = {
      player: [{ defID: 'OneShot', count: 1 }],
      enemy: [{ defID: 'Mook', count: 1 }],
      enemyDamageRule: 'attacksClosest',
      // Mook will attack each round once OneShot is exhausted.
      damageAllocations: [
        alloc({ OneShot: 1 }),
        alloc({ OneShot: 1 }),
        alloc({ OneShot: 1 }),
        alloc({ OneShot: 1 }),
        alloc({ OneShot: 1 }),
      ],
    };
    const inputWithLookup: ResolverInput = {
      ...input,
      unitLookup: lookupFromTable(defs),
    };
    const out = resolveBattle(inputWithLookup);
    // OneShot attacks exactly once.
    const oneShotAttacks = out.log.filter(
      (e) => e.kind === 'attack' && e.attacker.startsWith('OneShot'),
    );
    expect(oneShotAttacks.length).toBe(1);
  });
});

describe('resolveBattle — allocation validation', () => {
  it("flags an allocation whose sum doesn't match incoming damage", () => {
    const defs = [
      makeDef({ name: 'Foot', initiative: 1, attack: 1, hp: 5 }),
      makeDef({ name: 'Hitter', initiative: 9, attack: 3, hp: 5 }),
    ];
    const input: ResolverInput = {
      player: [{ defID: 'Foot', count: 1 }],
      enemy: [{ defID: 'Hitter', count: 1 }],
      enemyDamageRule: 'attacksClosest',
      damageAllocations: [alloc({ Foot: 2 })], // Hitter does 3, alloc is 2
      unitLookup: lookupFromTable(defs),
    };
    const out = resolveBattle(input);
    expect(out.outcome).toBe('mid');
    expect(out.validationErrors.some((e) => e.includes('allocation 0'))).toBe(
      true,
    );
    expect(
      out.validationErrors.some((e) => e.includes('does not match')),
    ).toBe(true);
  });

  it('returns mid when allocations are exhausted before resolution', () => {
    const defs = [
      makeDef({ name: 'Foot', initiative: 1, attack: 1, hp: 5 }),
      makeDef({ name: 'Hitter', initiative: 9, attack: 1, hp: 100 }),
    ];
    const input: ResolverInput = {
      player: [{ defID: 'Foot', count: 1 }],
      enemy: [{ defID: 'Hitter', count: 1 }],
      enemyDamageRule: 'attacksClosest',
      damageAllocations: [], // none provided
      unitLookup: lookupFromTable(defs),
    };
    const out = resolveBattle(input);
    expect(out.outcome).toBe('mid');
    expect(
      out.validationErrors.some((e) => e.includes('missing allocation')),
    ).toBe(true);
  });
});
