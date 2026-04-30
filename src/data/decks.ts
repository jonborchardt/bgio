// Typed loaders for src/data/battleCards.json and tradeCards.json — mirrors
// the pattern in src/data/index.ts and src/data/scienceCards.ts but lives in
// its own file because BattleCardDef / TradeCardDef are specific to the
// Foreign role (07.x) and reference ResourceBag from src/game/resources, which
// the generic data barrel does not.
//
// As with the other loaders, validation runs at module load — if either JSON
// file drifts out of shape, importing this file throws synchronously.

import battleCardsRaw from './battleCards.json';
import tradeCardsRaw from './tradeCards.json';
import { RESOURCES } from '../game/resources/types.ts';
import type { ResourceBag } from '../game/resources/types.ts';

export interface BattleUnit {
  name: string;
  count?: number;
}

export interface BattleCardDef {
  id: string;
  number: number; // sort key — low draws first
  units: BattleUnit[];
  reward?: Partial<ResourceBag>;
  failure?: { tribute: Partial<ResourceBag> };
  flavor?: string;
}

export interface TradeCardDef {
  id: string;
  number: number;
  required: Partial<ResourceBag>;
  reward: Partial<ResourceBag>;
  flavor?: string;
}

// --- helpers ---------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const validatePartialBag = (
  raw: unknown,
  context: string,
): Partial<ResourceBag> => {
  if (!isPlainObject(raw)) {
    throw new Error(`${context}: expected an object, got ${typeof raw}`);
  }
  const bag: Partial<ResourceBag> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(RESOURCES as ReadonlyArray<string>).includes(key)) {
      throw new Error(`${context}: key "${key}" is not a known resource`);
    }
    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
      throw new Error(
        `${context}: "${key}" must be a non-negative number, got ${String(value)}`,
      );
    }
    (bag as Record<string, number>)[key] = value;
  }
  return bag;
};

const validateNumber1to4 = (raw: unknown, context: string): number => {
  if (
    typeof raw !== 'number' ||
    !Number.isInteger(raw) ||
    raw < 1 ||
    raw > 4
  ) {
    throw new Error(
      `${context}: field "number" must be an integer in 1..4, got ${String(raw)}`,
    );
  }
  return raw;
};

const validateBattleUnits = (raw: unknown, context: string): BattleUnit[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`${context}: field "units" must be an array`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${context}.units[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `${context}.units[${i}]: field "name" must be a non-empty string`,
      );
    }
    let count: number | undefined;
    if (entry.count !== undefined) {
      if (
        typeof entry.count !== 'number' ||
        !Number.isInteger(entry.count) ||
        entry.count < 1
      ) {
        throw new Error(
          `${context}.units[${i}]: field "count" must be a positive integer if present, got ${String(entry.count)}`,
        );
      }
      count = entry.count;
    }
    const unit: BattleUnit = { name };
    if (count !== undefined) unit.count = count;
    return unit;
  });
};

// --- validators ------------------------------------------------------------

export const validateBattleCards = (raw: unknown): BattleCardDef[] => {
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
      throw new Error(
        `BattleCardDef[${i}]: field "id" must be a non-empty string`,
      );
    }
    const number = validateNumber1to4(entry.number, `BattleCardDef[${i}]`);
    const units = validateBattleUnits(entry.units, `BattleCardDef[${i}]`);

    const card: BattleCardDef = { id, number, units };

    if (entry.reward !== undefined) {
      card.reward = validatePartialBag(
        entry.reward,
        `BattleCardDef[${i}].reward`,
      );
    }
    if (entry.failure !== undefined) {
      if (!isPlainObject(entry.failure)) {
        throw new Error(
          `BattleCardDef[${i}].failure: expected an object, got ${typeof entry.failure}`,
        );
      }
      const tribute = validatePartialBag(
        entry.failure.tribute,
        `BattleCardDef[${i}].failure.tribute`,
      );
      card.failure = { tribute };
    }
    if (entry.flavor !== undefined) {
      if (typeof entry.flavor !== 'string') {
        throw new Error(
          `BattleCardDef[${i}]: field "flavor" must be a string if present`,
        );
      }
      card.flavor = entry.flavor;
    }
    return card;
  });
};

export const validateTradeCards = (raw: unknown): TradeCardDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`TradeCardDef: expected an array, got ${typeof raw}`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `TradeCardDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `TradeCardDef[${i}]: field "id" must be a non-empty string`,
      );
    }
    const number = validateNumber1to4(entry.number, `TradeCardDef[${i}]`);
    const required = validatePartialBag(
      entry.required,
      `TradeCardDef[${i}].required`,
    );
    const reward = validatePartialBag(
      entry.reward,
      `TradeCardDef[${i}].reward`,
    );

    const card: TradeCardDef = { id, number, required, reward };

    if (entry.flavor !== undefined) {
      if (typeof entry.flavor !== 'string') {
        throw new Error(
          `TradeCardDef[${i}]: field "flavor" must be a string if present`,
        );
      }
      card.flavor = entry.flavor;
    }
    return card;
  });
};

// --- frozen exports --------------------------------------------------------

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) Object.freeze(entry);
  return Object.freeze(arr);
};

export const BATTLE_CARDS: ReadonlyArray<BattleCardDef> = deepFreezeArray(
  validateBattleCards(battleCardsRaw),
);

export const TRADE_CARDS: ReadonlyArray<TradeCardDef> = deepFreezeArray(
  validateTradeCards(tradeCardsRaw),
);
