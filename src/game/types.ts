// Canonical state types for Settlement.
// Pure types only — no runtime, no boardgame.io imports.

import type { ResourceBag } from './resources/types.ts';
// Type-only edge into `./resources/centerMat.ts`. That module imports
// `PlayerID` / `Role` back from this file, but because both edges are
// `import type`-only there is no runtime cycle — TypeScript erases them.
import type { CenterMat } from './resources/centerMat.ts';
// Same trick for the Science role state — type-only edge so there is no
// runtime cycle with `./roles/science/setup.ts`, which imports `RandomAPI`
// and `registerRoundEndHook` back from this package.
import type { ScienceState } from './roles/science/setup.ts';
// Same trick for the Foreign role state — type-only edge so there is no
// runtime cycle with `./roles/foreign/decks.ts`, which imports `RandomAPI`
// back from this package.
import type { ForeignState } from './roles/foreign/decks.ts';
// Same trick for the cross-cutting events state (08.x) — type-only edge so
// there is no runtime cycle with `./events/state.ts`, which imports
// `RandomAPI` and `registerRoundEndHook` back from this package.
import type { EventsState } from './events/state.ts';

export type Role = 'chief' | 'science' | 'domestic' | 'foreign';

// boardgame.io identifies seats as string indices: '0', '1', '2', '3'.
export type PlayerID = string;

export type { ResourceBag, CenterMat, ScienceState, ForeignState, EventsState };

export interface SettlementState {
  // Public, shared state.
  bank: ResourceBag;
  centerMat: CenterMat;
  roleAssignments: Record<PlayerID, Role[]>;
  round: number;

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

  // Chief-role-specific runtime state — worker token reserve, etc. Filled
  // out incrementally as chief features land (04.3 introduces `workers`).
  // Optional so existing tests / fixtures stay clean.
  chief?: {
    workers: number;
  };

  // Domestic role state. The full shape lands in 06.1 (hand + grid). 04.3's
  // `chiefPlaceWorker` reads `domestic.grid` defensively as a stub until
  // then; the `Record<string, { id; worker }>` shape here is the simplest
  // thing that lets the stub validate cells. 06.1 will redefine this.
  domestic?: {
    grid: Record<string, { id: string; worker: { ownerSeat: PlayerID } | null }>;
  };
}
