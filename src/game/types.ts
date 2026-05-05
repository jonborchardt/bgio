// Canonical state types for Settlement.
// Pure types only — no runtime, no boardgame.io imports.

import type { ResourceBag } from './resources/types.ts';
// Type-only edge for the bank audit trail (chief-tooltip provenance).
// `./resources/bankLog.ts` imports `SettlementState` back from this file,
// so the `import type` keeps the cycle erased.
import type { BankLogEntry } from './resources/bankLog.ts';
// Type-only edge into `./resources/centerMat.ts`. That module imports
// `PlayerID` / `Role` back from this file, but because both edges are
// `import type`-only there is no runtime cycle — TypeScript erases them.
import type { CenterMat } from './resources/centerMat.ts';
// Per-seat player mat (in / out / stash). Same cycle-erasing trick.
import type { PlayerMat } from './resources/playerMat.ts';
// Type-only edge for the canonical TechnologyDef shape — referenced from
// the per-role hand fields (chief/domestic) populated by `scienceComplete`
// in 05.3 when a science card's underlying tech cards are distributed.
import type { TechnologyDef } from '../data/schema.ts';
// Same trick for the Science role state — type-only edge so there is no
// runtime cycle with `./roles/science/setup.ts`, which imports `RandomAPI`
// and `registerRoundEndHook` back from this package.
import type { ScienceState } from './roles/science/setup.ts';
// Same trick for the Defense role state (1.4 — defense redesign). The
// `./roles/defense/types.ts` module is type-only, so the import is purely
// nominal.
import type { DefenseState } from './roles/defense/types.ts';
// Same trick for the Domestic role state (06.1) — `./roles/domestic/types.ts`
// re-imports `PlayerID` from this file at the type level only.
import type { DomesticState } from './roles/domestic/types.ts';
// Same trick for the cross-cutting events state (08.x) — type-only edge so
// there is no runtime cycle with `./events/state.ts`, which imports
// `RandomAPI` and `registerRoundEndHook` back from this package.
import type { EventsState } from './events/state.ts';
// Type-only edge into 08.2's typed `EventEffect` union — used by the
// modifier stack and the awaiting-input map below. `./events/effects.ts`
// has no runtime imports back from this file.
import type { EventEffect } from './events/effects.ts';
// Type-only edge for help-request rows. The runtime module under
// `./requests/move.ts` imports types from this file, so the `import type`
// keeps the cycle erased.
import type { HelpRequest } from './requests/types.ts';
// Defense redesign 2.2 — Global Event Track runtime state. The
// `./track.ts` module is pure (no runtime imports back from this file)
// so a plain type-only edge is enough to keep the cycle erased.
import type { TrackState } from './track.ts';

export type Role = 'chief' | 'science' | 'domestic' | 'defense';

// boardgame.io identifies seats as string indices: '0', '1', '2', '3'.
export type PlayerID = string;

export type {
  ResourceBag,
  CenterMat,
  PlayerMat,
  ScienceState,
  DefenseState,
  EventsState,
  DomesticState,
  TrackState,
};

export interface SettlementState {
  // Public, shared state.
  bank: ResourceBag;
  // Audit trail for every mutation that touches `G.bank`. Powers the
  // ChiefPanel tooltip ("how did we get this number to give out?"). Each
  // entry is a signed delta tagged with `G.round` at the time of the
  // mutation. Optional so older test fixtures stay source-compatible —
  // `appendBankLog` lazily initializes the slot.
  bankLog?: BankLogEntry[];
  // Running maximum of `G.bank.gold` ever observed during the match.
  // Refreshed by `appendBankLog` at every bank mutation, so all
  // bank-touching moves keep it in sync without a per-call hook. The
  // boss's economy threshold checks against this rather than current
  // `bank.gold` so a chief who briefly stockpiles can't fail the check
  // simply by spending the gold afterwards. Optional so older fixtures
  // stay source-compatible.
  economyHigh?: number;
  centerMat: CenterMat;
  roleAssignments: Record<PlayerID, Role[]>;
  round: number;

  // Defense redesign 1.5 (D25): when set to `true`, `endIf` returns a win.
  // The flag is owned by Phase 2.7 (boss resolution) — until then nothing
  // sets it, so the only end-of-game outcome is the `turnCap` time-up
  // path. Defaulted to `false` at setup so `endIf` can read it without a
  // guard.
  bossResolved: boolean;

