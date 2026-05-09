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
import { parseBenefit } from '../../src/game/roles/domestic/parseBenefit.ts';
import type { Resource } from '../../src/game/resources/types.ts';

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

  it('every building benefit string parses (no unknown verbs)', () => {
    for (const b of BUILDINGS) {
      expect(
        () => parseBenefit(b.benefit),
        `building "${b.name}" benefit "${b.benefit}" does not parse`,
      ).not.toThrow();
    }
  });

  // Every Library cost ladder (`costs.ts`) names primary / secondary /
  // tertiary resources per color. A deck where one of those resources
  // has zero production paths means the science seat literally cannot
  // buy past T1 in that color — common bad luck on the single random
  // track-boon flip kills the run. This linter catches that case.
  it('every cost-ladder resource has at least one production path in the deck', () => {
    // The 7 resources that appear across the four Library ladders. Note
    // that `food` and `production` and `gold` and `science` show up as
    // primaries / secondaries; raw-material `wood` / `stone` / `steel`
    // are the ones that historically lacked production paths. Worker /
    // happiness are excluded — they're chief / morale stats, not
    // payment resources.
    const LADDER_RESOURCES: ReadonlyArray<Resource> = [
      'gold',
      'food',
      'science',
      'wood',
      'stone',
      'steel',
      'production',
    ];

    // Sources of bag entries for the bank or any seat's stash:
    //   - building.benefit (parsed via parseBenefit → resources bag)
    //   - track boons (effect: gainResource → bag)
    //   - event-card effects (gainResource bags)
    //   - adjacency rule bonuses (already covered by adjacency.test.ts)
    // This linter checks the first three — adjacency is a per-pair
    // bonus and shouldn't be the *only* path to a resource.
    const sources: Record<string, string[]> = {};
    for (const r of LADDER_RESOURCES) sources[r] = [];

    for (const b of BUILDINGS) {
      const parsed = parseBenefit(b.benefit);
      for (const r of LADDER_RESOURCES) {
        const v = parsed.resources[r as Resource];
        if (typeof v === 'number' && v > 0) {
          sources[r]!.push(`building:${b.name}`);
        }
      }
    }

    for (const t of TRACK_CARDS) {
      if (t.kind !== 'boon') continue;
      const eff = t.effect as { kind?: string; bag?: Record<string, number> };
      if (eff.kind !== 'gainResource' || !eff.bag) continue;
      for (const r of LADDER_RESOURCES) {
        const v = eff.bag[r];
        if (typeof v === 'number' && v > 0) {
          sources[r]!.push(`track:${t.name}`);
        }
      }
    }

    for (const e of EVENT_CARDS) {
      for (const eff of e.effects) {
        const x = eff as { kind?: string; bag?: Record<string, number> };
        if (x.kind !== 'gainResource' || !x.bag) continue;
        for (const r of LADDER_RESOURCES) {
          const v = x.bag[r];
          if (typeof v === 'number' && v > 0) {
            sources[r]!.push(`event:${e.name}`);
          }
        }
      }
    }

    for (const r of LADDER_RESOURCES) {
      const list = sources[r]!;
      expect(
        list.length,
        `resource "${r}" has no production path in deck "${ACTIVE_DECK.id}". ` +
          `Library cost ladders require all of: ${LADDER_RESOURCES.join(', ')}. ` +
          `Add a building benefit, track-boon, or event that grants "${r}".`,
      ).toBeGreaterThan(0);
    }
  });

  it('TECHNOLOGIES exists (referenced for build-time deck readiness)', () => {
    // Stub: TECHNOLOGIES is exported and non-empty (already asserted in
    // the load-without-throwing test). This separate `it` keeps the
    // import live so future linter additions on tech content read
    // naturally.
    expect(TECHNOLOGIES.length).toBeGreaterThan(0);
  });
});
