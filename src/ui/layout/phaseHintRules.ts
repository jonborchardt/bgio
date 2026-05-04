// phaseHintRules (14.6) — pure rule lookup, split from
// `PhaseHint.tsx` so React Fast Refresh stays clean (the linter
// warns when a TSX module mixes component and non-component
// exports).

import type { Role } from '../../game/types.ts';

export interface PhaseHintInput {
  phase: string | null;
  stage?: string;
  rolesAtSeat: ReadonlyArray<Role>;
  isSpectator?: boolean;
}

export const resolveHint = ({
  phase,
  stage,
  rolesAtSeat,
  isSpectator,
}: PhaseHintInput): string => {
  if (isSpectator === true) return 'Watching.';

  if (phase === 'chiefPhase' && rolesAtSeat.includes('chief')) {
    return 'Distribute resources to non-chief seats. End your turn when ready.';
  }
  if (phase === 'endOfRound') {
    return 'Round ending — opponent acts now.';
  }
  if (stage === 'playingEvent') {
    return 'Resolve the event you played.';
  }
  if (stage === 'done') {
    return 'Waiting for the other roles.';
  }
  if (phase === 'othersPhase') {
    if (stage === 'scienceTurn' && rolesAtSeat.includes('science')) {
      return 'Pour your stash into a science card. Complete one when paid covers cost.';
    }
    if (stage === 'domesticTurn' && rolesAtSeat.includes('domestic')) {
      return 'Buy a building, produce, or end your turn.';
    }
    if (stage === 'defenseTurn' && rolesAtSeat.includes('defense')) {
      return 'Defense is on hold — coming in Phase 2. End your turn when ready.';
    }
  }
  return '';
};