  // Per-match override for the round-count time-up cap (08.5). When unset,
  // the engine uses `TURN_CAP_DEFAULT` (80). Set at `setup` from
  // `setupData.turnCap` so the lobby form (10.3) can shorten or lengthen
  // a match without rebuilding the game config.
  turnCap?: number;

  // Per-round gold stipend the bank receives at every chiefPhase.onBegin.
  // Set at `setup` from `setupData.chiefStipendPerRound` (default
  // `CHIEF_STIPEND_DEFAULT`). 0 disables the stipend entirely.
  chiefStipend?: number;

  // Optional snapshot of `G.round` at the moment the win condition fired.
  // Set by `resolveBoss` (Phase 2.7) at the same time `bossResolved` flips
  // so the persistence hook (10.7) can write the win-time score even if
  // `G.round` advances before `endIf` is re-checked. `endIf` prefers this
  // when set and falls back to `G.round` otherwise.
  turnsAtWin?: number;

  // Flat post-mortem snapshot written by `endConditions.onEnd` (Phase 2.7)
  // when `endIf` returns a truthy outcome for the first time. Read by
  // server-side score persistence (10.7) and the future lobby-summary UI.
  // Optional so older test fixtures and live mid-game states stay source-
  // compatible — present iff the game has ended.
  _score?: import('./endConditions.ts').RunScore;

  // Private slices populated by 02.4; refined per role later.
  // Decks belong to whoever owns them and live under those players' hands.
  hands: Record<PlayerID, unknown>;

  // Per-seat player mat: `in` (chief just dropped here), `out` (this seat
  // produced for the chief to sweep), `stash` (working pool spent from).
  // Populated for every non-chief seat by `setup` — the chief operates on
  // `G.bank` directly and never owns a mat. The map intentionally omits the
  // chief seat so any accidental `mats[chiefSeat]` lookup surfaces as
  // `undefined` rather than silently spending from a phantom bag.
  mats: Record<PlayerID, PlayerMat>;

  // Phase-progress flags consumed by 02.1's phase `endIf` checks. The real
  // moves that flip these land in 04.2 (chiefEndPhase) and the others-phase
  // role stubs; the optionality keeps existing tests/setups source-compatible.
  phaseDone?: boolean;
  othersDone?: Record<PlayerID, boolean>;

  // 11.7 — flat snapshot of the lobby's setupData choices that affect
  // server-side runtime (bot driving, etc.). The engine itself doesn't
  // branch on these; the 10.9 idle-takeover path consults them when
  // deciding which seats to mark `isBot` on the bgio match metadata.
  // Optional so headless test fixtures don't need to seed it.
  _setup?: {
    soloMode: boolean;
    humanRole?: Role;
  };

  // Per-seat stack of the previous stage(s) before the seat entered a
  // short-lived `playingEvent` interrupt stage (02.2). Typed as `string[]`
  // here rather than `StageName[]` to avoid a circular import with
  // `./phases/stages.ts`; the runtime helpers in that file own the
  // narrower `StageName` subtype.
  _stageStack?: Record<PlayerID, string[]>;

  // Science role state — 3×4 grid of science cards, the tech cards stacked
  // under each, per-card resource contributions, completion log, and the
  // per-round completion counter that the `science:reset-completions` hook
  // clears at endOfRound. Optional so older test fixtures that pre-date 05.1
  // remain source-compatible; hooks and moves that touch it must guard.
  science?: ScienceState;

  // Defense role state — Phase 2 will repopulate this with real units in
  // play, hand of unit cards, and (via 05.3) the red-color tech hand. For
  // 1.4 it's a stub: empty hand, empty inPlay. Optional so older test
  // fixtures that pre-date 1.4 remain source-compatible; moves and the
  // playerView redactor must guard for `undefined`.
  defense?: DefenseState;

  // Defense redesign 2.2 — Global Event Track (D19). Built at setup by
  // `buildTrack` (one shuffle per phase pile, then concatenate phases in
  // order). Phase 2.3 will wire `chiefFlipTrack` against `advanceTrack`;
  // Phase 2.5's red-tech "peek N" effects will read `peekFollowing`.
  //
  // Fully public: every player sees the same `G.track`. `playerView`
  // performs no redaction — the face-up next card is the table-presence
  // telegraph the design leans on. Optional so older fixtures (pre-2.2)
  // stay source-compatible; helpers and moves that touch it must guard.
  track?: TrackState;

  // Cross-cutting events state (08.x): per-color decks, per-seat hands /
  // used / playedThisRound. Built at setup by 08.1. Optional so older test
  // fixtures that pre-date 08.1 remain source-compatible; moves and hooks
  // that touch it must guard.
  events?: EventsState;

