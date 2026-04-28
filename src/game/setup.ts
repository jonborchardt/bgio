// Pure setup for the Settlement game.
//
// Returns a flat single-phase initial state. Phases, real decks, and
// per-player private hands arrive in 02.x / 03.x; until then `hands` is
// an empty placeholder and the bank is seeded with the default starter
// `gold: 3` (per 03.2). The center mat (03.3) builds one circle per
// non-chief seat and an empty trade-request slot. The Science role's 3×3
// grid + per-cell tech stacks land in 05.1.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, ResourceBag, SettlementState } from './types.ts';
import { assignRoles } from './roles.ts';
import { initialBank } from './resources/bank.ts';
import { bagOf } from './resources/bag.ts';
import { initialMat } from './resources/centerMat.ts';
import { setupScience } from './roles/science/setup.ts';
import { buildBattleDeck, buildTradeDeck } from './roles/foreign/decks.ts';
import { setupEvents } from './events/state.ts';
import { fromBgio, type BgioRandomLike } from './random.ts';

// bgio passes its plugin APIs alongside `ctx`. We accept the shape loosely
// (any extra fields are ignored) and pull `random` off it explicitly so
// `setupScience` gets a `RandomAPI`. The cast at the call site below keeps
// the test fixtures (which pass `{ ctx }` with no `random`) source-compatible
// — when `random` is missing we fall back to a deterministic identity
// shuffle so module-load smoke tests don't throw.
export const setup = (context: { ctx: Ctx; random?: BgioRandomLike }): SettlementState => {
  const { ctx, random } = context;
  const numPlayers = ctx.numPlayers as 1 | 2 | 3 | 4;
  const roleAssignments = assignRoles(numPlayers);

  const hands: Record<PlayerID, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) {
    hands[seat] = {};
  }

  // Per-seat wallets for every non-chief seat. The chief acts on the bank
  // directly and is intentionally absent from the map (see types.ts).
  const wallets: Record<PlayerID, ResourceBag> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      wallets[seat] = bagOf({});
    }
  }

  // Fallback random for paths where bgio hasn't plugged in its plugin yet
  // (e.g., direct unit tests of `setup`). Identity shuffle keeps the result
  // deterministic — tests that need real randomness drive setup through a
  // bgio Client.
  const fallbackRandom: BgioRandomLike = {
    Shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
    Number: () => 0,
  };
  const r = fromBgio(random ?? fallbackRandom);

  return {
    bank: initialBank(),
    centerMat: initialMat(roleAssignments),
    roleAssignments,
    round: 0,
    hands,
    wallets,
    // Phase-progress flags — flipped by 04.2's chiefEndPhase move and the
    // others-phase role stubs. Reset at the top of every `endOfRound` phase.
    phaseDone: false,
    othersDone: {},
    // Per-seat stack for `enterEventStage`/`exitEventStage` (02.2). Lazy-
    // initialized in `enterEventStage` too, but we seed an empty object so
    // observers and tests can rely on the property being present.
    _stageStack: {},
    // Science role: build the initial 3×3 grid + per-cell tech stacks.
    science: setupScience(r),
    // Foreign role: Battle and Trade decks per game-design.md §Setup.Foreign.
    // The hand starts empty; 07.4 fills it via flip-flow moves.
    foreign: {
      battleDeck: buildBattleDeck(r),
      tradeDeck: buildTradeDeck(r),
      hand: [],
    },
    // Cross-cutting events (08.1): four decks (gold/blue/green/red) with
    // 4 cards dealt to the role-holding seat's hand per color.
    events: setupEvents(roleAssignments, r),
  };
};
