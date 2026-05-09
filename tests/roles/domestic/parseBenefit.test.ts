// 06.3 — Benefit-string parser tests.
//
// Most cases are tiny per-string assertions; the "all 17 strings parse"
// case drives the parser from the loader so we catch any new content verb
// the parser doesn't yet handle.

import { describe, expect, it } from 'vitest';
import { parseBenefit } from '../../../src/game/roles/domestic/parseBenefit.ts';
import { BUILDINGS } from '../../../src/data/index.ts';

describe('parseBenefit', () => {
  it('parses "2 food" as a single resource', () => {
    expect(parseBenefit('2 food')).toEqual({
      resources: { food: 2 },
      effects: [],
    });
  });

  it('parses "2 food and 1 production" as two resources', () => {
    expect(parseBenefit('2 food and 1 production')).toEqual({
      resources: { food: 2, production: 1 },
      effects: [],
    });
  });

  it('parses "attack +1" as an attack effect', () => {
    expect(parseBenefit('attack +1')).toEqual({
      resources: {},
      effects: [{ kind: 'attack', amount: 1 }],
    });
  });

  it('parses raw-material verbs (wood / stone / steel / horse)', () => {
    // Raw materials were added to the parser so the Library cost ladders
    // (blue → wood, green → wood / stone, red → stone / steel, plus
    // horse-gated cavalry units) have building-driven production paths
    // and aren't dependent on a single random track-boon flip.
    expect(parseBenefit('2 wood')).toEqual({
      resources: { wood: 2 },
      effects: [],
    });
    expect(parseBenefit('1 stone and 1 production')).toEqual({
      resources: { stone: 1, production: 1 },
      effects: [],
    });
    expect(parseBenefit('1 steel and 2 production and +1 attack')).toEqual({
      resources: { steel: 1, production: 2 },
      effects: [{ kind: 'attack', amount: 1 }],
    });
    expect(parseBenefit('+1 attack and 1 horse')).toEqual({
      resources: { horse: 1 },
      effects: [{ kind: 'attack', amount: 1 }],
    });
  });

  // The unitMaintenance / unitCost verbs were retired by the defense
  // redesign (D14 / D18). Per-unit placement bonuses live on the unit
  // card itself in Phase 2, so the parser no longer recognizes
  // "decrease unit maintenance" or "units cost N less".

  it('parses every benefit string in buildings.json without throwing', () => {
    for (const building of BUILDINGS) {
      expect(
        () => parseBenefit(building.benefit),
        `building "${building.name}" benefit "${building.benefit}"`,
      ).not.toThrow();
    }
  });

  it('throws on an unknown verb with the offending token in the message', () => {
    expect(() => parseBenefit('2 wibble')).toThrowError(/wibble/);
  });
});