  // Feature-flag bag toggled by later slices' `setup` once the
  // corresponding state shape exists. Used by stub moves that need to
  // short-circuit until the real implementation lands. Optional so older
  // fixtures stay source-compatible.
  // - `workersEnabled` (04.3): set true by 06.1 once `domestic.grid` exists.
  _features?: {
    workersEnabled?: boolean;
  };

  // Per-round "the seat that holds <role> already played their event card"
  // ledger. Filled in by 04.4 / 05.4 / 06.6 / 07.6 stubs and the 08.2
  // dispatcher. Cleared by an 08.x round-end hook. Optional so tests /
  // fixtures that don't exercise events don't need to seed it.
  _eventPlayedThisRound?: {
    chief?: boolean;
    science?: boolean;
    domestic?: boolean;
    defense?: boolean;
  };

  // 08.2 — modifier stack pushed by the event-effect dispatcher. Effects
  // that condition a *subsequent* move (e.g. `doubleScience`, `forbidBuy`)
  // push themselves here on dispatch; the move consults
  // `hasModifierActive(...)` and calls `consumeModifier(...)` after
  // applying. Optional so test fixtures and pre-08.2 setups stay clean.
  _modifiers?: EventEffect[];

  // 08.2 — per-seat "awaiting follow-up input" map. The dispatcher stashes
  // an effect here when it can't apply immediately (e.g.
  // `swapTwoScienceCards` needs the seat to pick which two cards). The
  // follow-up `eventResolve(payload)` move (08.3) reads this slot, applies
  // the effect with the payload, and clears the entry. Optional for the
  // same reason as `_modifiers`.
  _awaitingInput?: Record<PlayerID, EventEffect>;

  // Chief-role-specific runtime state — worker token reserve, etc. Filled
  // out incrementally as chief features land (04.3 introduces `workers`).
  // 05.3 adds the optional `hand` slot: the Chief receives gold-color
  // technology cards distributed by `scienceComplete`. Optional so existing
  // tests / fixtures stay clean.
  chief?: {
    workers: number;
    hand?: TechnologyDef[];
  };

  // Domestic role state — the full shape lands in 06.1 (hand of buildings
  // + placed-building grid). 05.3's `scienceComplete` distributes green-
  // color tech cards to the Domestic seat; those go into the optional
  // `techHand` slot inside `DomesticState` (renamed from `hand` so the
  // 06.1 plan's `hand: BuildingDef[]` slot stays unambiguous). 04.3's
  // `chiefPlaceWorker` stub still reads `domestic.grid[key].worker` — the
  // new `DomesticBuilding` shape is a superset of the previous stub shape
  // (it adds `defID` + `upgrades` alongside the existing `worker` field),
  // so the stub keeps working unchanged.
  domestic?: DomesticState;

  // Per-seat ordered log of cards the seat has played / placed /
  // recruited. Each entry carries enough info for the UI to render the
  // card via `cardById(id)` and surface "what round did I play this in".
  // Public state — every seat sees every other seat's graveyard (it's a
  // table-visible discard pile, not secret information). Optional so
  // older test fixtures stay source-compatible; helpers lazy-init.
  graveyards?: Record<PlayerID, GraveyardEntry[]>;

  // Generic "1 undo at a time" slot — written by every undoable card-play
  // / recruit move via `markUndoable`, cleared by every other mutating
  // move via `clearUndoable`, restored by the `undoLast` move. Carries a
  // full deep clone of G as it was right before the move's mutations,
  // plus a UI label and the seat that owns the undo. See `./undo.ts` for
  // the contract and the parallel-actives reasoning.
  _lastAction?: import('./undo.ts').UndoSnapshot;

  // Per-recipient help requests: "I want to do X, you have what I need."
  // Toggled via the `requestHelp` move; auto-cleared at the action's
  // completion site via `clearRequestsForTarget`. Redacted by
  // `playerView` so each viewer sees only rows where they are the
  // requester or recipient. Optional so older test fixtures stay
  // source-compatible.
  requests?: HelpRequest[];
}

/** A single entry in a seat's graveyard log. `cardId` is the canonical
 *  `<kind>:<name>` id from `src/cards/registry.ts` so the UI can resolve
 *  it back to the card def via `cardById`. */
export interface GraveyardEntry {
  cardId: string;
  kind: 'tech' | 'building' | 'unit';
  name: string;
  round: number;
}
