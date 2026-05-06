// 08.2 — Modifier-query helpers for role moves.
//
// Thin pass-through wrappers over the dispatcher's
// `hasModifierActive` / `consumeModifier` so role moves can read modifier
// state without importing `dispatcher.ts` directly. Keeping the surface
// here means content-driven effect kinds aren't pulled into every role
// module's import graph, and the dispatcher stays the single source of
// truth for how modifiers are stored.

import {
  hasModifierActive as _hasModifierActive,
  consumeModifier as _consumeModifier,
} from './dispatcher.ts';

export const hasModifierActive = _hasModifierActive;
export const consumeModifier = _consumeModifier;
