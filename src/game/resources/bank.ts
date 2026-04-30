// Bank slice & transfer primitives.
//
// `transfer` mutates Immer drafts directly so it's safe to call inside moves.
// `initialBank` builds the starting bank for setup. `totalResources` walks
// every resource holder on G and sums them — used in tests + dev-mode to
// assert resource conservation across moves.

import type { SettlementState } from '../types.ts';
import type { Resource, ResourceBag } from './types.ts';
import { RESOURCES } from './types.ts';
import { bagOf, canAfford, total } from './bag.ts';

// Mutates `from` and `to` directly (Immer-draft friendly). Asserts
// affordability up front and throws RangeError naming the offending
// resource so move callers can convert to INVALID_MOVE.
export const transfer = (
  from: ResourceBag,
  to: ResourceBag,
  amounts: Partial<ResourceBag>,
): void => {
  if (!canAfford(from, amounts)) {
    for (const r of RESOURCES) {
      const need = amounts[r] ?? 0;
      if (from[r] < need) {
        throw new RangeError(
          `transfer underflow on ${r}: have ${from[r]}, need ${need}`,
        );
      }
    }
  }
  for (const r of RESOURCES) {
    const amt = amounts[r] ?? 0;
    if (amt === 0) continue;
    from[r] -= amt;
    to[r] += amt;
  }
};

// Default starter bank per game-design.md §Setup.Chief: 3 gold.
// `override` REPLACES the default — callers that want to merge should do so
// themselves before calling.
export const initialBank = (override?: Partial<ResourceBag>): ResourceBag => {
  if (override === undefined) return bagOf({ gold: 3 });
  return bagOf(override);
};

const isResourceBag = (x: unknown): x is ResourceBag => {
  if (x === null || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  for (const r of RESOURCES) {
    if (typeof obj[r] !== 'number') return false;
  }
  return true;
};

// Sums every resource holder on G defensively. Bank is always present;
// per-seat mats hold three bags each (in / out / stash); per-player hands
// are domain-specific. We walk every bag-shaped slot we know about.
export const totalResources = (G: SettlementState): number => {
  let sum = 0;

  if (isResourceBag(G.bank)) sum += total(G.bank);

  const visit = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (isResourceBag(node)) {
      sum += total(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
      return;
    }
    if (typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>)) visit(v);
    }
  };

  visit(G.centerMat);
  visit(G.hands);
  visit(G.mats);

  return sum;
};

// Re-export Resource so callers can grab it from `./bank` if convenient.
export type { Resource, ResourceBag };
