// Round-end hook registry.
//
// Lets independent role/feature modules hook into `endOfRound.onBegin` without
// importing each other. Each module calls `registerRoundEndHook(name, fn)` at
// module-evaluation time; `endOfRound.onBegin` then calls `runRoundEndHooks`
// which iterates the registry in registration order.
//
// Type choices:
// - `Ctx` is taken from `'boardgame.io'` (the same import the rest of the game
//   uses; see src/game/setup.ts).
// - `RandomAPI` mirrors the bgio random plugin shape (`Shuffle`, `Number`,
//   `D6`) at the minimum surface we expect hooks to use. Typing it explicitly
//   avoids dragging in bgio's internal plugin types and keeps the hook
//   signature self-documenting at the call site.

import type { Ctx } from 'boardgame.io';
import type { SettlementState } from './types.ts';

// Mirrors the subset of bgio's random plugin we actually expect hooks to
// touch. Kept structurally compatible with bgio 0.50.x's `RandomAPI` so
// `endOfRound.onBegin`'s `random` argument flows in without a cast.
export interface RandomAPI {
  Shuffle: <T>(arr: T[]) => T[];
  Number: () => number;
  D6: () => number;
}

// Hooks mutate G in place — bgio wraps the surrounding `onBegin` in Immer,
// which propagates into here, so direct mutation is the idiomatic style.
export type RoundEndHook = (
  G: SettlementState,
  ctx: Ctx,
  random: RandomAPI,
) => void;

// Module-internal registry. Insertion-ordered (a Map's contract) so
// `runRoundEndHooks` runs hooks deterministically in the order they were
// registered.
const hooks = new Map<string, RoundEndHook>();

/**
 * Register a hook to be run at `endOfRound.onBegin`.
 *
 * Idempotency rules:
 * - Re-registering the SAME `name` with the SAME function reference is a
 *   no-op. This makes module top-level registration safe under HMR or
 *   accidental double-imports.
 * - Re-registering the SAME `name` with a DIFFERENT function reference
 *   throws. Cross-module name collisions are bugs and we want them loud.
 *
 * Tests that need to swap a hook should call `__resetHooksForTest` first.
 */
export const registerRoundEndHook = (
  name: string,
  hook: RoundEndHook,
): void => {
  const existing = hooks.get(name);
  if (existing !== undefined) {
    if (existing === hook) {
      // Same name + same function ref: idempotent no-op.
      return;
    }
    throw new Error(
      `registerRoundEndHook: a different hook is already registered under name "${name}"`,
    );
  }
  hooks.set(name, hook);
};

/**
 * Run every registered hook in registration order. Each hook is wrapped in
 * a try/catch so a single buggy hook surfaces (`console.error`) rather than
 * aborting the round-end sweep — subsequent hooks still run.
 */
export const runRoundEndHooks = (
  G: SettlementState,
  ctx: Ctx,
  random: RandomAPI,
): void => {
  for (const [name, hook] of hooks) {
    try {
      hook(G, ctx, random);
    } catch (error) {
      console.error({ hook: name, error });
    }
  }
};

/**
 * Test-only helper: clear the registry so tests can start from a clean slate.
 * Not exported from the package barrel.
 */
export const __resetHooksForTest = (): void => {
  hooks.clear();
};
