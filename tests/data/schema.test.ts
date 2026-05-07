// Defense redesign 1.1 — content schema tests.
//
// Asserts that the migrated `buildings.json` and `units.json` carry every
// new field the schema declares, and that any cross-table reference
// (`UnitDef.placementBonus[].buildingDefID`) resolves to a real building.
// The 1.1 plan ships these defaults; later sub-phases extend the content
// (more placement bonuses, units differentiated by range, etc.) and
// these tests should keep passing without churn.

import { describe, expect, it } from 'vitest';
import { BUILDINGS, UNITS } from '../../src/data/index.ts';

describe('BuildingDef.maxHp (D15)', () => {
  it('every building has an integer maxHp in [1, 4]', () => {
    for (const b of BUILDINGS) {
      expect(Number.isInteger(b.maxHp), `${b.name} maxHp`).toBe(true);
      expect(b.maxHp, `${b.name} maxHp lower bound`).toBeGreaterThanOrEqual(1);
      expect(b.maxHp, `${b.name} maxHp upper bound`).toBeLessThanOrEqual(4);
    }
  });

  it('fortifications carry the high HP slot (Walls / Tower / Garrison / Fortress)', () => {
    // Sanity check on the content seeding so a future re-pass that
    // accidentally drops these into "mid-tier" surfaces here.
    const fortNames = new Set(['Walls', 'Tower', 'Garrison', 'Fortress', 'Citadel']);
    const forts = BUILDINGS.filter((b) => fortNames.has(b.name));
    expect(forts.length).toBeGreaterThan(0);
    for (const f of forts) {
      expect(f.maxHp, `${f.name} should carry maxHp 4`).toBe(4);
    }
  });
});

describe('UnitDef shape (D9, D18)', () => {
  it('every unit has hp / range / regen / firstStrike / placementBonus', () => {
    for (const u of UNITS) {
      expect(typeof u.hp, `${u.name}.hp`).toBe('number');
      expect(u.hp, `${u.name}.hp positive`).toBeGreaterThan(0);
      expect(typeof u.range, `${u.name}.range`).toBe('number');
      expect(u.range, `${u.name}.range >= 1`).toBeGreaterThanOrEqual(1);
      expect(typeof u.regen, `${u.name}.regen`).toBe('number');
      expect(u.regen, `${u.name}.regen >= 0`).toBeGreaterThanOrEqual(0);
      expect(typeof u.firstStrike, `${u.name}.firstStrike`).toBe('boolean');
      expect(Array.isArray(u.placementBonus), `${u.name}.placementBonus`).toBe(
        true,
      );
    }
  });

  it('every placementBonus.buildingDefID resolves to a real BuildingDef.name', () => {
    const buildingNames = new Set(BUILDINGS.map((b) => b.name));
    for (const u of UNITS) {
      for (const pb of u.placementBonus) {
        expect(
          buildingNames.has(pb.buildingDefID),
          `${u.name}.placementBonus references unknown building "${pb.buildingDefID}"`,
        ).toBe(true);
      }
    }
  });

  it('Watchman gains +1 range on Tower (spec example)', () => {
    const watchman = UNITS.find((u) => u.name === 'Watchman');
    expect(watchman).toBeDefined();
    const tower = watchman!.placementBonus.find(
      (pb) => pb.buildingDefID === 'Tower',
    );
    expect(tower).toBeDefined();
    expect(tower!.effect).toEqual({ kind: 'range', amount: 1 });
  });

  it('Sapper gains +1 strength on Forge (spec example)', () => {
    const sapper = UNITS.find((u) => u.name === 'Sapper');
    expect(sapper).toBeDefined();
    const forge = sapper!.placementBonus.find(
      (pb) => pb.buildingDefID === 'Forge',
    );
    expect(forge).toBeDefined();
    expect(forge!.effect).toEqual({ kind: 'strength', amount: 1 });
  });
});
