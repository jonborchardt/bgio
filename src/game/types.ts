// Canonical state types for Settlement.
// Pure types only — no runtime, no boardgame.io imports.

import type { ResourceBag } from './resources/types.ts';
// Type-only edge into `./resources/centerMat.ts`. That module imports
// `PlayerID` / `Role` back from this file, but because both edges are
// `import type`-only there is no runtime cycle — TypeScript erases them.
import type { CenterMat } from './resources/centerMat.ts';

export type Role = 'chief' | 'science' | 'domestic' | 'foreign';

// boardgame.io identifies seats as string indices: '0', '1', '2', '3'.
export type PlayerID = string;

export type { ResourceBag, CenterMat };

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
}
