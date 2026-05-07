// 14.6 — resolveHint rules.

import { describe, expect, it } from 'vitest';
import { resolveHint } from '../../../src/ui/layout/phaseHintRules.ts';

describe('resolveHint (14.6)', () => {
  it('chiefPhase + chief role', () => {
    expect(
      resolveHint({ phase: 'chiefPhase', rolesAtSeat: ['chief'] }),
    ).toMatch(/Distribute resources/);
  });

  it('othersPhase + scienceTurn + science', () => {
    expect(
      resolveHint({
        phase: 'othersPhase',
        stage: 'scienceTurn',
        rolesAtSeat: ['science'],
      }),
    ).toMatch(/Pour your stash/);
  });

  it('othersPhase + domesticTurn + domestic', () => {
    expect(
      resolveHint({
        phase: 'othersPhase',
        stage: 'domesticTurn',
        rolesAtSeat: ['domestic'],
      }),
    ).toMatch(/Buy a building/);
  });

  it('othersPhase + defenseTurn + defense', () => {
    expect(
      resolveHint({
        phase: 'othersPhase',
        stage: 'defenseTurn',
        rolesAtSeat: ['defense'],
      }),
    ).toMatch(/coming in Phase 2/);
  });

  it('done stage: waiting message', () => {
    expect(
      resolveHint({
        phase: 'othersPhase',
        stage: 'done',
        rolesAtSeat: ['chief'],
      }),
    ).toMatch(/Waiting/);
  });

  it('playingEvent stage: resolve message', () => {
    expect(
      resolveHint({
        phase: 'othersPhase',
        stage: 'playingEvent',
        rolesAtSeat: ['science'],
      }),
    ).toMatch(/Resolve the event/);
  });

  it('endOfRound: bookkeeping message', () => {
    expect(
      resolveHint({ phase: 'endOfRound', rolesAtSeat: ['chief'] }),
    ).toMatch(/bookkeeping/);
  });

  it('spectator branch', () => {
    expect(
      resolveHint({
        phase: 'chiefPhase',
        rolesAtSeat: [],
        isSpectator: true,
      }),
    ).toBe('Watching.');
  });

  it('no rule matches: empty string', () => {
    expect(
      resolveHint({
        phase: 'chiefPhase',
        rolesAtSeat: ['science'], // wrong role for chiefPhase
      }),
    ).toBe('');
  });
});
