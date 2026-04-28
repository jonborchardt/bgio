// Round-end hook registry tests (02.5).
//
// Drives `runRoundEndHooks` directly with a stub G/ctx/random — none of the
// behavior under test depends on bgio's lifecycle, so booting a full client
// would just add noise.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ctx } from 'boardgame.io';
import {
  __resetHooksForTest,
  registerRoundEndHook,
  runRoundEndHooks,
  type RandomAPI,
  type RoundEndHook,
} from '../src/game/hooks.ts';
import type { SettlementState } from '../src/game/types.ts';
import { EMPTY_BAG } from '../src/game/resources/types.ts';

const makeStubG = (): SettlementState => ({
  bank: { ...EMPTY_BAG },
  centerMat: {},
  roleAssignments: { '0': ['chief'], '1': ['science'] },
  round: 0,
  hands: { '0': {}, '1': {} },
});

// Minimal Ctx stub. The hooks under test never read these fields; they
// exist only to satisfy the type signature.
const makeStubCtx = (): Ctx =>
  ({
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'endOfRound',
    activePlayers: null,
  }) as unknown as Ctx;

const makeStubRandom = (): RandomAPI => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
  D6: () => 1,
});

describe('round-end hook registry (02.5)', () => {
  beforeEach(() => {
    __resetHooksForTest();
  });

  it('registering two hooks runs both, in registration order', () => {
    const calls: string[] = [];
    registerRoundEndHook('first', () => {
      calls.push('first');
    });
    registerRoundEndHook('second', () => {
      calls.push('second');
    });

    runRoundEndHooks(makeStubG(), makeStubCtx(), makeStubRandom());

    expect(calls).toEqual(['first', 'second']);
  });

  it('hooks receive G, ctx, and random and may mutate G', () => {
    const seenArgs: { gRound: number; ctxPhase: string; d6: number }[] = [];
    registerRoundEndHook('mutator', (G, ctx, random) => {
      seenArgs.push({
        gRound: G.round,
        ctxPhase: ctx.phase,
        d6: random.D6(),
      });
      G.round += 1;
    });

    const G = makeStubG();
    runRoundEndHooks(G, makeStubCtx(), makeStubRandom());

    expect(G.round).toBe(1);
    expect(seenArgs).toEqual([
      { gRound: 0, ctxPhase: 'endOfRound', d6: 1 },
    ]);
  });

  it('registering a duplicate name with a different function throws', () => {
    registerRoundEndHook('dup', () => {});
    expect(() =>
      registerRoundEndHook('dup', () => {
        // Different function reference — must throw.
      }),
    ).toThrow(/dup/);
  });

  it('registering the same name with the same function reference is a no-op', () => {
    const calls: string[] = [];
    const hook: RoundEndHook = () => {
      calls.push('hook');
    };

    registerRoundEndHook('idempotent', hook);
    // Re-registering with the SAME ref must not throw and must not double-run.
    expect(() => registerRoundEndHook('idempotent', hook)).not.toThrow();

    runRoundEndHooks(makeStubG(), makeStubCtx(), makeStubRandom());
    expect(calls).toEqual(['hook']);
  });

  it('a throwing hook surfaces the error and does not block subsequent hooks', () => {
    const calls: string[] = [];
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    registerRoundEndHook('before', () => {
      calls.push('before');
    });
    registerRoundEndHook('boom', () => {
      throw new Error('kaboom');
    });
    registerRoundEndHook('after', () => {
      calls.push('after');
    });

    // runRoundEndHooks itself must NOT throw — the try/catch absorbs it.
    expect(() =>
      runRoundEndHooks(makeStubG(), makeStubCtx(), makeStubRandom()),
    ).not.toThrow();

    // Subsequent hooks still ran.
    expect(calls).toEqual(['before', 'after']);

    // The error was surfaced via console.error with the { hook, error } shape.
    expect(errSpy).toHaveBeenCalledTimes(1);
    const arg = errSpy.mock.calls[0]![0] as { hook: string; error: unknown };
    expect(arg.hook).toBe('boom');
    expect(arg.error).toBeInstanceOf(Error);
    expect((arg.error as Error).message).toBe('kaboom');

    errSpy.mockRestore();
  });
});
