// Pure setup for the Settlement game.
//
// Returns a flat single-phase initial state. Phases, real decks, and
// per-player private hands arrive in 02.x / 03.x; until then `hands` is
// an empty placeholder and the bank is seeded with the default starter
// `gold: 3` (per 03.2). The center mat (03.3) is empty in 1.4 — Phase 2
// will populate it with the global event track. The Science role's 3×4
// grid + per-cell tech stacks land in 05.1.

import type { Ctx } from 'boardgame.io';
import type { ResourceBag, Role, SettlementState } from './types.ts';
import { assignRoles } from './roles.ts';
import { initialBank } from './resources/bank.ts';
import type { BankLogEntry } from './resources/bankLog.ts';
import { initialCenterMat } from './resources/centerMat.ts';
import { initialMats } from './resources/playerMat.ts';
import { setupScience } from './roles/science/setup.ts';
import { setupDomestic } from './roles/domestic/grid.ts';
import { setupEvents } from './events/state.ts';
import { setupWanderDeck } from './opponent/wanderDeck.ts';
import { fromBgio, type BgioRandomLike } from './random.ts';
import { TURN_CAP_DEFAULT } from './endConditions.ts';
import { TRACK_CARDS, UNITS } from '../data/index.ts';
import type { UnitDef } from '../data/schema.ts';
import { buildTrack } from './track.ts';

// Defense redesign 2.5 — starter unit hand for the defense seat. The
// militia starters are the units in `units.json` with no `requires`
// gate (Scout / Archer / Brute). They stay in the hand across recruit
// calls so the seat can repeat-place the same unit; tech-driven
// unlocks (`grantTechUnlocks`) push additional units onto the same
// pile.
const starterUnits = (): UnitDef[] => {
  const out: UnitDef[] = [];
  for (const def of UNITS) {
    if ((def.requires ?? '').trim().length === 0) out.push(def);
  }
  return out;
};

// Per-match tunables passed through bgio's `Match.setupData` (or
// directly to `setup({ ctx, random }, setupData)` in headless tests).
// This is the canonical declaration — `src/lobby/lobbyClient.ts`
// re-exports it so the lobby form and the engine can't drift apart.
export interface SettlementSetupData {
  /** Round cap before time-up triggers (08.5). Engine default = 80. */
  turnCap?: number;
  /** When true, the match is solo: the seat that owns `humanRole` is
   * the only human; every other seat is driven by a server-side bot
   * (10.9 idle-takeover hooks dispatch through buildBotMap from
   * src/lobby/soloConfig.ts). The engine itself does nothing
   * different — it persists the choice on G so the server-side bot
   * driver can read it. */
  soloMode?: boolean;
  /** Required when `soloMode === true`: which role the human plays. */
  humanRole?: Role;
  /** Per-match override on the bank's starting fill. Replaces the
   * default `{ gold: 3 }` rather than merging — matches initialBank's
   * V1 contract from 03.2. */
  startingBank?: Partial<ResourceBag>;
  /** Per-match override on the chief's per-round gold stipend (added
   * to `G.bank` at every chiefPhase.onBegin). Engine default = 2.
   * Set to 0 to disable. */
  chiefStipendPerRound?: number;
}

/** Default per-round chief gold stipend. Tunable via
 *  `SettlementSetupData.chiefStipendPerRound`. */
export const CHIEF_STIPEND_DEFAULT = 2;

