// Canonical card sizes shared by every card component.
//
// Five sizes, all served by the same component per card kind (no parallel
// "viz" vs "game" forks). Each size targets a use case:
//
//   - `micro`   one-line chip with name + kind icon. For lists,
//               autocomplete results, search dropdowns, breadcrumbs.
//   - `small`   postage-stamp tile (~6rem). For React Flow graph nodes,
//               compact hand strips, dense grids.
//   - `normal`  the canonical "playing card" representation (~11rem).
//               This is the look every other size riffs off.
//   - `detailed`  `normal` plus full benefit text + relationship chips.
//                 For hover tooltips and side-drawer panels.
//   - `page`    full-width article. Hero card on the left, every
//               relationship + reverse-relationship + flavor on the
//               right. Used inside the relationships modal.

export type CardSize = 'micro' | 'small' | 'normal' | 'detailed' | 'page';

export const CARD_SIZES: ReadonlyArray<CardSize> = [
  'micro',
  'small',
  'normal',
  'detailed',
  'page',
];

export const CARD_SIZE_LABELS: Record<CardSize, string> = {
  micro: 'Micro',
  small: 'Small',
  normal: 'Normal',
  detailed: 'Detailed',
  page: 'Page',
};

// Pixel-width hints used by layout code (graph autosizing, list
// virtualization). Components can choose to ignore these — the visual
// frame may pick its own width via sx — but the values are the source of
// truth for "how much horizontal room does a card of this size want."
export const CARD_WIDTH: Record<CardSize, number> = {
  micro: 140,
  small: 110,
  normal: 180,
  detailed: 260,
  page: 480,
};

export const CARD_HEIGHT: Record<CardSize, number> = {
  micro: 28,
  small: 90,
  normal: 150,
  detailed: 220,
  page: 360,
};
