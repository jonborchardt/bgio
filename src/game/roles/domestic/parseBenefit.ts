// 06.3 — Benefit-string parser.
//
// Translates the human-readable `benefit` strings from buildings.json into a
// typed `BenefitYield`: a partial `ResourceBag` for the pure-resource verbs
// (food/production/science/gold) plus a list of structured `BenefitEffect`s
// for the rest (combat modifiers, happiness, upkeep / unit-cost tweaks).
//
// Failure mode is loud: any token we can't match throws, so when content
// adds a new verb we notice immediately rather than silently dropping it.

import type { ResourceBag } from '../../resources/types.ts';

export interface BenefitYield {
  resources: Partial<ResourceBag>;
  // Effects that aren't pure yields (modify combat, reduce upkeep, ...).
  effects: BenefitEffect[];
}

export type BenefitEffect =
  | { kind: 'attack'; amount: number }
  | { kind: 'defense'; amount: number }
  | { kind: 'happiness'; amount: number }
  | { kind: 'unitMaintenance'; amount: number } // negative = reduces upkeep
  | { kind: 'unitCost'; amount: number };       // negative = cheaper units

// Verbs that go straight into the resource bag. Kept separate from the
// effect verbs so the lookup is explicit — content drift on either side
// fails the unknown-token branch instead of silently routing to the wrong
// bucket.
const RESOURCE_VERBS = new Set(['food', 'production', 'science', 'gold']);

const splitTokens = (input: string): string[] =>
  // Lowercase first so "and"/"AND"/" And " all delimit. Splitting on a
  // regex that accepts either "," or " and " collapses the two delimiter
  // styles into one pass.
  input
    .toLowerCase()
    .split(/\s+and\s+|,/)
    .map((s) => s.trim())
    // A trailing period on the whole string (or a stray empty segment from
    // double-delimiters) shouldn't produce empty tokens.
    .map((s) => s.replace(/\.+$/, '').trim())
    .filter((s) => s.length > 0);

const parseToken = (token: string): { resource?: keyof ResourceBag; resourceAmount?: number; effect?: BenefitEffect } => {
  // "2 food", "4 gold", "2 food " etc. — bare "<n> <noun>" form.
  const numberFirst = token.match(/^(\d+)\s+([a-z][a-z ]*)$/);
  if (numberFirst) {
    const n = Number(numberFirst[1]);
    const noun = numberFirst[2].trim();
    if (RESOURCE_VERBS.has(noun)) {
      return { resource: noun as keyof ResourceBag, resourceAmount: n };
    }
    if (noun === 'happiness') {
      return { effect: { kind: 'happiness', amount: n } };
    }
  }

  // "+N happiness", "+N attack", "+N defense" / "+N defence".
  const plusFirst = token.match(/^\+(\d+)\s+([a-z]+)$/);
  if (plusFirst) {
    const n = Number(plusFirst[1]);
    const noun = plusFirst[2];
    if (noun === 'happiness') return { effect: { kind: 'happiness', amount: n } };
    if (noun === 'attack') return { effect: { kind: 'attack', amount: n } };
    if (noun === 'defense' || noun === 'defence') {
      return { effect: { kind: 'defense', amount: n } };
    }
  }

  // "attack +N", "defense +N" / "defence +N", "happiness +N".
  const nounPlus = token.match(/^([a-z]+)\s+\+(\d+)$/);
  if (nounPlus) {
    const noun = nounPlus[1];
    const n = Number(nounPlus[2]);
    if (noun === 'attack') return { effect: { kind: 'attack', amount: n } };
    if (noun === 'defense' || noun === 'defence') {
      return { effect: { kind: 'defense', amount: n } };
    }
    if (noun === 'happiness') return { effect: { kind: 'happiness', amount: n } };
  }

  // "decrease unit maintenance by N" / "increase unit maintenance by N".
  const upkeep = token.match(/^(decrease|increase)\s+unit\s+maintenance\s+by\s+(\d+)$/);
  if (upkeep) {
    const n = Number(upkeep[2]);
    const sign = upkeep[1] === 'decrease' ? -1 : 1;
    return { effect: { kind: 'unitMaintenance', amount: sign * n } };
  }

  // "units cost N less" / "units cost N more".
  const unitCost = token.match(/^units\s+cost\s+(\d+)\s+(less|more)$/);
  if (unitCost) {
    const n = Number(unitCost[1]);
    const sign = unitCost[2] === 'less' ? -1 : 1;
    return { effect: { kind: 'unitCost', amount: sign * n } };
  }

  return {};
};

export const parseBenefit = (benefit: string): BenefitYield => {
  const trimmed = benefit.trim();
  if (trimmed === '') return { resources: {}, effects: [] };

  const resources: Partial<ResourceBag> = {};
  const effects: BenefitEffect[] = [];

  for (const token of splitTokens(trimmed)) {
    const parsed = parseToken(token);
    if (parsed.resource !== undefined && parsed.resourceAmount !== undefined) {
      // Sum into the bag in case a single benefit string lists the same
      // resource twice (defensive — shouldn't happen with current content).
      const existing = resources[parsed.resource] ?? 0;
      resources[parsed.resource] = existing + parsed.resourceAmount;
      continue;
    }
    if (parsed.effect !== undefined) {
      effects.push(parsed.effect);
      continue;
    }
    throw new Error(`Unknown benefit token: "${token}"`);
  }

  return { resources, effects };
};
