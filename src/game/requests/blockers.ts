// computeShortfall — pure helper that returns the resource deficit
// between a cost bag and the funds the requester has on hand. Returns an
// empty object when the requester can already afford the cost. Centralized
// here so both `requestHelp`'s validator and the UI's helper-button
// visibility check use identical math.
//
// The V1 calibration is intentionally narrow: every blocker today maps to
// "missing resources" → the chief is the recipient. Tech / building /
// unit prerequisites (e.g. a Defense unit that requires a Domestic
// building) are a follow-up calibration pass — the request types support
// them, but the detection here doesn't emit them yet.

import type { Resource, ResourceBag } from '../resources/types.ts';
import { RESOURCES } from '../resources/types.ts';

export const computeShortfall = (
  have: ResourceBag,
  cost: Partial<ResourceBag>,
): Partial<ResourceBag> => {
  const out: Partial<ResourceBag> = {};
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const need = cost[r] ?? 0;
    const got = have[r] ?? 0;
    if (need > got) out[r] = need - got;
  }
  return out;
};

export const isEmptyBag = (bag: Partial<ResourceBag>): boolean => {
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    if ((bag[r] ?? 0) > 0) return false;
  }
  return true;
};
