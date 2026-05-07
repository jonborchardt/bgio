// Tests for `playerView` redaction.
//
// These deliberately use placeholder hand shapes (`hands[seat] = { ... }`)
// rather than the real Defense / Domestic hand types. The goal is to lock
// down the visible API of the redactor — counts stay stable, hidden
// contents become `null` — without coupling to a hand shape that hasn't
// been finalized yet.

import type { Ctx } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import { playerViewFor as playerView } from '../src/game/playerView.ts';
import { assignRoles } from '../src/game/roles.ts';
import type { SettlementState } from '../src/game/types.ts';
import { initialBank } from '../src/game/resources/bank.ts';
import type { LibraryCard } from '../src/game/library/types.ts';
import type { LibraryState } from '../src/game/library/state.ts';
import { emptyLibraryState } from '../src/game/library/state.ts';

// Minimal Ctx — `playerView` only consumes `playerID`, but bgio's signature
// asks for the full Ctx so we cast a stub. Tests that need a real Ctx should
// drive through a Client; this file's whole point is unit-level coverage of
// the redactor.
const fakeCtx = {} as Ctx;

const buildState = (): SettlementState => {
  const roleAssignments = assignRoles(2);
  return {
    bank: initialBank(),
    roleAssignments,
    round: 1,
    bossResolved: false,
    mats: {},
    hands: {
      // Seat 0 holds chief + science — public roles, nothing to redact here.
      '0': { domestic: ['domA', 'domB'] },
      // Seat 1 holds domestic + defense — its `domestic` and `defense`
      // arrays should redact when the viewer doesn't hold those roles.
      '1': {
        defense: ['defA', 'defB'],
      },
    },
  };
};

describe('playerView', () => {
  it('does not mutate the input G', () => {
    const G = buildState();
    const before = JSON.parse(JSON.stringify(G));
    playerView(G, fakeCtx, '0');
    expect(G).toEqual(before);
  });

  it('seat 0 (chief+science) cannot see seat 1 defense hand', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, '0');

    const seat1 = view.hands['1'] as {
      defense: unknown[];
    };
    // defense hand redacted: same length, contents nulled.
    expect(seat1.defense).toEqual([null, null]);

    // Seat 0's `domestic` field on the test fixture is just placeholder
    // data; the redactor only touches the seat that holds Domestic.
    const seat0 = view.hands['0'] as { domestic: unknown[] };
    expect(seat0.domestic).toEqual(['domA', 'domB']);
  });

  it('seat 1 (domestic+defense) sees its own defense hand unredacted', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, '1');

    const seat1 = view.hands['1'] as {
      defense: unknown[];
    };
    expect(seat1.defense).toEqual(['defA', 'defB']);

    // Seat 0 (chief+science) is fully public — unchanged for any viewer.
    const seat0 = view.hands['0'] as { domestic: unknown[] };
    expect(seat0.domestic).toEqual(['domA', 'domB']);
  });

  it('spectator (playerID = null) sees every Domestic + Defense slice redacted', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, null);

    // Domestic seat is seat 1 — but seat 1 has no `domestic` field in this
    // fixture, so spectator just sees the defense side redacted on seat 1.
    const seat1 = view.hands['1'] as {
      defense: unknown[];
    };
    expect(seat1.defense).toEqual([null, null]);
  });

  it('spectator redacts a Domestic hand on whichever seat holds Domestic', () => {
    // Move the `domestic` array onto seat 1 (where the Domestic role lives).
    const G = buildState();
    G.hands['1'] = {
      ...(G.hands['1'] as object),
      domestic: ['x', 'y', 'z'],
    };
    const view = playerView(G, fakeCtx, null);

    const seat1 = view.hands['1'] as {
      domestic: unknown[];
      defense: unknown[];
    };
    expect(seat1.domestic).toEqual([null, null, null]);
    expect(seat1.defense).toEqual([null, null]);
  });

  it('preserves visible counts on every redacted array', () => {
    const G = buildState();
    const seat1Before = G.hands['1'] as {
      defense: unknown[];
    };
    const view = playerView(G, fakeCtx, '0');
    const seat1After = view.hands['1'] as {
      defense: unknown[];
    };

    expect(seat1After.defense.length).toBe(seat1Before.defense.length);
  });

  it('no-ops gracefully when hands are the placeholder empty objects', () => {
    // The current `setup()` produces `hands[seat] = {}` for every seat.
    // The redactor must not throw and must not invent fields.
    const G: SettlementState = {
      bank: initialBank(),
      roleAssignments: assignRoles(2),
      round: 0,
      bossResolved: false,
      hands: { '0': {}, '1': {} },
      mats: {},
    };
    const view = playerView(G, fakeCtx, '0');
    expect(view.hands['0']).toEqual({});
    expect(view.hands['1']).toEqual({});

    const spectator = playerView(G, fakeCtx, null);
    expect(spectator.hands['0']).toEqual({});
    expect(spectator.hands['1']).toEqual({});
  });
});

