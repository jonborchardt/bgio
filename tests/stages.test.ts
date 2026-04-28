// Stage / activePlayers tests for 02.2.
//
// Two halves:
//   1. Integration tests through the headless client: assert that the
//      bgio-built `ctx.activePlayers` map matches `activePlayersForOthers`
//      after the chief signals their phase done.
//   2. Pure-function tests for `enterEventStage` / `exitEventStage` —
//      driven against a small SettlementState stub plus a fake `events`
//      object so the helpers' stack/throw behavior is covered without
//      depending on any of bgio's lifecycle gating.

import { describe, expect, it } from 'vitest';
import { makeClient } from './helpers/makeClient.ts';
import { runMoves } from './helpers/runMoves.ts';
import { seatOfRole } from '../src/game/roles.ts';
import {
  STAGES,
  activePlayersForOthers,
  enterEventStage,
  exitEventStage,
  type StageEvents,
} from '../src/game/phases/stages.ts';
import type { SettlementState } from '../src/game/types.ts';
import { EMPTY_BAG } from '../src/game/resources/types.ts';

describe('activePlayersForOthers (02.2)', () => {
  it('4-player: each seat lands in the stage matching its single role', () => {
    const client = makeClient({ numPlayers: 4 });
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');

    // Drive out of chiefPhase so othersPhase's turn.onBegin runs.
    runMoves(client, [{ player: chiefSeat, move: '__testSetPhaseDone' }]);

    const ctx = client.getState()!.ctx;
    expect(ctx.phase).toBe('othersPhase');
    expect(ctx.activePlayers).toEqual({
      '0': STAGES.done,
      '1': STAGES.scienceTurn,
      '2': STAGES.domesticTurn,
      '3': STAGES.foreignTurn,
    });
  });

  it('2-player: seat with domestic+foreign defaults to domesticTurn', () => {
    // 2-player assignments: { '0': ['chief','science'], '1': ['domestic','foreign'] }
    // Priority is science > domestic > foreign, so seat 1's primary
    // non-chief role is `domestic`.
    //
    // The "swap helper" mentioned in the plan (toggling seat 1 to
    // foreign) is part of 04.2; this test only covers the default
    // mapping.
    const client = makeClient({ numPlayers: 2 });
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );
    runMoves(client, [{ player: chiefSeat, move: '__testSetPhaseDone' }]);

    const ctx = client.getState()!.ctx;
    expect(ctx.phase).toBe('othersPhase');
    expect(ctx.activePlayers).toEqual({
      '0': STAGES.done, // chief seat
      '1': STAGES.domesticTurn,
    });
  });

  it('pure: 3-player mapping picks science over domestic at the dual-role seat', () => {
    // 3-player assignments per src/game/roles.ts:
    //   '0': ['chief','science'] → chief seat → done
    //   '1': ['domestic']        → domesticTurn
    //   '2': ['foreign']         → foreignTurn
    // The chief seat also holds science but `chief` short-circuits to `done`.
    const map = activePlayersForOthers({
      '0': ['chief', 'science'],
      '1': ['domestic'],
      '2': ['foreign'],
    });
    expect(map).toEqual({
      '0': STAGES.done,
      '1': STAGES.domesticTurn,
      '2': STAGES.foreignTurn,
    });
  });
});

describe('enterEventStage / exitEventStage (02.2)', () => {
  // Tiny state stub — the helpers only touch `_stageStack`, so the rest
  // of SettlementState is filled with empty placeholders to keep the
  // strict-typed shape happy without booting a full client.
  const makeStubG = (): SettlementState => ({
    bank: { ...EMPTY_BAG },
    centerMat: { circles: {}, tradeRequest: null },
    roleAssignments: { '0': ['chief'], '1': ['science'] },
    round: 0,
    hands: { '0': {}, '1': {} },
    _stageStack: {},
  });

  // Records every setStage call so tests can assert on the sequence.
  const makeEventsSpy = (): {
    events: StageEvents;
    calls: string[];
  } => {
    const calls: string[] = [];
    return {
      calls,
      events: {
        setStage: (stage: string) => calls.push(stage),
      },
    };
  };

  it('enter then exit returns the seat to its prior stage', () => {
    const G = makeStubG();
    const { events, calls } = makeEventsSpy();

    enterEventStage(G, '1', events, STAGES.scienceTurn);
    expect(calls).toEqual([STAGES.playingEvent]);
    expect(G._stageStack).toEqual({ '1': [STAGES.scienceTurn] });

    exitEventStage(G, '1', events);
    expect(calls).toEqual([STAGES.playingEvent, STAGES.scienceTurn]);
    expect(G._stageStack).toEqual({ '1': [] });
  });

  it('nested enter/exit unwinds in LIFO order', () => {
    const G = makeStubG();
    const { events, calls } = makeEventsSpy();

    enterEventStage(G, '1', events, STAGES.scienceTurn);
    // A second enter (e.g., the event card spawned another event) stacks
    // the now-current `playingEvent` so unwinding lands back on it before
    // the original scienceTurn.
    enterEventStage(G, '1', events, STAGES.playingEvent);
    expect(G._stageStack!['1']).toEqual([STAGES.scienceTurn, STAGES.playingEvent]);

    exitEventStage(G, '1', events);
    expect(calls.at(-1)).toBe(STAGES.playingEvent);
    exitEventStage(G, '1', events);
    expect(calls.at(-1)).toBe(STAGES.scienceTurn);
    expect(G._stageStack!['1']).toEqual([]);
  });

  it('double-exit (stack underflow) throws RangeError', () => {
    const G = makeStubG();
    const { events } = makeEventsSpy();

    enterEventStage(G, '1', events, STAGES.scienceTurn);
    exitEventStage(G, '1', events);

    expect(() => exitEventStage(G, '1', events)).toThrow(RangeError);
  });

  it('exit without any prior enter throws RangeError', () => {
    const G = makeStubG();
    const { events } = makeEventsSpy();
    expect(() => exitEventStage(G, '1', events)).toThrow(RangeError);
  });
});
