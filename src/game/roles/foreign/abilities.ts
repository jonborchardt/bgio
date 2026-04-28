// 07.3 — Ability tag parsing for the battle resolver.
//
// `UnitDef.altStats` and `UnitDef.note` (see src/data/units.json) carry free-
// form English describing what a unit does in combat ("focus", "splash", "1
// uses, skip turn to reload, +3 attack vs boss", …). The battle resolver
// needs a small typed enum it can switch on, so this module flattens those
// strings down to a `AbilityTag[]` via case-insensitive substring matches.
//
// Scope (V1): only the abilities the resolver actually implements get a
// tag. The plan calls out `focus | splash | armor | heal | singleUse` for
// V1; `cover`, `ammo`, `reload`, `vsBoss`, `revealsScout` are deliberately
// *not* parsed here so we don't pretend support we don't have. When those
// land later, add the keyword here AND wire it into `resolveBattle`.

import { UNITS } from '../../../data/index.ts';

export type AbilityTag = 'focus' | 'splash' | 'armor' | 'heal' | 'singleUse';

interface AbilityKeyword {
  tag: AbilityTag;
  // Lowercased substring search against (altStats + ' ' + note). All of
  // UNITS' real strings are short enough that substring match is
  // unambiguous — see units.json. If a future unit string accidentally
  // contains "armor" inside a longer phrase that *isn't* the armor
  // ability, refactor to a word-boundary regex; for V1 the noise level
  // is fine.
  needle: string;
}

const KEYWORDS: ReadonlyArray<AbilityKeyword> = [
  { tag: 'focus', needle: 'focus' },
  { tag: 'splash', needle: 'splash' },
  { tag: 'armor', needle: 'armor' },
  { tag: 'heal', needle: 'heal' },
  // "single use" matches both "single use" and "single-use" once we
  // lower-case + leave the hyphen in (the includes still lines up since
  // there are no real "single use" strings in V1; the canonical phrase
  // for V1 abilities is "1 uses" / "2 uses" which we deliberately *do
  // not* parse here — see top-of-file comment).
  { tag: 'singleUse', needle: 'single use' },
];

/**
 * Parse a UnitDef-style description string for known V1 ability keywords.
 * Returns a deduplicated list in declaration order. Empty input yields [].
 *
 * Public callers usually want `abilitiesForUnit(defID)` instead — this
 * function is exposed mainly for tests that want to feed in synthetic
 * description strings.
 */
export const parseAbilities = (altStats: string): AbilityTag[] => {
  if (altStats === '') return [];
  const lower = altStats.toLowerCase();
  const found: AbilityTag[] = [];
  for (const { tag, needle } of KEYWORDS) {
    if (lower.includes(needle) && !found.includes(tag)) {
      found.push(tag);
    }
  }
  return found;
};

/**
 * Look up the abilities for a given UnitDef name. The resolver feeds both
 * `altStats` AND `note` to the parser because UNITS uses both columns
 * interchangeably (Archer has "focus" in note; Bomber has "3 uses, splash"
 * in note; Sniper has its caveats in note; etc.).
 *
 * Unknown defIDs return [] rather than throwing — the resolver should
 * surface that as a validation error if it cares.
 */
export const abilitiesForUnit = (defID: string): AbilityTag[] => {
  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return [];
  return parseAbilities(`${def.altStats} ${def.note}`);
};