// Issue 040 — events.hands[color] is `Record<seat, EventCardDef[]>`.
// The acceptance criterion: even when multiple seats appear in a
// color's map (test fixtures, future N-seats-per-role configs), every
// seat the viewer doesn't own must be redacted. The pre-fix loop
// only redacted `seatOfRole(role)`, so a stray extra seat under the
// same color would leak its hand.
describe('playerView — events.hands multi-seat redaction (issue 040)', () => {
  const eventDef = (id: string) =>
    ({ id, name: id, color: 'green', text: '' }) as unknown;

  // 4-player layout: chief=0, science=1, domestic=2, defense=3 (per
  // assignRoles). Viewer is seat 1 (chief in 4p? no — let's verify
  // by deriving).
  const buildState = (): SettlementState => {
    const roleAssignments = assignRoles(4);
    return {
      bank: initialBank(),
      roleAssignments,
      round: 1,
      bossResolved: false,
      mats: {},
      hands: { '0': {}, '1': {}, '2': {}, '3': {} },
      events: {
        decks: { gold: [], blue: [], green: [], red: [] },
        hands: {
          gold: {},
          blue: {},
          // Two seats stocked for the green color even though only
          // one of them is the canonical domestic seat. The redactor
          // must redact BOTH for a non-domestic viewer.
          green: {
            '0': [eventDef('g1')],
            '2': [eventDef('g2'), eventDef('g3')],
          },
          red: {},
        },
        used: { gold: {}, blue: {}, green: {}, red: {} },
        playedThisRound: {},
      },
    } as unknown as SettlementState;
  };

  it('non-domestic viewer redacts every seat in events.hands.green', () => {
    const G = buildState();
    // Pick a seat that does NOT hold domestic. In assignRoles(4),
    // domestic is at seat '2'; seat '1' is science, never domestic.
    const view = playerView(G, fakeCtx, '1');
    const greenHands = view.events!.hands.green;
    expect(Array.isArray(greenHands['0'])).toBe(true);
    expect(Array.isArray(greenHands['2'])).toBe(true);
    // Both arrays' contents are nulled (counts visible).
    expect(greenHands['0']).toEqual([null]);
    expect(greenHands['2']).toEqual([null, null]);
  });

  it('domestic viewer sees its own color (every seat in green) unredacted', () => {
    const G = buildState();
    // assignRoles(4): seat '2' holds domestic.
    const view = playerView(G, fakeCtx, '2');
    const greenHands = view.events!.hands.green;
    // Both seats' arrays still carry their original (non-null) contents.
    expect(greenHands['0']).toHaveLength(1);
    expect((greenHands['0'] as unknown[])[0]).not.toBeNull();
    expect(greenHands['2']).toHaveLength(2);
    expect((greenHands['2'] as unknown[])[0]).not.toBeNull();
  });

  it('spectator redacts every seat in every color map', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, null);
    const greenHands = view.events!.hands.green;
    expect(greenHands['0']).toEqual([null]);
    expect(greenHands['2']).toEqual([null, null]);
  });
});

