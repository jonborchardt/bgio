// SL 3.3 — end-of-turn library refill tests.
//
// We exercise the helper directly (`refillLibraryRow`) against
// hand-built `LibraryState` fixtures, then verify integration via
// `scienceSeatDone` — the move that fires the refill.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { refillLibraryRow } from '../../../../src/game/library/refill.ts';
import { scienceSeatDone } from '../../../../src/game/roles/science/seatDone.ts';
import { emptyLibraryState } from '../../../../src/game/library/state.ts';
import type { LibraryCard } from '../../../../src/game/library/types.ts';
import { assignRoles } from '../../../../src/game/roles.ts';
import { bagOf } from '../../../../src/game/resources/bag.ts';
import { initialMats } from '../../../../src/game/resources/playerMat.ts';
import type { ScienceState } from '../../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../../src/game/types.ts';
import type {
  LibraryColor,
  LibraryTier,
} from '../../../../src/data/schema.ts';

const fakeCard = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  name: string,
): LibraryCard => ({
  kind: 'building',
  tier,
  scienceColor,
  def: {
    name,
    cost: 0,
    benefit: '',
    note: '',
    maxHp: 1,
    tier,
    scienceColor,
  },
});

const minimalScience = (): ScienceState => ({
  hand: [],
});

describe('refillLibraryRow (SL 3.3 helper)', () => {
  it('fills nulls left-to-right from the deck', () => {
    const lib = emptyLibraryState(['0']);
    lib.row = [
      fakeCard('green', 1, 'a'),
      null,
      fakeCard('green', 1, 'b'),
      null,
      null,
      fakeCard('green', 1, 'c'),
    ];
    lib.deck = [
      fakeCard('green', 2, 'x'),
      fakeCard('green', 2, 'y'),
      fakeCard('green', 2, 'z'),
    ];
    refillLibraryRow(lib);
    expect(lib.row[0]!.def.name).toBe('a');
    expect(lib.row[1]!.def.name).toBe('x');
    expect(lib.row[2]!.def.name).toBe('b');
    expect(lib.row[3]!.def.name).toBe('y');
    expect(lib.row[4]!.def.name).toBe('z');
    expect(lib.row[5]!.def.name).toBe('c');
    expect(lib.deck).toEqual([]);
  });

  it('stops when the deck is empty (row may have <6 cards)', () => {
    const lib = emptyLibraryState(['0']);
    lib.row = [null, null, null, null, null, null];
    lib.deck = [
      fakeCard('green', 1, 'a'),
      fakeCard('green', 1, 'b'),
      fakeCard('green', 1, 'c'),
      fakeCard('green', 1, 'd'),
    ];
    refillLibraryRow(lib);
    expect(lib.row[0]!.def.name).toBe('a');
    expect(lib.row[1]!.def.name).toBe('b');
    expect(lib.row[2]!.def.name).toBe('c');
    expect(lib.row[3]!.def.name).toBe('d');
    expect(lib.row[4]).toBeNull();
    expect(lib.row[5]).toBeNull();
    expect(lib.deck).toEqual([]);
  });

  it('preserves deck order (no reshuffle)', () => {
    const lib = emptyLibraryState(['0']);
    lib.row = [null, null, null, null, null, null];
    const deck = [
      fakeCard('green', 1, '1st'),
      fakeCard('green', 1, '2nd'),
      fakeCard('green', 1, '3rd'),
      fakeCard('green', 1, '4th'),
      fakeCard('green', 1, '5th'),
      fakeCard('green', 1, '6th'),
      fakeCard('green', 1, '7th'),
    ];
    lib.deck = [...deck];
    refillLibraryRow(lib);
    expect(lib.row.map((c) => c!.def.name)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
      '6th',
    ]);
    // Remaining deck card stays in place.
    expect(lib.deck).toHaveLength(1);
    expect(lib.deck[0]!.def.name).toBe('7th');
  });

  it('no-op when row already full', () => {
    const lib = emptyLibraryState(['0']);
    const initial = [
      fakeCard('green', 1, 'a'),
      fakeCard('green', 1, 'b'),
      fakeCard('green', 1, 'c'),
      fakeCard('green', 1, 'd'),
      fakeCard('green', 1, 'e'),
      fakeCard('green', 1, 'f'),
    ];
    lib.row = [...initial];
    lib.deck = [fakeCard('green', 2, 'x')];
    refillLibraryRow(lib);
    expect(lib.row.map((c) => c!.def.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(lib.deck).toHaveLength(1);
  });
});

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const build4pState = (
  rowCards: ReadonlyArray<LibraryCard | null>,
  deckCards: ReadonlyArray<LibraryCard>,
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
  const seats = Object.keys(roleAssignments);
  const lib = emptyLibraryState(seats);
  for (let i = 0; i < lib.row.length; i++) {
    lib.row[i] = rowCards[i] ?? null;
  }
  lib.deck = [...deckCards];
  return {
    bank: bagOf({}),
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science: minimalScience(),
    library: lib,
  };
};

const callSeatDone = (
  G: SettlementState,
  playerID: string,
  ctx: Ctx,
): unknown => {
  const mv = scienceSeatDone as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string;
  }) => unknown;
  return mv({ G, ctx, playerID });
};

describe('scienceSeatDone fires refill (SL 3.3 integration)', () => {
  it('after 2 buys + 1 burn → seat-done refills row to full', () => {
    // Simulate 3 nulls (as if the seat bought / burned 3 cards).
    const card1 = fakeCard('green', 1, 'r0');
    const card2 = fakeCard('green', 1, 'r1');
    const card3 = fakeCard('green', 1, 'r2');
    const deck = [
      fakeCard('green', 2, 'd0'),
      fakeCard('green', 2, 'd1'),
      fakeCard('green', 2, 'd2'),
      fakeCard('green', 2, 'd3'),
      fakeCard('green', 2, 'd4'),
    ];
    const G = build4pState([null, card1, null, card2, null, card3], deck);
    G.science!.scienceBurnedThisRound = true;
    callSeatDone(G, '1', ctxScienceTurn('1'));
    expect(G.library!.row.every((s) => s !== null)).toBe(true);
    expect(G.library!.deck).toHaveLength(2); // 5 - 3 used
    expect(G.othersDone!['1']).toBe(true);
  });

  it('sparse deck — after seat-done, row may be partial; deck empty', () => {
    const deck = [fakeCard('green', 1, 'a'), fakeCard('green', 1, 'b')];
    const G = build4pState(
      [null, null, null, null, null, null],
      deck,
    );
    callSeatDone(G, '1', ctxScienceTurn('1'));
    expect(G.library!.row[0]!.def.name).toBe('a');
    expect(G.library!.row[1]!.def.name).toBe('b');
    expect(G.library!.row[2]).toBeNull();
    expect(G.library!.deck).toEqual([]);
  });

  it('seat-done with no library state still flips othersDone', () => {
    const G = build4pState([], []);
    delete (G as { library?: unknown }).library;
    callSeatDone(G, '1', ctxScienceTurn('1'));
    expect(G.othersDone!['1']).toBe(true);
  });
});
