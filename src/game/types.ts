// Canonical state types for Settlement.
// Pure types only — no runtime, no boardgame.io imports.

export type Role = 'chief' | 'science' | 'domestic' | 'foreign';

// boardgame.io identifies seats as string indices: '0', '1', '2', '3'.
export type PlayerID = string;

// Placeholder until 03.1 lands `ResourceBag` under `src/game/resources/`.
// Keeping the shape loose here avoids a cross-stage import dependency.
export type ResourceBag = Record<string, number>;

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
