// 14.12 — pickActiveSeat helper tests.

import { describe, expect, it } from 'vitest';
import { pickActiveSeat } from '../../../src/ui/layout/activeSeat.ts';
import { assignRoles } from '../../../src/game/roles.ts';

describe('pickActiveSeat (14.12)', () => {
  it('chiefPhase 4p: picks the chief seat from activePlayers', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: { '0': 'null' },
      currentPlayer: '3', // bgio leftover from previous phase
      roleAssignments,
      localSeat: '0',
    });
    expect(out.seat).toBe('0');
    expect(out.label).toBe('Player 1: chief');
    expect(out.isLocal).toBe(true);
  });

  it('othersPhase 4p mid-round: chief in done, science already flipped, picks the lowest pending seat', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: {
        '0': 'done', // chief already ended their phase
        '1': 'done', // science already flipped done
        '2': 'domesticTurn',
        '3': 'defenseTurn',
      },
      currentPlayer: '1',
      roleAssignments,
      localSeat: '0',
    });
    expect(out.seat).toBe('2');
    expect(out.label).toBe('Player 3: domestic');
    expect(out.isLocal).toBe(false);
  });

  it('othersPhase: a seat with stage scienceTurn but G.othersDone[seat]=true counts as done', () => {
    // 14.2's seatDone moves flip G.othersDone without touching the stage
    // map. The helper treats that case as "logically done" so the header
    // advances to the next pending seat.
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: {
        '0': 'done',
        '1': 'scienceTurn', // not 'done', but...
        '2': 'domesticTurn',
        '3': 'defenseTurn',
      },
      othersDone: { '1': true }, // ...science seat already flipped done.
      currentPlayer: '1',
      roleAssignments,
      localSeat: '0',
    });
    expect(out.seat).toBe('2');
    expect(out.label).toBe('Player 3: domestic');
  });

  it('othersPhase: every non-chief seat flipped othersDone falls back to currentPlayer', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: {
        '0': 'done',
        '1': 'scienceTurn',
        '2': 'domesticTurn',
        '3': 'defenseTurn',
      },
      othersDone: { '1': true, '2': true, '3': true },
      currentPlayer: '3',
      roleAssignments,
      localSeat: '0',
    });
    expect(out.seat).toBe('3');
  });

  it('null activePlayers: falls back to currentPlayer', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: null,
      currentPlayer: '2',
      roleAssignments,
      localSeat: '0',
    });
    expect(out.seat).toBe('2');
    expect(out.label).toBe('Player 3: domestic');
  });

  it('empty activePlayers: falls back to currentPlayer', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: {},
      currentPlayer: '0',
      roleAssignments,
      localSeat: '1',
    });
    expect(out.seat).toBe('0');
    expect(out.isLocal).toBe(false);
  });

  it('every seat parked in done: falls back to currentPlayer', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: { '0': 'done', '1': 'done', '2': 'done', '3': 'done' },
      currentPlayer: '0',
      roleAssignments,
      localSeat: '0',
    });
    // No seat is non-done, so we read currentPlayer.
    expect(out.seat).toBe('0');
  });

  it('2-player game: doubled-up role label', () => {
    const roleAssignments = assignRoles(2);
    const out = pickActiveSeat({
      activePlayers: { '0': 'null' },
      currentPlayer: '0',
      roleAssignments,
      localSeat: '0',
    });
    expect(out.label).toBe('Player 1: chief, science');
  });

  it('null localSeat: isLocal is false', () => {
    const roleAssignments = assignRoles(4);
    const out = pickActiveSeat({
      activePlayers: { '0': 'null' },
      currentPlayer: '0',
      roleAssignments,
      localSeat: null,
    });
    expect(out.isLocal).toBe(false);
  });
});
