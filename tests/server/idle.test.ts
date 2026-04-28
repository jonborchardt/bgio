// @vitest-environment node
//
// 10.9 — idle-watcher smoke tests.
//
// We test the bookkeeping shape (lastActivity table updates, sweep
// fires `grantBotControl` after IDLE_TIMEOUT_MS, doesn't re-fire). The
// real bot-takeover behaviour lives behind `it.todo`s because the
// `seatTakeover` module is a stub in V1 (see its file header) and the
// game-state read needed to answer "is it actually that seat's turn?"
// requires either a live bgio Server or a storage adapter handle that
// 11.x will land.

import { describe, expect, it, vi } from 'vitest';
import {
  IDLE_TIMEOUT_MS,
  makeIdleWatcher,
} from '../../server/idle/idleWatcher.ts';
import * as seatTakeover from '../../server/idle/seatTakeover.ts';

describe('idleWatcher (10.9) — smoke', () => {
  it('exports the documented IDLE_TIMEOUT_MS constant', () => {
    expect(IDLE_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it('returns an IdleWatcher with the documented surface', () => {
    const w = makeIdleWatcher(undefined);
    expect(typeof w.start).toBe('function');
    expect(typeof w.stop).toBe('function');
    expect(typeof w.noteActivity).toBe('function');
    expect(typeof w.__sweepNow).toBe('function');
  });

  it('noteActivity records the (matchID, playerID) pair', () => {
    const w = makeIdleWatcher(undefined);
    w.noteActivity('m1', '0');
    w.noteActivity('m1', '1');
    w.noteActivity('m2', '0');
    const table = w.__getLastActivity();
    expect(table.get('m1')?.size).toBe(2);
    expect(table.get('m2')?.size).toBe(1);
  });

  it('start() / stop() are idempotent', () => {
    const w = makeIdleWatcher(undefined);
    w.start();
    w.start(); // double-start is a no-op
    w.stop();
    w.stop(); // double-stop is a no-op
  });
});

describe('idleWatcher (10.9) — sweep', () => {
  it('does not call grantBotControl while the seat is fresh', async () => {
    const spy = vi
      .spyOn(seatTakeover, 'grantBotControl')
      .mockResolvedValue(undefined);
    const w = makeIdleWatcher(undefined);
    w.noteActivity('m1', '0');
    await w.__sweepNow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('calls grantBotControl when activity is older than IDLE_TIMEOUT_MS', async () => {
    const spy = vi
      .spyOn(seatTakeover, 'grantBotControl')
      .mockResolvedValue(undefined);
    const w = makeIdleWatcher(undefined);
    w.noteActivity('m1', '0');
    // Backdate by directly mutating the activity table — simpler than
    // shimming Date.now() and gives us a deterministic test.
    const table = w.__getLastActivity();
    table.get('m1')?.set('0', Date.now() - IDLE_TIMEOUT_MS - 1);
    await w.__sweepNow();
    expect(spy).toHaveBeenCalledWith('m1', '0');
    spy.mockRestore();
  });

  it('does not double-fire grantBotControl after the first takeover', async () => {
    const spy = vi
      .spyOn(seatTakeover, 'grantBotControl')
      .mockResolvedValue(undefined);
    const w = makeIdleWatcher(undefined);
    w.noteActivity('m1', '0');
    const table = w.__getLastActivity();
    table.get('m1')?.set('0', Date.now() - IDLE_TIMEOUT_MS - 1);
    await w.__sweepNow();
    await w.__sweepNow();
    await w.__sweepNow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('clearing the granted flag (via noteActivity) lets a future idle re-fire', async () => {
    const spy = vi
      .spyOn(seatTakeover, 'grantBotControl')
      .mockResolvedValue(undefined);
    const w = makeIdleWatcher(undefined);
    w.noteActivity('m1', '0');
    const table = w.__getLastActivity();
    table.get('m1')?.set('0', Date.now() - IDLE_TIMEOUT_MS - 1);
    await w.__sweepNow();
    expect(spy).toHaveBeenCalledTimes(1);
    // Human reconnects (noteActivity); then idles again.
    w.noteActivity('m1', '0');
    table.get('m1')?.set('0', Date.now() - IDLE_TIMEOUT_MS - 1);
    await w.__sweepNow();
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('a thrown grantBotControl does not crash the watcher', async () => {
    const spy = vi
      .spyOn(seatTakeover, 'grantBotControl')
      .mockRejectedValue(new Error('boom'));
    const w = makeIdleWatcher(undefined);
    w.noteActivity('m1', '0');
    const table = w.__getLastActivity();
    table.get('m1')?.set('0', Date.now() - IDLE_TIMEOUT_MS - 1);
    await expect(w.__sweepNow()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe('idleWatcher — integration with createServer (10.9)', () => {
  it.todo(
    'createServer wires idleWatcher.start() and exposes it on the handle',
  );
  it.todo(
    'a 2p match: human in seat 1 stops acting; bot takes over after the timeout',
  );
  it.todo('reconnect: bot stops, human resumes from current state');
  it.todo(
    "active connection on a stage other than its own does NOT trigger takeover",
  );
});
