// Tests for `playerView` redaction.
//
// These deliberately use placeholder hand shapes (`hands[seat] = { ... }`)
// rather than the real Foreign deck / Domestic hand types from 06.1 / 07.1.
// The goal is to lock down the visible API of the redactor — counts stay
// stable, hidden contents become `null` — without coupling to a hand shape
// that hasn't been designed yet. When 06.1/07.1 land, those plans will add
// their own targeted tests over the real shapes.

import type { Ctx } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import { playerViewFor as playerView } from '../src/game/playerView.ts';
import { assignRoles } from '../src/game/roles.ts';
import type { SettlementState } from '../src/game/types.ts';
import { initialBank } from '../src/game/resources/bank.ts';

// Minimal Ctx — `playerView` only consumes `playerID`, but bgio's signature
// asks for the full Ctx so we cast a stub. Tests that need a real Ctx should
// drive through a Client; this file's whole point is unit-level coverage of
// the redactor.
const fakeCtx = {} as Ctx;

const buildState = (): SettlementState => {
  const roleAssignments = assignRoles(2);
  return {
    bank: initialBank(),
    centerMat: { circles: {}, tradeRequest: null },
    roleAssignments,
    round: 1,
    wallets: {},
    hands: {
      // Seat 0 holds chief + science — public roles, nothing to redact here.
      // We still give it a placeholder shape to confirm public seats stay
      // structurally identical post-view.
      '0': { domestic: ['domA', 'domB'] },
      // Seat 1 holds domestic + foreign — its `domestic` and `foreign`
      // arrays plus `foreignDecks` should redact when the viewer doesn't
      // hold those roles.
      '1': {
        foreign: ['forA', 'forB'],
        foreignDecks: { battle: [1, 2, 3], trade: ['t1', 't2'] },
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

  it('seat 0 (chief+science) cannot see seat 1 foreign hand or decks', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, '0');

    const seat1 = view.hands['1'] as {
      foreign: unknown[];
      foreignDecks: Record<string, unknown[]>;
    };
    // foreign hand redacted: same length, contents nulled.
    expect(seat1.foreign).toEqual([null, null]);
    // foreign decks redacted: same lengths per deck, contents nulled.
    expect(seat1.foreignDecks.battle).toEqual([null, null, null]);
    expect(seat1.foreignDecks.trade).toEqual([null, null]);

    // Seat 0 also doesn't hold `domestic`, but the only `domestic` field on
    // any seat is on seat 0 itself. Seat 0's domestic array is held by seat
    // 0's role assignment, but per the playerView contract `domestic` is
    // owned by whichever seat holds the Domestic role — which is seat 1.
    // Seat 1 has no `domestic` field today, so nothing to assert there.
    // Seat 0's `domestic` field on the test fixture is just placeholder
    // data; the redactor only touches the seat that holds Domestic.
    const seat0 = view.hands['0'] as { domestic: unknown[] };
    expect(seat0.domestic).toEqual(['domA', 'domB']);
  });

  it('seat 1 (domestic+foreign) sees its own foreign hand + decks unredacted', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, '1');

    const seat1 = view.hands['1'] as {
      foreign: unknown[];
      foreignDecks: Record<string, unknown[]>;
    };
    expect(seat1.foreign).toEqual(['forA', 'forB']);
    expect(seat1.foreignDecks.battle).toEqual([1, 2, 3]);
    expect(seat1.foreignDecks.trade).toEqual(['t1', 't2']);

    // Seat 0 (chief+science) is fully public — unchanged for any viewer.
    const seat0 = view.hands['0'] as { domestic: unknown[] };
    expect(seat0.domestic).toEqual(['domA', 'domB']);
  });

  it('spectator (playerID = null) sees every Domestic + Foreign slice redacted', () => {
    const G = buildState();
    const view = playerView(G, fakeCtx, null);

    // Domestic seat is seat 1 — but seat 1 has no `domestic` field in this
    // fixture, so spectator just sees the foreign side redacted on seat 1.
    const seat1 = view.hands['1'] as {
      foreign: unknown[];
      foreignDecks: Record<string, unknown[]>;
    };
    expect(seat1.foreign).toEqual([null, null]);
    expect(seat1.foreignDecks.battle).toEqual([null, null, null]);
    expect(seat1.foreignDecks.trade).toEqual([null, null]);
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
      foreign: unknown[];
    };
    expect(seat1.domestic).toEqual([null, null, null]);
    expect(seat1.foreign).toEqual([null, null]);
  });

  it('preserves visible counts on every redacted array', () => {
    const G = buildState();
    const seat1Before = G.hands['1'] as {
      foreign: unknown[];
      foreignDecks: Record<string, unknown[]>;
    };
    const view = playerView(G, fakeCtx, '0');
    const seat1After = view.hands['1'] as {
      foreign: unknown[];
      foreignDecks: Record<string, unknown[]>;
    };

    expect(seat1After.foreign.length).toBe(seat1Before.foreign.length);
    expect(seat1After.foreignDecks.battle.length).toBe(
      seat1Before.foreignDecks.battle.length,
    );
    expect(seat1After.foreignDecks.trade.length).toBe(
      seat1Before.foreignDecks.trade.length,
    );
  });

  it('no-ops gracefully when hands are the placeholder empty objects', () => {
    // The current `setup()` produces `hands[seat] = {}` for every seat.
    // The redactor must not throw and must not invent fields.
    const G: SettlementState = {
      bank: initialBank(),
      centerMat: { circles: {}, tradeRequest: null },
      roleAssignments: assignRoles(2),
      round: 0,
      hands: { '0': {}, '1': {} },
      wallets: {},
    };
    const view = playerView(G, fakeCtx, '0');
    expect(view.hands['0']).toEqual({});
    expect(view.hands['1']).toEqual({});

    const spectator = playerView(G, fakeCtx, null);
    expect(spectator.hands['0']).toEqual({});
    expect(spectator.hands['1']).toEqual({});
  });
});
