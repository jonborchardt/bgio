// Defense redesign 3.8 — flipTrackLogic helper tests.
//
// Pin every disabled / enabled branch of the chief panel's
// FlipTrackButton + End-my-phase gating helpers. The component tests
// (FlipTrackButton.test.tsx, ChiefPanel.test.tsx) read these strings
// for their tooltip / inline-error assertions, so a change here
// surfaces in three places at once — intentional.

import { describe, expect, it } from 'vitest';
import {
  chiefEndPhaseDisabledReason,
  flipTrackDisabledReason,
} from '../../../src/ui/chief/flipTrackLogic.ts';

describe('flipTrackDisabledReason (defense redesign 3.8)', () => {
  it('returns null when the chief can act, has not flipped, and the deck is non-empty', () => {
    expect(
      flipTrackDisabledReason({
        canAct: true,
        flipped: false,
        upcomingCount: 30,
      }),
    ).toBeNull();
  });

  it('disables outside chief phase', () => {
    expect(
      flipTrackDisabledReason({
        canAct: false,
        flipped: false,
        upcomingCount: 30,
      }),
    ).toBe('Flip is only available during your phase.');
  });

  it('disables once the round latch is set', () => {
    expect(
      flipTrackDisabledReason({
        canAct: true,
        flipped: true,
        upcomingCount: 30,
      }),
    ).toBe('Already flipped this round.');
  });

  it('disables when the upcoming pile is empty', () => {
    expect(
      flipTrackDisabledReason({
        canAct: true,
        flipped: false,
        upcomingCount: 0,
      }),
    ).toBe('Track is exhausted — nothing left to flip.');
  });

  it('treats a negative upcomingCount as exhausted (defensive)', () => {
    expect(
      flipTrackDisabledReason({
        canAct: true,
        flipped: false,
        upcomingCount: -1,
      }),
    ).toBe('Track is exhausted — nothing left to flip.');
  });

  it('off-phase wins over already-flipped (most actionable reason first)', () => {
    expect(
      flipTrackDisabledReason({
        canAct: false,
        flipped: true,
        upcomingCount: 30,
      }),
    ).toBe('Flip is only available during your phase.');
  });
});

describe('chiefEndPhaseDisabledReason (defense redesign 3.8)', () => {
  it('returns null when the chief can act and the flip latch is set', () => {
    expect(
      chiefEndPhaseDisabledReason({
        canAct: true,
        flipped: true,
        hasTrack: true,
      }),
    ).toBeNull();
  });

  it('returns null on track-less fixtures regardless of latch', () => {
    expect(
      chiefEndPhaseDisabledReason({
        canAct: true,
        flipped: false,
        hasTrack: false,
      }),
    ).toBeNull();
  });

  it('disables outside chief phase', () => {
    expect(
      chiefEndPhaseDisabledReason({
        canAct: false,
        flipped: true,
        hasTrack: true,
      }),
    ).toBe('End is only available during your phase.');
  });

  it('disables until the chief flips when the track exists', () => {
    expect(
      chiefEndPhaseDisabledReason({
        canAct: true,
        flipped: false,
        hasTrack: true,
      }),
    ).toBe('Flip the track card before ending your phase.');
  });

  it('off-phase wins over flip gate (most actionable reason first)', () => {
    expect(
      chiefEndPhaseDisabledReason({
        canAct: false,
        flipped: false,
        hasTrack: true,
      }),
    ).toBe('End is only available during your phase.');
  });
});
