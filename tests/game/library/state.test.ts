// SL 2.1 — LibraryState shape test.

import { describe, expect, it } from 'vitest';
import {
  emptyLibraryState,
  type LibraryState,
} from '../../../src/game/library/state.ts';
import type { SettlementState } from '../../../src/game/types.ts';

describe('SL 2.1 — LibraryState', () => {
  it('emptyLibraryState produces a length-6 row of nulls and empty deck/lostIdeas', () => {
    const lib: LibraryState = emptyLibraryState(['0', '1']);
    expect(lib.row).toHaveLength(6);
    expect(lib.row.every((s) => s === null)).toBe(true);
    expect(lib.deck).toEqual([]);
    expect(lib.lostIdeas).toEqual([]);
  });

  it('discountTableaus has one empty array per seat', () => {
    const lib = emptyLibraryState(['0', '1', '2', '3']);
    expect(Object.keys(lib.discountTableaus).sort()).toEqual([
      '0',
      '1',
      '2',
      '3',
    ]);
    expect(lib.discountTableaus['0']).toEqual([]);
    expect(lib.discountTableaus['3']).toEqual([]);
  });

  it('compiles when assigned to SettlementState.library', () => {
    // Pure type-level smoke: TypeScript must accept LibraryState as the
    // value at SettlementState.library.
    const lib = emptyLibraryState(['0']);
    const partial: Pick<SettlementState, 'library'> = { library: lib };
    expect(partial.library).toBe(lib);
  });
});
