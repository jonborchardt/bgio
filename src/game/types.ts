// Canonical state types for Settlement.
// Pure types only — no runtime, no boardgame.io imports.

import type { ResourceBag } from './resources/types.ts';
// Type-only edge into `./resources/centerMat.ts`. That module imports
// `PlayerID` / `Role` back from this file, but because both edges are
// `import type`-only there is no runtime cycle — TypeScript erases them.
import type { CenterMat } from './resources/centerMat.ts';
// Type-only edge for the canonical TechnologyDef shape — referenced from
// the per-role hand fields (chief/domestic) populated by `scienceComplete`
// in 05.3 when a science card's underlying tech cards are distributed.
import type { TechnologyDef } from '../data/schema.ts';
// Same trick for the Science role state — type-only edge so there is no
// runtime cycle with `./roles/science/setup.ts`, which imports `RandomAPI`
// and `registerRoundEndHook` back from this package.
import type { ScienceState } from './roles/science/setup.ts';
// Same trick for the Foreign role state — type-only edge so there is no
// runtime cycle with `./roles/foreign/decks.ts`, which imports `RandomAPI`
// back from this package.
import type { ForeignState } from './roles/foreign/decks.ts';
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

export type Role = 'chief' | 'science' | 'domestic' | 'foreign';

// boardgame.io identifies seats as string indices: '0', '1', '2', '3'.
export type PlayerID = string;

export type {
  ResourceBag,
  CenterMat,
  ScienceState,
  ForeignState,
  EventsState,
  DomesticState,
};

export interface SettlementState {
  // Public, shared state.
  bank: ResourceBag;
  centerMat: CenterMat;
  roleAssignments: Record<PlayerID, Role[]>;
  round: number;

  // Total number of settlements the village has joined / absorbed. Source of
  // truth for the win condition (08.5): the game ends in a win when this
  // reaches 10. Incremented by 07.4 (Foreign battle wins flagged `joins`)
  // and 07.5 (Foreign tribute trade completion). Initialized to 0 by setup.
  settlementsJoined: number;

  // Per-match override for the round-count time-up cap (08.5). When unset,
  // the engine uses `TURN_CAP_DEFAULT` (80). Set at `setup` from
  // `setupData.turnCap` so the lobby form (10.3) can shorten or lengthen
  // a match without rebuilding the game config.
  turnCap?: number;

  // Optional snapshot of `G.round` at the moment the win condition fired.
  // Reserved for the persistence hook (10.7) so the server can write the
  // win-time score even if `G.round` advances further before `endIf` is
  // re-checked. `endIf` itself reads `G.round` directly today.
  turnsAtWin?: number;

  // Private slices populated by 02.4; refined per role later.
  // Decks belong to whoever owns them and live under those players' hands.
  hands: Record<PlayerID, unknown>;

  // Per-seat resource wallet — the buffer between "I pulled tokens from my
  // mat circle" and "I spent them on a card / unit / tech". Populated for
  // every non-chief seat by `setup` (chief acts on the bank directly and
  // never owns a wallet). The map intentionally omits the chief seat so any
  // accidental `wallets[chiefSeat]` lookup surfaces as `undefined` rather
  // than silently spending from a phantom bag.
  wallets: Record<PlayerID, ResourceBag>;

  // Phase-progress flags consumed by 02.1's phase `endIf` checks. The real
  // moves that flip these land in 04.2 (chiefEndPhase) and the others-phase
  // role stubs; the optionality keeps existing tests/setups source-compatible.
  phaseDone?: boolean;
  othersDone?: Record<PlayerID, boolean>;

  // Per-seat stack of the previous stage(s) before the seat entered a
  // short-lived `playingEvent` interrupt stage (02.2). Typed as `string[]`
  // here rather than `StageName[]` to avoid a circular import with
  // `./phases/stages.ts`; the runtime helpers in that file own the
  // narrower `StageName` subtype.
  _stageStack?: Record<PlayerID, string[]>;

  // Science role state — 3×3 grid of science cards, the tech cards stacked
  // under each, per-card resource contributions, completion log, and the
  // per-round completion counter that the `science:reset-completions` hook
  // clears at endOfRound. Optional so older test fixtures that pre-date 05.1
  // remain source-compatible; hooks and moves that touch it must guard.
  science?: ScienceState;

  // Foreign role state — Battle and Trade decks (top-of-deck = lowest number)
  // plus the Foreign hand. Built at setup by 07.1; refined by 07.2-07.4.
  // Optional so older test fixtures that pre-date 07.1 remain source-
  // compatible; moves and the playerView redactor must guard for `undefined`.
  foreign?: ForeignState;

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
    foreign?: boolean;
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

  // 07.5 — set by `placeOrInterruptTrade` when a Foreign-flipped trade
  // card lands on top of an already-occupied `centerMat.tradeRequest` slot.
  // The pending TradeCardDef itself is held in `G.foreign.pendingTrade`;
  // this boolean is the cross-cutting "chief, please decide" flag the
  // `chiefDecideTradeDiscard` move gates on. V1 simplification: bgio's
  // `setStage` only acts on the calling seat, so we don't try to push the
  // chief into the `awaitingChiefDecision` stage from inside a foreign
  // move — the flag is the contract instead. Cleared by
  // `chiefDecideTradeDiscard`.
  _awaitingChiefTradeDiscard?: boolean;

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
}
