// Step-decomposition tests for the paced playback HUD.

import { describe, expect, it } from 'vitest';
import { decomposeTrace } from '../../../src/ui/track/resolveSteps.ts';
import type { ResolveTrace } from '../../../src/game/track.ts';

const baseTrace = (overrides: Partial<ResolveTrace>): ResolveTrace => ({
  pathTiles: [
    { x: 0, y: 2 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ],
  firingUnitIDs: [],
  impactTiles: [],
  outcome: 'killed',
  ...overrides,
});

describe('decomposeTrace', () => {
  it('returns no steps for a `noop` trace', () => {
    const steps = decomposeTrace(baseTrace({ outcome: 'noop' }));
    expect(steps).toHaveLength(0);
  });

  it('returns no steps for an empty path', () => {
    const steps = decomposeTrace(baseTrace({ pathTiles: [] }));
    expect(steps).toHaveLength(0);
  });

  it('emits a single enter step when no firing / impact / burn', () => {
    const steps = decomposeTrace(baseTrace({}));
    expect(steps).toHaveLength(1);
    expect(steps[0]?.kind).toBe('enter');
    expect(steps[0]?.firingUnitIDs.size).toBe(0);
    expect(steps[0]?.impactKeys.size).toBe(0);
    // pathKeys mirror pathTiles.
    expect(steps[0]?.pathKeys.has('0,1')).toBe(true);
    expect(steps[0]?.pathKeys.has('0,0')).toBe(true);
  });

  it('emits cumulative fire steps in firingUnitIDs order', () => {
    const steps = decomposeTrace(
      baseTrace({ firingUnitIDs: ['u1', 'u2'] }),
    );
    // enter + 2 fires
    expect(steps).toHaveLength(3);
    expect(steps[1]?.kind).toBe('fire');
    expect(steps[1]?.firingUnitIDs.has('u1')).toBe(true);
    expect(steps[1]?.firingUnitIDs.has('u2')).toBe(false);
    // Second fire step accumulates.
    expect(steps[2]?.firingUnitIDs.has('u1')).toBe(true);
    expect(steps[2]?.firingUnitIDs.has('u2')).toBe(true);
  });

  it('emits cumulative impact steps in impactTiles order', () => {
    const steps = decomposeTrace(
      baseTrace({ impactTiles: ['0,2', '0,1'], outcome: 'overflowed' }),
    );
    // enter + 2 impacts
    expect(steps).toHaveLength(3);
    expect(steps[1]?.kind).toBe('impact');
    expect(steps[1]?.impactKeys.has('0,2')).toBe(true);
    expect(steps[1]?.impactKeys.has('0,1')).toBe(false);
    expect(steps[2]?.impactKeys.has('0,2')).toBe(true);
    expect(steps[2]?.impactKeys.has('0,1')).toBe(true);
  });

  it('emits a centerBurn step when the trace burned tokens', () => {
    const steps = decomposeTrace(
      baseTrace({
        impactTiles: ['0,2'],
        outcome: 'reachedCenter',
        centerBurned: 3,
        centerBurnDetail: { wood: 2, stone: 1 },
      }),
    );
    // enter + 1 impact + centerBurn
    expect(steps).toHaveLength(3);
    const last = steps[steps.length - 1]!;
    expect(last.kind).toBe('centerBurn');
    expect(last.centerBurned).toBe(3);
    expect(last.centerBurnDetail).toEqual({ wood: 2, stone: 1 });
  });

  it('omits centerBurn when burned is 0 or undefined', () => {
    const a = decomposeTrace(baseTrace({ centerBurned: 0 }));
    const b = decomposeTrace(baseTrace({}));
    expect(a.find((s) => s.kind === 'centerBurn')).toBeUndefined();
    expect(b.find((s) => s.kind === 'centerBurn')).toBeUndefined();
  });
});
