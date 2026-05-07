// Shared types for the gameboard layout preview page.
//
// Each layout is a small, self-contained React component that paints a
// schematic of where each sub-component would live — placeholders only,
// no live game state. The blurb tells the design intent in one sentence.
//
// We ship layouts for five "boards":
//   - `central`    : the table-shared CentralBoard (track + village +
//                    progress trackers).
//   - `chief`      : the chief role panel.
//   - `science`    : the science role panel.
//   - `domestic`   : the domestic role panel.
//   - `defense`    : the defense role panel.
//
// Layouts are quarantined under `src/ui/boardPreview/layouts/` so the
// "only one set is kept" cleanup later just deletes this whole folder
// once the winner is back-ported into the live components.

import type { ComponentType } from 'react';

export type BoardKind =
  | 'central'
  | 'chief'
  | 'science'
  | 'domestic'
  | 'defense';

export interface LayoutDef {
  /** Stable id, used as a React key + URL-fragment friendly. */
  id: string;
  /** Short title shown on the layout's header. */
  name: string;
  /** One-sentence pitch — what this layout is about. */
  blurb: string;
  /** The schematic itself. Receives no props; renders MUI primitives. */
  Render: ComponentType;
}

export interface BoardSection {
  kind: BoardKind;
  /** Display title for this board's section. */
  label: string;
  /** Per-board sentence describing what this board is. */
  intro: string;
  /** Five layout candidates, in order. */
  layouts: ReadonlyArray<LayoutDef>;
}

export const BOARD_KINDS: ReadonlyArray<BoardKind> = [
  'central',
  'chief',
  'science',
  'domestic',
  'defense',
];

export const BOARD_LABELS: Record<BoardKind, string> = {
  central: 'Central board',
  chief: 'Chief panel',
  science: 'Science panel',
  domestic: 'Domestic panel',
  defense: 'Defense panel',
};
