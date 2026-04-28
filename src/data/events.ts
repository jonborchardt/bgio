// Typed loader for src/data/events.json — mirrors the pattern in
// src/data/index.ts and src/data/scienceCards.ts but lives in its own file
// because EventCardDef is specific to the cross-cutting events system (08.x)
// and the `effects` schema will be filled in by 08.2 once the dispatch types
// are nailed down.
//
// As with the other loaders, validation runs at module load — if the JSON
// drifts out of shape, importing this file throws synchronously.
//
// Schema note: `effects` is intentionally accepted as `unknown[]` here. 08.2
// will define the typed `EventEffect` union and tighten this up; right now we
// only assert "must be an array" so 08.1 can ship the deck shape + cycle
// bookkeeping without coupling to the (still-evolving) dispatcher contract.

import eventsRaw from './events.json';

export type EventColor = 'gold' | 'blue' | 'green' | 'red';

export interface EventCardDef {
  id: string;
  color: EventColor;
  name: string;
  // Loose at this stage. 08.2 will replace `unknown[]` with a typed union of
  // effect entries (e.g. `{ kind: 'gainGold'; amount: number } | ...`).
  effects: unknown[];
}

const COLORS: ReadonlySet<EventColor> = new Set([
  'gold',
  'blue',
  'green',
  'red',
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const validateEvents = (raw: unknown): EventCardDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`EventCardDef: expected an array, got ${typeof raw}`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `EventCardDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `EventCardDef[${i}]: field "id" must be a non-empty string`,
      );
    }
    const color = entry.color;
    if (typeof color !== 'string' || !COLORS.has(color as EventColor)) {
      throw new Error(
        `EventCardDef[${i}]: field "color" must be one of gold|blue|green|red, got ${String(color)}`,
      );
    }
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `EventCardDef[${i}]: field "name" must be a non-empty string`,
      );
    }
    const effects = entry.effects;
    if (!Array.isArray(effects)) {
      throw new Error(
        `EventCardDef[${i}]: field "effects" must be an array`,
      );
    }
    return {
      id,
      color: color as EventColor,
      name,
      // Copy so a downstream mutation can't reach back into the JSON module.
      // Frozen below alongside the wrapping array.
      effects: [...effects],
    };
  });
};

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) {
    // The inner `effects` array is also frozen so accidental mutation of a
    // shared card def (e.g. a move that pushed onto `card.effects`) crashes
    // loudly rather than silently corrupting another seat's view.
    if ('effects' in entry && Array.isArray((entry as { effects: unknown[] }).effects)) {
      Object.freeze((entry as { effects: unknown[] }).effects);
    }
    Object.freeze(entry);
  }
  return Object.freeze(arr);
};

export const EVENT_CARDS: ReadonlyArray<EventCardDef> = deepFreezeArray(
  validateEvents(eventsRaw),
);
