import { describe, expect, it, vi } from 'vitest';
import { makeClient } from './helpers/makeClient.ts';
import { runMoves } from './helpers/runMoves.ts';
import { seedAfterChiefDistribution } from './helpers/seed.ts';

describe('game smoke', () => {
  it('boots a 2-player headless client with role assignments', () => {
    const client = makeClient();
    const state = client.getState()!;
    expect(state.G.roleAssignments).toEqual({
      '0': ['chief', 'science'],
      '1': ['domestic', 'foreign'],
    });
  });

  it('pass resolves cleanly under the phase skeleton', () => {
    // Pre-02.1 this test asserted that `pass` rotated currentPlayer to '1'.
    // That was the transitional `turn: { minMoves: 1, maxMoves: 1 }` cycling
    // behavior; 02.1's phase skeleton pins active players to specific seats
    // (chiefPhase -> chief seat only) so a cycle from 0 -> 1 is no longer
    // legal. We just check that `pass` resolves without error and leaves the
    // game in chiefPhase with the chief still active.
    const client = makeClient();
    expect(client.getState()!.ctx.currentPlayer).toBe('0');
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
    runMoves(client, [{ player: '0', move: 'pass' }]);
    const after = client.getState()!;
    expect(after.ctx.phase).toBe('chiefPhase');
    // Chief seat (player '0' in a 2-player game) remains the lone active seat.
    expect(Object.keys(after.ctx.activePlayers ?? {})).toEqual(['0']);
  });
});

describe('test helpers', () => {
  it('makeClient() returns a client whose G matches Settlement setup for numPlayers=2', () => {
    const client = makeClient();
    const G = client.getState()!.G;
    expect(G.roleAssignments).toEqual({
      '0': ['chief', 'science'],
      '1': ['domestic', 'foreign'],
    });
    expect(G.bank.gold).toBe(3);
    expect(G.round).toBe(0);
    expect(Object.keys(G.hands).sort()).toEqual(['0', '1']);
    // 03.3: centerMat now has a circle per non-chief seat (2-player game →
    // seat '1' is the only non-chief seat) and an empty trade-request slot.
    expect(Object.keys(G.centerMat.circles)).toEqual(['1']);
    expect(G.centerMat.tradeRequest).toBeNull();
  });

  it('runMoves with an unknown move leaves state unchanged', () => {
    const client = makeClient();
    const before = client.getState()!;
    // Suppress the expected "unknown move" error so the test output stays clean.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      runMoves(client, [{ player: '0', move: 'doesNotExist' }]);
    } finally {
      errSpy.mockRestore();
    }
    const after = client.getState()!;
    expect(after.G).toEqual(before.G);
    expect(after.ctx.currentPlayer).toBe(before.ctx.currentPlayer);
    expect(after.ctx.turn).toBe(before.ctx.turn);
  });

  it('seedAfterChiefDistribution() returns deeply-equal states across two calls', () => {
    const a = seedAfterChiefDistribution();
    const b = seedAfterChiefDistribution();
    expect(a).toEqual(b);
    // Different object identity — pure factory, not a shared singleton.
    expect(a).not.toBe(b);
  });
});
