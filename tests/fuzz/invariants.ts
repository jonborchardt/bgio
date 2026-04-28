// Invariant assertions for the fuzz harness (11.1).
//
// These helpers walk a `SettlementState` (or a sequence of snapshots) and
// throw on any structural violation. Keeping them separate from the
// individual fuzz tests means a future bot smoke-suite (11.2+) can reuse the
// same checks without depending on the RandomBot loop.

import type { Ctx } from 'boardgame.io';
import type { SettlementState } from '../../src/game/types.ts';
import { RESOURCES } from '../../src/game/resources/types.ts';
import type { Resource, ResourceBag } from '../../src/game/resources/types.ts';

/**
 * Asserts that no resource count anywhere in `G` is negative. Walks:
 *   - `G.bank`
 *   - `G.wallets[seat]` for every seat
 *   - `G.centerMat.circles[seat]` for every seat
 *   - `G.science.paid[cardId]` for every science card
 *
 * Throws an `Error` with a human-readable path on the first violation so a
 * fuzz failure points directly at the offending bag. Other potential
 * negative-count surfaces (foreign unit `count`, chief `workers`) aren't
 * resource bags — they have their own per-move guards and aren't bundled
 * here.
 */
export const assertNoNegativeResources = (G: SettlementState): void => {
  const checkBag = (bag: ResourceBag, path: string): void => {
    for (const r of RESOURCES as ReadonlyArray<Resource>) {
      const v = bag[r];
      if (typeof v !== 'number' || v < 0) {
        throw new Error(
          `assertNoNegativeResources: ${path}.${r} is ${String(v)} (must be >= 0)`,
        );
      }
    }
  };

  checkBag(G.bank, 'bank');

  for (const [seat, wallet] of Object.entries(G.wallets)) {
    checkBag(wallet, `wallets['${seat}']`);
  }

  for (const [seat, circle] of Object.entries(G.centerMat.circles)) {
    checkBag(circle, `centerMat.circles['${seat}']`);
  }

  if (G.science !== undefined) {
    for (const [cardId, paid] of Object.entries(G.science.paid)) {
      checkBag(paid, `science.paid['${cardId}']`);
    }
  }
};

/**
 * Sums every resource across `bank`, `wallets`, `circles`, and the
 * science `paid` ledger into a single scalar. Used as the basis of the
 * loose conservation check. The total isn't expected to be strictly
 * conserved — production, refunds, event effects, and bank top-ups all
 * legitimately mint or burn resources — but a *huge* per-move spike is
 * a smell.
 */
const totalResources = (G: SettlementState): number => {
  let total = 0;
  const sumBag = (bag: ResourceBag): void => {
    for (const r of RESOURCES as ReadonlyArray<Resource>) {
      total += bag[r] ?? 0;
    }
  };
  sumBag(G.bank);
  for (const wallet of Object.values(G.wallets)) sumBag(wallet);
  for (const circle of Object.values(G.centerMat.circles)) sumBag(circle);
  if (G.science !== undefined) {
    for (const paid of Object.values(G.science.paid)) sumBag(paid);
  }
  return total;
};

/**
 * V1 conservation stub. Real conservation requires tracking transfer
 * endpoints (bank ↔ wallet ↔ circle ↔ paid) so we know the legitimate
 * source of every delta. That's out of scope for the first fuzz pass.
 *
 * For now we apply a *defensive* loose check: the sum of all tracked
 * resource bags shouldn't grow by more than `MAX_DELTA_PER_MOVE` between
 * consecutive snapshots. The threshold is generous enough to absorb
 * legitimate produce / event effects but tight enough to catch obvious
 * mint bugs (e.g. a free 1000-gold transfer).
 *
 * If you have only one snapshot, this is a no-op. Tests that want to
 * skip even the loose check can pass `[]`.
 */
export const assertConservation = (
  Gs: ReadonlyArray<SettlementState>,
): void => {
  const MAX_DELTA_PER_MOVE = 50;
  for (let i = 1; i < Gs.length; i++) {
    const prev = totalResources(Gs[i - 1]!);
    const next = totalResources(Gs[i]!);
    const delta = Math.abs(next - prev);
    if (delta > MAX_DELTA_PER_MOVE) {
      throw new Error(
        `assertConservation: total resources jumped by ${delta} between ` +
          `snapshots ${i - 1} and ${i} (prev=${prev}, next=${next}, ` +
          `max allowed=${MAX_DELTA_PER_MOVE})`,
      );
    }
  }
};

/**
 * Asserts that the engine hasn't run past `max` turns. Used as a safety
 * cap on the fuzz loop — the game's natural `endIf` (TURN_CAP, default
 * 80) terminates real play, but if a move ever fails to advance the
 * turn we want the fuzzer to bail loudly rather than spin forever.
 */
export const assertTurnsBounded = (
  state: { ctx: Ctx },
  max: number,
): void => {
  const turn = state.ctx.turn;
  if (typeof turn !== 'number' || turn > max) {
    throw new Error(
      `assertTurnsBounded: ctx.turn = ${String(turn)} exceeds max = ${max}`,
    );
  }
};
