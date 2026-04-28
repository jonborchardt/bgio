// End-condition tests for 08.5.
//
// `endIf` is a pure 2-arg function over `(G, ctx)`, so most tests drive it
// directly with a hand-rolled `SettlementState` shell. The `setupData.turnCap`
// case calls `setup` directly (rather than booting a client) because bgio's
// 0.50 `Client.start()` doesn't surface a `setupData` knob — `Server` does,
// but spinning a server up here would just add ceremony around the same
// path.

import { describe, expect, it } from 'vitest';
import {
  endIf,
  TURN_CAP_DEFAULT,
} from '../src/game/endConditions.ts';
import type { SettlementState } from '../src/game/types.ts';
import { setup } from '../src/game/setup.ts';
import { EMPTY_BAG } from '../src/game/resources/types.ts';

// Smallest legal SettlementState shell — `endIf` only reads `round`,
// `settlementsJoined`, and `turnCap`, but the full shape is required by the
// type signature. Keeping the rest minimal.
const stubG = (
  partial: Partial<SettlementState> = {},
): SettlementState => ({
  bank: { ...EMPTY_BAG },
  centerMat: { circles: {}, tradeRequest: null },
  roleAssignments: { '0': ['chief'], '1': ['science'] },
  round: 0,
  settlementsJoined: 0,
  hands: {},
  wallets: {},
  ...partial,
});

describe('endIf (08.5)', () => {
  it('returns undefined when below the win bar and below the cap', () => {
    const G = stubG({ round: 50, settlementsJoined: 9 });
    expect(endIf(G, undefined)).toBeUndefined();
  });

  it('returns a win when settlementsJoined >= 10', () => {
    const G = stubG({ round: 50, settlementsJoined: 10 });
    expect(endIf(G, undefined)).toEqual({
      kind: 'win',
      turns: 50,
      settlementsJoined: 10,
    });
  });

  it('returns timeUp at the default 80-round cap', () => {
    const G = stubG({ round: 80, settlementsJoined: 0 });
    expect(endIf(G, undefined)).toEqual({
      kind: 'timeUp',
      turns: 80,
      settlementsJoined: 0,
    });
  });

  it('win takes precedence when both fire on the same round', () => {
    const G = stubG({ round: 80, settlementsJoined: 10 });
    const out = endIf(G, undefined);
    expect(out).toEqual({
      kind: 'win',
      turns: 80,
      settlementsJoined: 10,
    });
  });

  it('setupData.turnCap = 20 shortens the cap; firing at round 20', () => {
    // Drive `setup` directly with a minimal ctx — the headless `Client` path
    // doesn't expose `setupData` in this version of bgio, so we exercise the
    // wiring at the source. The default fallback random (identity shuffle)
    // is used implicitly.
    const ctx = { numPlayers: 2 } as unknown as Parameters<typeof setup>[0]['ctx'];
    const G = setup({ ctx }, { turnCap: 20 });

    expect(G.turnCap).toBe(20);
    expect(TURN_CAP_DEFAULT).toBe(80);

    // Below the shortened cap → no end.
    G.round = 19;
    expect(endIf(G, undefined)).toBeUndefined();

    // At the shortened cap → timeUp.
    G.round = 20;
    expect(endIf(G, undefined)).toEqual({
      kind: 'timeUp',
      turns: 20,
      settlementsJoined: 0,
    });
  });
});
