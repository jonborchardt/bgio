// Canonical state types for Settlement.
// Pure types only — no runtime, no boardgame.io imports.

import type { ResourceBag } from './resources/types.ts';

export type Role = 'chief' | 'science' | 'domestic' | 'foreign';

// boardgame.io identifies seats as string indices: '0', '1', '2', '3'.
export type PlayerID = string;

export type { ResourceBag };

// Placeholder until 03.3 fills in the center-mat shape.
export type CenterMat = Record<string, unknown>;

export interface SettlementState {
  // Public, shared state.
  bank: ResourceBag;
  centerMat: CenterMat;
  roleAssignments: Record<PlayerID, Role[]>;
  round: number;

  // Private slices populated by 02.4; refined per role later.
  // Decks belong to whoever owns them and live under those players' hands.
  hands: Record<PlayerID, unknown>;
}
