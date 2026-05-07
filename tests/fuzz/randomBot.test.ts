// 11.1 — RandomBot fuzz tests.
//
// Drives a few short games of `RandomBot` against itself and asserts that
// engine invariants hold throughout the run. The point isn't to win — most
// random plays end with `timeUp` — but to make sure no move ever leaves
// negative resource counts or runs the engine forever.
//
// Termination:
//   * Natural: the engine ends the game at `TURN_CAP` (08.5, default 80).
//   * Safety: a `MAX_MOVES` cap per game guards pathological cases where a
//     turn never advances. The fuzz loop tolerates an early exit (Step
//     returning undefined) — we only require that invariants held over
//     the snapshots we did collect.
//
// Driving the bot:
//   bgio's `Step` helper makes one move on a `Client` using a given `Bot`.
//   We supply RandomBot a stub `enumerate` that returns a curated set of
//   "safe" moves with valid args — sidestepping moves that throw on
//   missing args (e.g. `chiefPlaceWorker`) and event-play moves that hit
//   the dispatcher's pre-existing `unknown effect kind: gainGold` gap
//   (08.x content not yet plumbed). Engine invariants (the focus of this
//   suite) don't depend on those moves running.

import { describe, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { RandomBot, Step } from 'boardgame.io/ai';
import type { Ctx } from 'boardgame.io';
import { Settlement } from '../../src/game/index.ts';
import type { SettlementState } from '../../src/game/types.ts';
import {
  assertNoNegativeResources,
  assertConservation,
  assertTurnsBounded,
} from './invariants.ts';

const MAX_MOVES = 500;

// Curated stub-enumerate for RandomBot: list moves with sensible default
// args so the move bodies don't crash on missing parameters. Phase /
// stage gating still collapses to INVALID_MOVE for moves that aren't
// legal at the current state.
//
// Issue 031 expanded the candidate pool to cover defense recruits +
// red-tech plays, domestic upgrades, and the per-color event-play
// family (the original `gainGold` / `gainScience` dispatcher gap was
// retired by the events-loader refactor). Engine invariants
// (no-negative-resources, conservation, turn-bounded) hold across
// the wider move space.
const stubEnumerate = (
  G: SettlementState,
  _ctx: Ctx,
  playerID: string,
): Array<{ move: string; args: unknown[] }> => {
  const out: Array<{ move: string; args: unknown[] }> = [];

  out.push({ move: 'pass', args: [] });

  // Chief moves with sensible args.
  for (const target of Object.keys(G.mats)) {
    if (target === playerID) continue;
    out.push({ move: 'chiefDistribute', args: [target, { gold: 1 }] });
  }
  out.push({ move: 'chiefEndPhase', args: [] });
  out.push({ move: 'chiefFlipTrack', args: [] });
  out.push({ move: 'chiefPlaceWorker', args: [{ x: 0, y: 0 }] });

  // Science: try a Library buy / burn against slot 0 — the move
  // resolves slot legality and rejects gracefully on null slots.
  if (G.library !== undefined) {
    out.push({ move: 'scienceLibraryBuy', args: [0] });
    out.push({ move: 'scienceLibraryBurn', args: [0] });
    out.push({ move: 'scienceSeatDone', args: [] });
  }

  // Domestic: try buying / upgrading from grid origin. Buy uses the first
  // hand entry's name (or a stub string if the hand is empty — engine
  // rejects with INVALID_MOVE).
  if (G.domestic !== undefined) {
    const firstCard = G.domestic.hand[0];
    out.push({
      move: 'domesticBuyBuilding',
      args: [firstCard?.name ?? 'no-such', 0, 0],
    });
    out.push({ move: 'domesticUpgradeBuilding', args: [0, 0, 'noop'] });
    out.push({ move: 'domesticProduce', args: [] });
  }

  // Defense — recruit + place against the (0,0) center cell + a
  // hand-arbitrary cellKey. Move bodies INVALID_MOVE on illegal
  // placement (e.g. center cell), so the bot just bounces those.
  if (G.defense !== undefined) {
    const firstUnit = G.defense.hand[0];
    if (firstUnit !== undefined) {
      out.push({ move: 'defenseBuyAndPlace', args: [firstUnit.name, '0,0'] });
      out.push({ move: 'defenseBuyAndPlace', args: [firstUnit.name, '1,0'] });
    }
    // defensePlay takes a tech def name; the seat's techHand may be
    // empty, in which case the move INVALID_MOVEs harmlessly.
    const firstTech = G.defense.techHand?.[0];
    if (firstTech !== undefined) {
      out.push({ move: 'defensePlay', args: [firstTech.name] });
    }
    out.push({ move: 'defenseSeatDone', args: [] });
  }

  // Domestic repair — INVALID_MOVE when there's nothing damaged at
  // (0,0); we still surface it so the candidate pool covers the
  // spend-sink that closes the loop on threat damage.
  out.push({ move: 'domesticRepair', args: [0, 0] });

  // Per-color event plays. Each move resolves the seat that holds
  // the matching role; INVALID_MOVE for the wrong seat. The args
  // shape is `(eventID)` — pull the first event id from the seat's
  // hand if any, else surface the move with a sentinel id (engine
  // rejects with INVALID_MOVE).
  if (G.events !== undefined) {
    const firstID = (color: 'gold' | 'blue' | 'green' | 'red'): string => {
      const seatMap = G.events!.hands[color];
      const handForViewer = seatMap?.[playerID];
      const id = handForViewer?.[0]?.id;
      return id ?? '__no-event__';
    };
    out.push({ move: 'chiefPlayGoldEvent', args: [firstID('gold')] });
    out.push({ move: 'sciencePlayBlueEvent', args: [firstID('blue')] });
    out.push({ move: 'domesticPlayGreenEvent', args: [firstID('green')] });
  }

  return out;
};

const makeBot = (seed: string): RandomBot =>
  new RandomBot({ enumerate: stubEnumerate, seed });

const buildClient = (numPlayers: 2 | 3 | 4, seed: string) => {
  const seededGame = { ...Settlement, seed } as typeof Settlement;
  const client = Client<SettlementState>({
    game: seededGame,
    numPlayers,
  });
  client.start();
  return client;
};

const runSingleGame = async (
  numPlayers: 2 | 3 | 4,
  seed: string,
): Promise<void> => {
  const client = buildClient(numPlayers, seed);
  const bot = makeBot(seed);

  const snapshots: SettlementState[] = [];
  const initial = client.getState();
  if (initial !== null) snapshots.push(initial.G);

  let moves = 0;
  while (moves < MAX_MOVES) {
    const state = client.getState();
    if (state === null) break;
    if (state.ctx.gameover !== undefined) break;

    let stepped: unknown;
    try {
      stepped = await Step({ store: client.store }, bot);
    } catch (err) {
      throw new Error(
        `RandomBot Step threw on seed='${seed}', move=${moves}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    if (stepped === undefined) break;

    const after = client.getState();
    if (after !== null) snapshots.push(after.G);

    moves += 1;

    // Per-snapshot invariant — surfaces a regression at the exact move
    // that caused it rather than waiting for the run to end.
    assertNoNegativeResources(snapshots[snapshots.length - 1]!);
  }

  // Assert invariants over the full run.
  const final = client.getState();
  if (final !== null) {
    assertNoNegativeResources(final.G);
    assertTurnsBounded(final, MAX_MOVES);
  }
  // V1 conservation: loose per-snapshot delta check — see invariants.ts.
  assertConservation(snapshots);
};

describe('RandomBot fuzz (11.1)', () => {
  // Small loop count keeps the suite under a few seconds. Expand the seed
  // grid in CI if richer coverage becomes worth the runtime.
  const seeds = ['fuzz-a', 'fuzz-b', 'fuzz-c', 'fuzz-d', 'fuzz-e'];

  it.each(seeds)(
    'numPlayers=2, seed=%s — engine survives a random play and invariants hold',
    async (seed) => {
      await runSingleGame(2, seed);
    },
    30000,
  );
});
