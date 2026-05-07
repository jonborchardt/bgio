// Test-only loader for the fixture deck's events.json. Mirrors the freeze
// + validate pipeline in `src/data/events.ts` but reads from the fixture
// folder instead of a card-decks/<id>/events.json.

import eventsRaw from './deck/events.json';
import {
  validateEvents,
  type EventCardDef,
} from '../../src/data/eventsValidator.ts';

export type { EventCardDef, EventColor } from '../../src/data/eventsValidator.ts';

const deepFreeze = (arr: EventCardDef[]): ReadonlyArray<EventCardDef> => {
  for (const entry of arr) {
    if (Array.isArray(entry.effects)) Object.freeze(entry.effects);
    Object.freeze(entry);
  }
  return Object.freeze(arr);
};

export const EVENT_CARDS: ReadonlyArray<EventCardDef> = deepFreeze(
  validateEvents(eventsRaw),
);
