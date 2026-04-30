// 08.2 — Modifier-query helpers for role moves.
//
// Thin pass-through wrappers over the dispatcher's
// `hasModifierActive` / `consumeModifier` so role moves
// (`scienceContribute`, `domesticBuyBuilding`, etc.) can read modifier
// state without importing `dispatcher.ts` directly. Keeping the surface
// here means content-driven effect kinds aren't pulled into every role
// module's import graph, and the dispatcher stays the single source of
// truth for how modifiers are stored.
//
// Each kind gets its own named helper because that's what the call sites
// read more naturally: `if (hasDoubleScience(G)) { ... consumeDoubleScience(G); }`.
// The generic `hasModifierActive` is also re-exported for cases where a
// caller already has the kind value as a variable.

import type { SettlementState } from '../types.ts';
import {
  hasModifierActive as _hasModifierActive,
  consumeModifier as _consumeModifier,
} from './dispatcher.ts';

export const hasModifierActive = _hasModifierActive;
export const consumeModifier = _consumeModifier;

export const hasDoubleScience = (G: SettlementState): boolean =>
  _hasModifierActive(G, 'doubleScience');

export const consumeDoubleScience = (G: SettlementState): void => {
  _consumeModifier(G, 'doubleScience');
};

export const hasForbidBuy = (G: SettlementState): boolean =>
  _hasModifierActive(G, 'forbidBuy');

export const consumeForbidBuy = (G: SettlementState): void => {
  _consumeModifier(G, 'forbidBuy');
};

export const hasForceCheapestScience = (G: SettlementState): boolean =>
  _hasModifierActive(G, 'forceCheapestScience');

export const consumeForceCheapestScience = (G: SettlementState): void => {
  _consumeModifier(G, 'forceCheapestScience');
};
