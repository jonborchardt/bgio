// Typed loader for src/data/battleCards.json. Same shape contract as the
// other 8.x card loaders.

import battleCardsRaw from './battleCards.json';
import { RESOURCES } from '../game/resources/types.ts';
import type { ResourceBag } from '../game/resources/types.ts';

export interface BattleUnitRef {
  /** Unit name — references UNITS[].name in src/data/units.json. */
  name: string;
  count: number;
}

export interface BattleCardDef {
  id: string;
  /** Era / tier index (1 = early, 4 = late). */
  number: number;
  units: ReadonlyArray<BattleUnitRef>;
  reward: Partial<ResourceBag>;
  failure: { tribute: Partial<ResourceBag> };
  flavor?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const validateBag = (
  raw: unknown,
  index: number,
  field: string,
): Partial<ResourceBag> => {
  if (!isPlainObject(raw)) {
    throw new Error(
      `BattleCardDef[${index}]: field "${field}" must be an object, got ${typeof raw}`,
    );
  }
  const out: Partial<ResourceBag> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!(RESOURCES as ReadonlyArray<string>).includes(k)) {
      throw new Error(
        `BattleCardDef[${index}]: ${field} key "${k}" is not a known resource`,
      );
    }
    if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) {
      throw new Error(
        `BattleCardDef[${index}]: ${field}.${k} must be a non-negative number, got ${String(v)}`,
      );
    }
    (out as Record<string, number>)[k] = v;
  }
  return out;
};

const validateUnits = (
  raw: unknown,
  index: number,
): BattleUnitRef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(
      `BattleCardDef[${index}]: field "units" must be an array, got ${typeof raw}`,
    );
  }
  return raw.map((entry, ui) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `BattleCardDef[${index}].units[${ui}]: expected an object, got ${typeof entry}`,
      );
    }
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `BattleCardDef[${index}].units[${ui}]: field "name" must be a non-empty string`,
      );
    }
    const count = entry.count;
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
      throw new Error(
        `BattleCardDef[${index}].units[${ui}]: field "count" must be a positive number`,
      );
    }
    return { name, count };
  });
};

const validateBattleCards = (raw: unknown): BattleCardDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`BattleCardDef: expected an array, got ${typeof raw}`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `BattleCardDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`BattleCardDef[${i}]: field "id" must be a non-empty string`);
    }
    const number = entry.number;
    if (typeof number !== 'number' || !Number.isFinite(number)) {
      throw new Error(`BattleCardDef[${i}]: field "number" must be a number`);
    }
    if (!isPlainObject(entry.failure)) {
      throw new Error(
        `BattleCardDef[${i}]: field "failure" must be an object`,
      );
    }
    const failureTribute = validateBag(
      (entry.failure as Record<string, unknown>).tribute,
      i,
      'failure.tribute',
    );
    const card: BattleCardDef = {
      id,
      number,
      units: validateUnits(entry.units, i),
      reward: validateBag(entry.reward, i, 'reward'),
      failure: { tribute: failureTribute },
    };
    if (entry.flavor !== undefined) {
      if (typeof entry.flavor !== 'string') {
        throw new Error(
          `BattleCardDef[${i}]: optional field "flavor" must be a string when present`,
        );
      }
      card.flavor = entry.flavor;
    }
    return card;
  });
};

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) {
    if ('units' in entry && Array.isArray((entry as { units: unknown[] }).units)) {
      const units = (entry as { units: unknown[] }).units;
      for (const u of units) Object.freeze(u as object);
      Object.freeze(units);
    }
    Object.freeze(entry);
  }
  return Object.freeze(arr);
};

export const BATTLE_CARDS: ReadonlyArray<BattleCardDef> = deepFreezeArray(
  validateBattleCards(battleCardsRaw),
);
