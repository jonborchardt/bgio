// Range-highlight key computation. UNITS data drives the range stat;
// the helper looks up the unit by id, finds its def, and emits the
// Chebyshev coverage as cellKey strings.

import { describe, expect, it } from 'vitest';
import { computeRangeKeys } from '../../../src/ui/track/RangeHighlightContext.ts';
import { UNITS } from '../../../src/data/index.ts';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';

const makeUnit = (
  id: string,
  defID: string,
  cellKey: string,
): UnitInstance => ({
  id,
  defID,
  cellKey,
  hp: 1,
  placementOrder: 1,
});

describe('computeRangeKeys', () => {
  it('returns an empty set when no unit is hovered', () => {
    expect(computeRangeKeys(null, [])).toEqual(new Set());
  });

  it('returns an empty set when the unit id is not present', () => {
    const u = makeUnit('u1', UNITS[0]!.name, '0,0');
    expect(computeRangeKeys('missing', [u])).toEqual(new Set());
  });

  it('returns an empty set when the def cannot be located', () => {
    const u = makeUnit('u1', '__not-a-real-def__', '1,1');
    expect(computeRangeKeys('u1', [u])).toEqual(new Set());
  });

  it('covers a (2*range+1)^2 square in Chebyshev distance', () => {
    // Pick a real unit def to avoid coupling to test-only fixtures.
    const def = UNITS[0]!;
    const u = makeUnit('u1', def.name, '0,0');
    const keys = computeRangeKeys('u1', [u]);
    const expected = (def.range * 2 + 1) ** 2;
    expect(keys.size).toBe(expected);
    // The unit's own tile is always in range.
    expect(keys.has('0,0')).toBe(true);
    // Corners of the square are also in range (Chebyshev counts
    // diagonals as distance 1).
    if (def.range >= 1) {
      expect(keys.has(`${def.range},${def.range}`)).toBe(true);
      expect(keys.has(`${-def.range},${-def.range}`)).toBe(true);
    }
    // Just outside the square is NOT in range.
    expect(keys.has(`${def.range + 1},0`)).toBe(false);
  });
});
