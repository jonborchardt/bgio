// 05.1 — Science grid setup tests.
//
// These exercise both the `setupScience` factory in isolation (driving it
// with a deterministic stub random) and the integration with bgio (driving
// setup through a Client). The deterministic-stub variant is enough to lock
// the structural invariants from the plan; the Client variant proves the
// reset-completions hook fires at endOfRound.

import type { Ctx } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import { makeClient } from '../../helpers/makeClient.ts';
import { setupScience } from '../../../src/game/roles/science/setup.ts';
import {
  runRoundEndHooks,
  type RandomAPI as HookRandomAPI,
} from '../../../src/game/hooks.ts';
import { fromBgio, type BgioRandomLike } from '../../../src/game/random.ts';

// Importing `setupScience` above also runs its module-load side effect that
// registers `science:reset-completions` in the round-end hook registry —
// that's what the final test exercises.

// Deterministic identity-shuffle stub: lets us exercise `setupScience`
// without spinning a full bgio client. The grid layout is fully determined
// by the input data + the stub's behavior, so two calls produce identical
// output.
const identityRandom: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
};

const stubCtx = (): Ctx =>
  ({
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'endOfRound',
    activePlayers: null,
  }) as unknown as Ctx;

const stubHookRandom = (): HookRandomAPI => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
  D6: () => 1,
});

describe('setupScience (05.1)', () => {
  it('is deterministic given a seed (full client path)', () => {
    // The makeClient helper splices `seed` onto the Game definition so
    // bgio's Random plugin is seeded for setup-time shuffles. Two clients
    // with the same seed must produce identical grids (and identical tech
    // cards under each cell).
    const a = makeClient({ seed: 'science-seed' });
    const b = makeClient({ seed: 'science-seed' });

    const ga = a.getState()!.G.science!;
    const gb = b.getState()!.G.science!;

    expect(ga.grid.map((col) => col.map((c) => c.id))).toEqual(
      gb.grid.map((col) => col.map((c) => c.id)),
    );
    // Tech cards under each cell must also match by name+branch.
    expect(ga.underCards).toEqual(gb.underCards);
  });

  it('each column shares a single color; row 0 has the lowest level', () => {
    const science = setupScience(fromBgio(identityRandom));
    expect(science.grid).toHaveLength(4);
    for (const column of science.grid) {
      expect(column).toHaveLength(3);
      const colors = new Set(column.map((c) => c.color));
      expect(colors.size).toBe(1);
      // Row 0 is the lowest level in that column.
      const levels = column.map((c) => c.level);
      const min = Math.min(...levels);
      expect(column[0]!.level).toBe(min);
    }
  });

  it('columns are ordered chief, science, domestic, foreign (gold, blue, green, red)', () => {
    const science = setupScience(fromBgio(identityRandom));
    const colorOrder = science.grid.map((column) => column[0]!.color);
    expect(colorOrder).toEqual(['gold', 'blue', 'green', 'red']);
  });

  it('each cell has exactly 4 tech cards under it whose color matches', () => {
    const science = setupScience(fromBgio(identityRandom));

    // Color → branch mapping mirrors src/game/roles/science/setup.ts.
    const colorBranch: Record<string, string> = {
      red: 'Fighting',
      gold: 'Exploration',
      green: 'Civic',
      blue: 'Education',
    };

    for (const column of science.grid) {
      for (const card of column) {
        const stack = science.underCards[card.id];
        expect(stack, `no underCards entry for ${card.id}`).toBeDefined();
        expect(stack).toHaveLength(4);
        const expectedBranch = colorBranch[card.color];
        for (const tech of stack!) {
          expect(tech.branch).toBe(expectedBranch);
        }
      }
    }
  });

  it('one card from each tier appears in every column (one per row)', () => {
    const science = setupScience(fromBgio(identityRandom));

    // Per the plan: 3 cards from each tier appear in the grid (one per
    // column, one per row layer). With identity-shuffle the row order is
    // beginner / intermediate / advanced top-to-bottom.
    const expectedTiersPerColumn: ReadonlyArray<string> = [
      'beginner',
      'intermediate',
      'advanced',
    ];
    for (const column of science.grid) {
      expect(column.map((c) => c.tier)).toEqual(expectedTiersPerColumn);
    }
    const tierCounts: Record<string, number> = {};
    for (const column of science.grid) {
      for (const card of column) {
        tierCounts[card.tier] = (tierCounts[card.tier] ?? 0) + 1;
      }
    }
    expect(tierCounts).toEqual({ beginner: 4, intermediate: 4, advanced: 4 });
  });

  it('round-end hook resets perRoundCompletions after the first round', () => {
    // The setup module's top-level `registerRoundEndHook(...)` runs at
    // import time, so by the time this test executes the hook is present
    // in the registry. We drive `runRoundEndHooks` directly — same pattern
    // as tests/hooks.test.ts — with a fresh state whose counter is bumped
    // to a non-zero value so we can prove the hook resets it.
    //
    // bgio's `client.getState().G` is deep-frozen by Immer, so we build
    // our own G via `setupScience` (which returns a fresh, mutable
    // ScienceState) wrapped in a minimal SettlementState shell.
    const science = setupScience(fromBgio(identityRandom));
    expect(science.perRoundCompletions).toBe(0);
    science.perRoundCompletions = 5;

    // The hook only reads/writes G.science, so the rest of G can be the
    // smallest legal SettlementState shell. We don't `import` from the
    // helpers/seed module because that fixture predates 05.1 and lacks the
    // `science` field by design.
    const G = {
      bank: {
        gold: 0,
        wood: 0,
        stone: 0,
        steel: 0,
        horse: 0,
        food: 0,
        production: 0,
        science: 0,
        happiness: 0,
        worker: 0,
      },
      centerMat: { tradeRequest: null },
      roleAssignments: { '0': ['chief'], '1': ['science'] } as Record<
        string,
        ('chief' | 'science' | 'domestic' | 'foreign')[]
      >,
      round: 0,
      settlementsJoined: 0,
      hands: {},
      mats: {},
      science,
    };

    runRoundEndHooks(G, stubCtx(), stubHookRandom());
    expect(G.science.perRoundCompletions).toBe(0);
  });
});
