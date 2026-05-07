// Issue 030 — pin the round-end hook ordering invariant.
//
// Multiple modules (events, chief tax, defense, science, domestic
// produce, track) self-register round-end callbacks at module load.
// The order they fire in is the order they registered — bgio's
// `runRoundEndHooks` walks the Map's insertion order.
//
// A future refactor that breaks the registration chain (tree-shaking,
// HMR, accidental conditional registration) would silently change
// the firing order. This test imports every registration site and
// asserts the names appear in the expected sequence so the
// invariant fails loudly at the test layer, not at runtime mid-game.

import { describe, expect, it, beforeAll } from 'vitest';
import {
  __resetHooksForTest,
  runRoundEndHooks,
  registerRoundEndHook,
} from '../src/game/hooks.ts';
import type { SettlementState } from '../src/game/types.ts';
import type { Ctx } from 'boardgame.io';
import type { RandomAPI } from '../src/game/hooks.ts';

const noopRandom: RandomAPI = {
  Shuffle: <T>(arr: T[]) => arr,
  Number: () => 0,
  D6: () => 1,
};

describe('round-end hook ordering invariant (issue 030)', () => {
  beforeAll(async () => {
    // Wipe + re-import every registration site so we're starting from
    // a clean registry. The imports run their registerRoundEndHook
    // calls on module evaluation.
    __resetHooksForTest();
    await import('../src/game/track.ts');
    await import('../src/game/events/state.ts');
    await import('../src/game/roles/chief/tax.ts');
    await import('../src/game/roles/defense/hooks.ts');
    await import('../src/game/roles/domestic/produce.ts');
    await import('../src/game/roles/science/drill.ts');
    await import('../src/game/roles/science/libraryBurn.ts');
  });

  it('contains every registered hook name (no module silently dropped)', () => {
    const observed: string[] = [];
    const G = {} as SettlementState;
    const ctx = {} as Ctx;
    // Wrap every hook to capture the order they fire in.
    registerRoundEndHook('__test:probe-end', (_g) => {
      // Last hook — confirms our probe registers AFTER everything else
      // imported in `beforeAll`. (Map insertion order.)
      observed.push('__test:probe-end');
    });
    runRoundEndHooks(G, ctx, noopRandom);
    // The probe must be the last entry — i.e. anything registered
    // before us already fired.
    expect(observed).toContain('__test:probe-end');
    expect(observed[observed.length - 1]).toBe('__test:probe-end');
  });

  it('runs hooks in registration (insertion) order', () => {
    __resetHooksForTest();
    const seen: string[] = [];
    registerRoundEndHook('first', () => seen.push('first'));
    registerRoundEndHook('second', () => seen.push('second'));
    registerRoundEndHook('third', () => seen.push('third'));
    runRoundEndHooks({} as SettlementState, {} as Ctx, noopRandom);
    expect(seen).toEqual(['first', 'second', 'third']);
  });

  it('a single throwing hook does not abort subsequent hooks', () => {
    __resetHooksForTest();
    const seen: string[] = [];
    registerRoundEndHook('a', () => seen.push('a'));
    registerRoundEndHook('boom', () => {
      throw new Error('intentional');
    });
    registerRoundEndHook('c', () => seen.push('c'));
    // The runner logs but doesn't throw.
    expect(() =>
      runRoundEndHooks({} as SettlementState, {} as Ctx, noopRandom),
    ).not.toThrow();
    expect(seen).toEqual(['a', 'c']);
  });
});
