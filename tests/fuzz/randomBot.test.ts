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
// We deliberately omit the per-color `*PlayGoldEvent` / `*PlayBlueEvent`
// / `*PlayGreenEvent` / `*PlayRedEvent` family for now: those route
// through the 08.2 dispatcher whose `EventEffect` union doesn't yet
// cover the `gainGold` / `gainScience` effects shipped in events.json
// (a known content/dispatcher gap). The fuzz harness's invariants don't
// depend on those moves resolving — bringing them back in once the gap
// closes is a one-line change.
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
  out.push({ move: 'chiefPlaceWorker', args: [{ x: 0, y: 0 }] });

  // Science: contribute 1 gold to a card we can name; the move resolves
  // the id and rejects gracefully when the id doesn't match.
  if (G.science !== undefined) {
    const firstCard = G.science.grid.flat()[0];
    if (firstCard !== undefined) {
      out.push({
        move: 'scienceContribute',
        args: [firstCard.id, { gold: 1 }],
      });
      out.push({ move: 'scienceComplete', args: [firstCard.id] });
    }
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

  // Foreign.
  if (G.foreign !== undefined) {
    const firstUnit = G.foreign.hand[0];
    if (firstUnit !== undefined) {
      out.push({ move: 'foreignRecruit', args: [firstUnit.name] });
      out.push({ move: 'foreignReleaseUnit', args: [firstUnit.name] });
    }
    out.push({ move: 'foreignUpkeep', args: [] });
    out.push({ move: 'foreignFlipBattle', args: [] });
    out.push({ move: 'foreignFlipTrade', args: [] });
    // foreignAssignDamage with an empty allocation list is INVALID_MOVE
    // (resolver returns 'mid'); harmless to try.
    out.push({ move: 'foreignAssignDamage', args: [[]] });
  }

  // Trade discard (no-op when not awaiting).
  out.push({ move: 'chiefDecideTradeDiscard', args: ['existing'] });

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
