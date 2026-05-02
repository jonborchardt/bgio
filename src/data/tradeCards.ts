// Typed loader for src/data/tradeCards.json. Mirrors the pattern in
// src/data/scienceCards.ts / src/data/wanderCards.ts: import the raw JSON,
// validate synchronously at module load, deep-freeze the result.

import tradeCardsRaw from './tradeCards.json';
import { RESOURCES } from '../game/resources/types.ts';
import type { ResourceBag } from '../game/resources/types.ts';

export interface TradeCardDef {
  id: string;
  /** Era / tier index from the design notes (1 = early, 4 = late). */
  number: number;
  required: Partial<ResourceBag>;
  reward: Partial<ResourceBag>;
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
      `TradeCardDef[${index}]: field "${field}" must be an object, got ${typeof raw}`,
    );
  }
  const out: Partial<ResourceBag> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!(RESOURCES as ReadonlyArray<string>).includes(k)) {
      throw new Error(
        `TradeCardDef[${index}]: ${field} key "${k}" is not a known resource`,
      );
    }
    if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) {
      throw new Error(
        `TradeCardDef[${index}]: ${field}.${k} must be a non-negative number, got ${String(v)}`,
      );
    }
    (out as Record<string, number>)[k] = v;
  }
  return out;
};

const validateTradeCards = (raw: unknown): TradeCardDef[] => {
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
      throw new Error(`TradeCardDef[${i}]: field "id" must be a non-empty string`);
    }
    const number = entry.number;
    if (typeof number !== 'number' || !Number.isFinite(number)) {
      throw new Error(`TradeCardDef[${i}]: field "number" must be a number`);
    }
    const card: TradeCardDef = {
      id,
      number,
      required: validateBag(entry.required, i, 'required'),
      reward: validateBag(entry.reward, i, 'reward'),
    };
    if (entry.flavor !== undefined) {
      if (typeof entry.flavor !== 'string') {
        throw new Error(
          `TradeCardDef[${i}]: optional field "flavor" must be a string when present`,
        );
      }
      card.flavor = entry.flavor;
    }
    return card;
  });
};

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) Object.freeze(entry);
  return Object.freeze(arr);
};

export const TRADE_CARDS: ReadonlyArray<TradeCardDef> = deepFreezeArray(
  validateTradeCards(tradeCardsRaw),
);