// SL fix-2 — `G.library.deck` is the tier-stacked draw pile. Length must
// stay visible (the UI can show "N cards remaining"); the contents and
// order of upcoming flips are hidden information at a real table. Row,
// lostIdeas, and discountTableaus stay public.
describe('playerView — library deck redaction', () => {
  // Minimal LibraryCard fixtures. We don't need the full def shape to
  // verify redaction — only that the entries we put in differ from
  // `null`.
  // Redaction only inspects the array shape, not the entry shape — a
  // minimal stand-in def keeps fixtures cheap. We cast through `unknown`
  // because the fully-typed `BuildingDef` carries fields the redactor
  // never touches.
  const makeCard = (
    name: string,
    tier: 1 | 2 | 3 = 1,
  ): LibraryCard =>
    ({
      kind: 'building',
      tier,
      scienceColor: 'green',
      def: { id: name, name },
    }) as unknown as LibraryCard;

  const buildStateWithLibrary = (): SettlementState => {
    const roleAssignments = assignRoles(2);
    const seats = Object.keys(roleAssignments);
    const library: LibraryState = emptyLibraryState(seats);
    // 30-entry deck, mixed tiers.
    library.deck = Array.from({ length: 30 }, (_, i) =>
      makeCard(`deck-${i}`, ((i % 3) + 1) as 1 | 2 | 3),
    );
    // Public row + burn pile + per-seat tableau.
    library.row = [
      makeCard('row-0'),
      null,
      makeCard('row-2'),
      null,
      makeCard('row-4'),
      null,
    ];
    library.lostIdeas = [makeCard('lost-A'), makeCard('lost-B')];
    library.discountTableaus[seats[0]] = [makeCard('tab-0a')];
    library.discountTableaus[seats[1]] = [makeCard('tab-1a'), makeCard('tab-1b')];

    return {
      bank: initialBank(),
      roleAssignments,
      round: 1,
      bossResolved: false,
      mats: {},
      hands: { '0': {}, '1': {} },
      library,
    };
  };

  it('preserves deck length but nulls every entry', () => {
    const G = buildStateWithLibrary();
    const view = playerView(G, fakeCtx, '0');

    expect(view.library?.deck.length).toBe(30);
    // Every entry redacted — no card name leaks through.
    for (const entry of view.library?.deck ?? []) {
      expect(entry).toBeNull();
    }
  });

  it('redacted deck contents do not match source deck', () => {
    const G = buildStateWithLibrary();
    const sourceNames = G.library!.deck.map((c) => c.def.name);
    const view = playerView(G, fakeCtx, '0');
    const viewedDeck = view.library?.deck ?? [];

    // None of the redacted entries should equal a source card object,
    // and none should expose the source `def.name` strings.
    for (const entry of viewedDeck) {
      expect(entry).toBeNull();
      // Defensive: also confirm we can't traverse `.def.name` on it.
      expect(
        (entry as null | { def?: { name?: string } } | undefined)?.def?.name,
      ).toBeUndefined();
    }
    // Sanity-check the source side wasn't mutated either.
    expect(G.library!.deck.map((c) => c.def.name)).toEqual(sourceNames);
  });

  it('leaves library.row, library.lostIdeas, and library.discountTableaus untouched', () => {
    const G = buildStateWithLibrary();
    const view = playerView(G, fakeCtx, '0');

    // Row preserved — both filled slots and null gaps.
    expect(view.library?.row.length).toBe(6);
    expect(view.library?.row[0]?.def.name).toBe('row-0');
    expect(view.library?.row[1]).toBeNull();
    expect(view.library?.row[2]?.def.name).toBe('row-2');
    expect(view.library?.row[4]?.def.name).toBe('row-4');

    // Lost-ideas preserved.
    expect(view.library?.lostIdeas.map((c) => c.def.name)).toEqual([
      'lost-A',
      'lost-B',
    ]);

    // Per-seat discount tableaus preserved for every seat. (Even
    // another seat's discount cards are public table information per
    // the SL master plan — the whole table can see another seat's
    // accumulated discounts.)
    expect(view.library?.discountTableaus['0']?.map((c) => c.def.name)).toEqual([
      'tab-0a',
    ]);
    expect(view.library?.discountTableaus['1']?.map((c) => c.def.name)).toEqual([
      'tab-1a',
      'tab-1b',
    ]);
  });

  it('redacts deck for a spectator (playerID = null) too', () => {
    const G = buildStateWithLibrary();
    const view = playerView(G, fakeCtx, null);

    expect(view.library?.deck.length).toBe(30);
    for (const entry of view.library?.deck ?? []) {
      expect(entry).toBeNull();
    }
    // Public row still readable to spectators.
    expect(view.library?.row[0]?.def.name).toBe('row-0');
  });

  it('does not mutate the source library.deck', () => {
    const G = buildStateWithLibrary();
    const before = G.library!.deck.slice();
    playerView(G, fakeCtx, '0');
    // Same array contents post-call.
    expect(G.library!.deck).toEqual(before);
    // Source entries still readable.
    expect(G.library!.deck[0]?.def.name).toBe('deck-0');
  });

  it('no-ops cleanly when G.library is undefined', () => {
    const G: SettlementState = {
      bank: initialBank(),
      roleAssignments: assignRoles(2),
      round: 0,
      bossResolved: false,
      hands: { '0': {}, '1': {} },
      mats: {},
    };
    expect(() => playerView(G, fakeCtx, '0')).not.toThrow();
    expect(playerView(G, fakeCtx, '0').library).toBeUndefined();
  });
});
