import { describe, expect, it } from 'vitest';
import { setupScience } from '../../../src/game/roles/science/setup.ts';

describe('setupScience', () => {
  it('returns a ScienceState with an empty hand', () => {
    const science = setupScience();
    expect(science.hand).toEqual([]);
  });
});
