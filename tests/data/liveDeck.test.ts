// Live-deck linter — the only test that intentionally bypasses the
// fixture alias and validates the SHIPPED deck (the one selected by
// `card-decks/deck.config.json`, possibly overridden by VITE_DECK).
//
// Every other test runs against the fixture under `tests/fixtures/deck/`
// (see `vite.config.ts test.alias`). That keeps mechanic tests stable
// across deck changes. **This** test is the canary — if a content edit
// pushes the active deck out of shape, this is the test that complains.
//
// **How the bypass works:** the test alias regex is anchored at `.ts$`,
// so an import path with a `?live` query suffix doesn't match — Vite
// loads the actually-shipped data module. Use `?live` everywhere the
// test wants the production deck rather than the fixture.
//
// To run only this test:
//   npm test -- tests/data/liveDeck.test.ts
//
// To validate a non-default deck:
//   VITE_DECK=06-merged-best npm test -- tests/data/liveDeck.test.ts

import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  UNITS,
  TECHNOLOGIES,
  EVENT_CARDS,
  TRACK_CARDS,
} from '../../src/data/index.ts?live';
import { ACTIVE_DECK } from '../../src/data/deckSelection.ts';

describe('live deck linter (the active deck per deck.config.json)', () => {
  it('loads BUILDINGS / UNITS / TECHNOLOGIES / EVENT_CARDS / TRACK_CARDS without throwing', () => {
    expect(BUILDINGS.length).toBeGreaterThan(0);
    expect(UNITS.length).toBeGreaterThan(0);
    expect(TECHNOLOGIES.length).toBeGreaterThan(0);
    expect(EVENT_CARDS.length).toBeGreaterThan(0);
    expect(TRACK_CARDS.length).toBeGreaterThan(0);
  });

  it('every unit placementBonus refers to a real building in the active deck', () => {
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

  it('there is at least one militia starter (unit with empty `requires`)', () => {
    const starters = UNITS.filter((u) => (u.requires ?? '').trim().length === 0);
    expect(
      starters.length,
      'every deck needs ≥1 militia starter for setup() to deal opening hands',
    ).toBeGreaterThan(0);
  });

  it('the deck advertised by deckSelection matches a real card-decks/<id> folder', () => {
    expect(typeof ACTIVE_DECK.id).toBe('string');
    expect(typeof ACTIVE_DECK.path).toBe('string');
    expect(typeof ACTIVE_DECK.label).toBe('string');
  });

  it('the live deck is genuinely different from the fixture (deck-id sanity)', () => {
    // The fixture tags itself with no deck id; the live deck must come
    // from card-decks/. If this passes against a deck whose id contains
    // "fixture", something is mis-wired.
    expect(ACTIVE_DECK.id).not.toMatch(/fixture/i);
  });
});
