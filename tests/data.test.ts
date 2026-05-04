import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  UNITS,
  TECHNOLOGIES,
  BENEFIT_TOKENS,
} from '../src/data/index.ts';
import {
  validateBuildings,
  validateUnits,
  validateTechnologies,
} from '../src/data/schema.ts';

describe('data loaders', () => {
  it('loads non-empty BUILDINGS, UNITS, and TECHNOLOGIES arrays', () => {
    expect(BUILDINGS.length).toBeGreaterThan(0);
    expect(UNITS.length).toBeGreaterThan(0);
    expect(TECHNOLOGIES.length).toBeGreaterThan(0);
  });

  it('exposes BENEFIT_TOKENS with the documented verbs', () => {
    expect(BENEFIT_TOKENS).toEqual([
      'food',
      'production',
      'science',
      'gold',
      'attack',
      'defense',
      'happiness',
      'unit maintenance',
    ]);
  });

  it('freezes BUILDINGS so direct mutation throws', () => {
    expect(() => {
      (BUILDINGS[0] as { cost: number }).cost = 0;
    }).toThrow();
  });

  it('freezes UNITS and TECHNOLOGIES too', () => {
    expect(() => {
      (UNITS[0] as { cost: number }).cost = 0;
    }).toThrow();
    expect(() => {
      (TECHNOLOGIES[0] as { name: string }).name = 'mutated';
    }).toThrow();
  });
});

describe('validators reject malformed input', () => {
  it('validateBuildings throws on a wrong-typed field with the offending index', () => {
    expect(() => validateBuildings([{ name: 1 }])).toThrow(/BuildingDef\[0\]/);
  });

  it('validateBuildings throws when the input is not an array', () => {
    expect(() => validateBuildings({} as unknown)).toThrow(/BuildingDef/);
  });

  it('validateUnits throws on a missing numeric field with the offending index', () => {
    expect(() =>
      validateUnits([
        {
          name: 'Bad',
          cost: 'free',
          initiative: 1,
          attack: 1,
          hp: 1,
          altStats: '',
          requires: '',
          note: '',
          range: 1,
          regen: 0,
          firstStrike: false,
        },
      ]),
    ).toThrow(/UnitDef\[0\].*cost/);
  });

  it('validateTechnologies throws on a missing string field with the offending index', () => {
    expect(() =>
      validateTechnologies([
        {
          branch: 'X',
          name: 'Y',
          order: '',
          cost: '',
          buildings: '',
          units: '',
          blueEvent: '',
          greenEvent: '',
          redEvent: '',
          // goldEvent is missing
        },
      ]),
    ).toThrow(/TechnologyDef\[0\].*goldEvent/);
  });
});
