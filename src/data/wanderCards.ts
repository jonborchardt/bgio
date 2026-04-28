// Typed loader for src/data/wanderCards.json — mirrors the pattern in
// src/data/events.ts (08.1). Wander cards are the 08.4 opponent deck:
// each round-end the opponent flips one wander card and the dispatcher
// applies its effects (positive bonuses, modifiers, etc.).
//
// Schema note: `effects` is intentionally accepted as `unknown[]` here.
// The runtime dispatcher (08.2's `events/dispatcher.ts`) is the
// authoritative validator — if a JSON entry references an `EventEffect`
// kind the dispatcher doesn't know, dispatch throws "unknown effect
// kind" at apply time. Loader-level shape checks stay minimal so 08.4
// can ship without coupling to the dispatcher's effect taxonomy.

import wanderCardsRaw from './wanderCards.json';

export interface WanderCardDef {
  id: string;
  name: string;
  // Loose at this stage — the dispatcher casts this to `EventEffect[]`
  // and validates per-entry at dispatch time.
  effects: unknown[];
  flavor?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const validateWanderCards = (raw: unknown): WanderCardDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`WanderCardDef: expected an array, got ${typeof raw}`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `WanderCardDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `WanderCardDef[${i}]: field "id" must be a non-empty string`,
      );
    }
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `WanderCardDef[${i}]: field "name" must be a non-empty string`,
      );
    }
    const effects = entry.effects;
    if (!Array.isArray(effects)) {
      throw new Error(
        `WanderCardDef[${i}]: field "effects" must be an array`,
      );
    }
    const card: WanderCardDef = {
      id,
      name,
      // Copy so a downstream mutation can't reach back into the JSON
      // module. Frozen below alongside the wrapping array.
      effects: [...effects],
    };
    const flavor = entry.flavor;
    if (flavor !== undefined) {
      if (typeof flavor !== 'string') {
        throw new Error(
          `WanderCardDef[${i}]: field "flavor" must be a string when present`,
        );
      }
      card.flavor = flavor;
    }
    return card;
  });
};

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) {
    // The inner `effects` array is frozen so accidental mutation of a
    // shared card def (e.g. a hook that pushed onto `card.effects`)
    // crashes loudly rather than silently corrupting another draw.
    if ('effects' in entry && Array.isArray((entry as { effects: unknown[] }).effects)) {
      Object.freeze((entry as { effects: unknown[] }).effects);
    }
    Object.freeze(entry);
  }
  return Object.freeze(arr);
};

export const WANDER_CARDS: ReadonlyArray<WanderCardDef> = deepFreezeArray(
  validateWanderCards(wanderCardsRaw),
);