// bgio passes its plugin APIs alongside `ctx`. We accept the shape loosely
// (any extra fields are ignored) and pull `random` off it explicitly so
// `setupScience` gets a `RandomAPI`. The cast at the call site below keeps
// the test fixtures (which pass `{ ctx }` with no `random`) source-compatible
// — when `random` is missing we fall back to a deterministic identity
// shuffle so module-load smoke tests don't throw.
export const setup = (
  context: { ctx: Ctx; random?: BgioRandomLike },
  setupData?: SettlementSetupData,
): SettlementState => {
  const { ctx, random } = context;
  const numPlayers = ctx.numPlayers as 1 | 2 | 3 | 4;
  const roleAssignments = assignRoles(numPlayers);

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) {
    hands[seat] = {};
  }

  // Per-seat player mats (in / out / stash) for every non-chief seat. The
  // chief acts on `G.bank` directly and is intentionally absent from the
  // map (see types.ts).
  const mats = initialMats(roleAssignments);

  // Fallback random for paths where bgio hasn't plugged in its plugin yet
  // (e.g., direct unit tests of `setup`). Identity shuffle keeps the result
  // deterministic — tests that need real randomness drive setup through a
  // bgio Client.
  const fallbackRandom: BgioRandomLike = {
    Shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
    Number: () => 0,
  };
  const r = fromBgio(random ?? fallbackRandom);

  // Build the science slice first so we can derive the set of
  // TechnologyDef.name values already taken by Science under-cards. 06.1
  // accepts that set on `setupDomestic` so the Domestic hand can avoid
  // duplicating any tech that's already gated under a science card. Today
  // the Domestic hand is `BuildingDef[]` so this set is reserved for
  // future widening — see the doc on `setupDomestic`.
  const science = setupScience(r);
  const techsAlreadyUsedBy = new Set<string>();
  for (const stack of Object.values(science.underCards)) {
    for (const tech of stack) techsAlreadyUsedBy.add(tech.name);
  }

  const startingBank = initialBank(setupData?.startingBank);
  // Seed the audit trail with the starting balance so the chief tooltip
  // attributes the round-1 bank to "Starting bank" rather than leaving the
  // pre-game gold unexplained.
  const bankLog: BankLogEntry[] = [];
  {
    const seed: Partial<typeof startingBank> = {};
    let nonZero = false;
    for (const [k, v] of Object.entries(startingBank) as [
      keyof typeof startingBank,
      number,
    ][]) {
      if (v !== 0) {
        seed[k] = v;
        nonZero = true;
      }
    }
    if (nonZero) {
      bankLog.push({
        round: 0,
        source: 'setup',
        delta: seed,
        detail: 'Starting bank',
      });
    }
  }

  return {
    bank: startingBank,
    bankLog,
    centerMat: initialCenterMat(),
    roleAssignments,
    round: 0,
    // Defense redesign 1.5 (D25) — boss-resolved win flag. Stays `false`
    // through Phase 1; Phase 2.7's boss-resolution code flips it to `true`
    // when the village survives the boss card on the global event track.
    bossResolved: false,
    // 08.5 time-up cap: per-match override from `setupData.turnCap`, default
    // 80. Stored on G so `endIf` doesn't need to look back at setupData.
    turnCap: setupData?.turnCap ?? TURN_CAP_DEFAULT,
    // Per-round chief gold stipend (added to bank at every chiefPhase.onBegin).
    // Persisted on G so chief.ts doesn't need to re-read setupData.
    chiefStipend:
      setupData?.chiefStipendPerRound ?? CHIEF_STIPEND_DEFAULT,
    // 11.7 — solo-mode bookkeeping. The engine itself doesn't branch on
    // this; it's persisted so server-side bot drivers (10.9) can decide
    // which seats to mark `isBot` on the bgio match metadata.
    _setup: {
      soloMode: setupData?.soloMode === true,
      humanRole: setupData?.humanRole,
    },
    hands,
    mats,
    // Phase-progress flags — flipped by 04.2's chiefEndPhase move and the
    // others-phase role stubs. Reset at the top of every `endOfRound` phase.
    phaseDone: false,
    othersDone: {},
    // Per-seat stack for `enterEventStage`/`exitEventStage` (02.2). Lazy-
    // initialized in `enterEventStage` too, but we seed an empty object so
    // observers and tests can rely on the property being present.
    _stageStack: {},
    // Science role: built above so we could derive `techsAlreadyUsedBy`.
    science,
    // Defense redesign 2.5 — starter unit hand (game-design.md §12: "3
    // starter Militia"). The hand is the pool of units the defense seat
    // can recruit via `defenseBuyAndPlace`; recruits draw from the pool
    // (the card stays in hand) so the seat can repeat-place the same
    // unit. Subsequent units land via tech-driven `grantTechUnlocks`
    // pushing onto `defense.hand`.
    defense: {
      hand: starterUnits(),
      inPlay: [],
    },
    // Defense redesign 2.2 — Global Event Track. Built once at setup
    // from the canonical TRACK_CARDS list: each phase pile is shuffled
    // independently, then piles are concatenated in phase order so the
    // boss (the unique phase-10 card) lands at the very end of
    // `upcoming`. Phase 2.3 wires `chiefFlipTrack` against the helpers
    // in `./track.ts`.
    track: buildTrack(r, TRACK_CARDS),
    // Domestic role (06.1): pile of buildings + empty placement grid.
    domestic: setupDomestic(techsAlreadyUsedBy),
    // Chief role: starter worker reserve. game-design.md §Setup.Chief says
    // "1 worker token" but the parent task pinned the starter pool to 3
    // so 04.3's placement flow has a few moves to exercise before the
    // reserve runs out. Tune this when the formal rules pass.
    chief: { workers: 3 },
    // Now that `domestic.grid` exists, flip the feature flag that 04.3's
    // `chiefPlaceWorker` stub gates behind. With the flag on, the move
    // exits its early-bail branch and runs the real placement
    // validations against the grid.
    _features: { workersEnabled: true },
    // Cross-cutting events (08.1): four decks (gold/blue/green/red) with
    // 4 cards dealt to the role-holding seat's hand per color.
    events: setupEvents(roleAssignments, r),
    // 08.4 — opponent (wander deck). Shuffled at setup; the
    // `opponent:wander-step` round-end hook flips one card per round end
    // and dispatches its effects.
    opponent: { wander: setupWanderDeck(r) },
    // Help requests start empty; populated as players click the helper
    // button next to disabled actions. See `./requests/`.
    requests: [],
  };
};
