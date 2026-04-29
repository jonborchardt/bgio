// Pure ResourceBag arithmetic helpers.
// Bags are immutable values; every helper returns a fresh object.

import type { Resource, ResourceBag } from './types.ts';
import { EMPTY_BAG, RESOURCES } from './types.ts';

const fresh = (): ResourceBag => ({ ...EMPTY_BAG });

/**
 * Validate that an externally-supplied amounts bag carries only
 * non-negative finite integer values. Move bodies call this before
 * canAfford / transfer so a network-supplied negative or NaN can't
 * mint resources or corrupt the bank. Returns the offending key, or
 * `null` if the bag is clean.
 *
 * Used by 03.4 pullFromMat, 04.1 chiefDistribute, 05.2 scienceContribute,
 * any move taking a `Partial<ResourceBag>` from the client.
 */
export const findInvalidAmount = (
  amounts: Partial<ResourceBag>,
): Resource | null => {
  for (const r of RESOURCES) {
    const v = amounts[r];
    if (v === undefined) continue;
    if (
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      !Number.isInteger(v) ||
      v < 0
    ) {
      return r;
    }
  }
  return null;
};

export const bagOf = (entries: Partial<ResourceBag>): ResourceBag => {
  const out = fresh();
  for (const r of RESOURCES) {
    const v = entries[r];
    if (v !== undefined) out[r] = v;
  }
  return out;
};

export const add = (a: ResourceBag, b: Partial<ResourceBag>): ResourceBag => {
  const out = fresh();
  for (const r of RESOURCES) {
    out[r] = a[r] + (b[r] ?? 0);
  }
  return out;
};

export const sub = (a: ResourceBag, b: Partial<ResourceBag>): ResourceBag => {
  const out = fresh();
  for (const r of RESOURCES) {
    const next = a[r] - (b[r] ?? 0);
    if (next < 0) {
      throw new RangeError(
        `ResourceBag underflow on ${r}: have ${a[r]}, need ${b[r] ?? 0}`,
      );
    }
    out[r] = next;
  }
  return out;
};

export const canAfford = (
  have: ResourceBag,
  cost: Partial<ResourceBag>,
): boolean => {
  for (const r of RESOURCES) {
    const need = cost[r] ?? 0;
    if (have[r] < need) return false;
  }
  return true;
};

export const total = (b: ResourceBag): number => {
  let sum = 0;
  for (const r of RESOURCES) sum += b[r];
  return sum;
};

export const eq = (a: ResourceBag, b: ResourceBag): boolean => {
  for (const r of RESOURCES) {
    if (a[r] !== b[r]) return false;
  }
  return true;
};

// Re-export the Resource type so call sites can import everything from `./bag`.
export type { Resource, ResourceBag };
