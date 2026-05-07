// Typed loader for the active deck's events.json. Validation runs at
// module load — if the JSON drifts out of shape, importing this file
// throws synchronously. The validator + types live in
// `./eventsValidator.ts` so the test fixture's events shim can reach
// the validator without bouncing through the test alias on this file.

import { pickFromGlob } from './deckSelection.ts';
import {
  validateEvents,
  type EventCardDef,
  type EventColor,
} from './eventsValidator.ts';

export { validateEvents };
export type { EventCardDef, EventColor };

const EVENTS_BY_DECK = import.meta.glob<unknown>(
  '/card-decks/*/events.json',
  { eager: true, import: 'default' },
);
const eventsRaw = pickFromGlob(EVENTS_BY_DECK, 'events.json');

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
