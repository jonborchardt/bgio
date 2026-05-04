// Defense redesign 3.6 — TechRow.
//
// Red-color tech hand for the Defense seat. Wraps the shared
// PlayableHand primitive (used by Chief / Science / Domestic too) and
// supplies the right play-callback shape for `defensePlay`.
//
// Per spec D24 a red tech may target a unit (`unitUpgrade`) or
// manipulate the track (`peekTrack` / `swapTrackInPhase` / `demoteTrack`).
// The args ergonomics differ per kind — this row only handles the
// "no-args" plays (peek / demote) directly. Targeted plays open a unit
// picker dialog (units chosen with care so the picker stays simple) or
// surface a placeholder telling the player which prompt would land in
// 3.7's polish pass.
//
// Defense plays the card free of resource cost (the science seat
// already paid via `scienceContribute` / `scienceComplete` when the
// red tech was distributed). The PlayableHand component understands
// "free" via an empty entries list, so we forward the seat's stash
// for affordability checks but most red techs have no `costBag`.

import type { ReactNode } from 'react';
import type { TechnologyDef } from '../../data/schema.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { PlayableHand } from '../cards/PlayableHand.tsx';

export interface TechRowProps {
  techs: ReadonlyArray<TechnologyDef>;
  /** Seat stash; PlayableHand uses it for cost gating. Most red techs
   *  ship with no `costBag` so the gate trivially passes. */
  funds: ResourceBag | undefined;
  /** True when the seat is in `defenseTurn` and not yet ended. */
  canAct: boolean;
  /** Called with a tech name when the player clicks Play on a
   *  no-args-targeted card (peek / demote). The panel binds this to
   *  `moves.defensePlay(techName)`. */
  onPlay: (techName: string) => void;
  /** Optional empty-state hint. */
  emptyHint?: string;
  /** Optional per-card help-request button. */
  renderHelpButton?: (tech: TechnologyDef) => ReactNode;
}

export function TechRow({
  techs,
  funds,
  canAct,
  onPlay,
  emptyHint = 'No red tech cards yet — complete a red science card to add one.',
  renderHelpButton,
}: TechRowProps) {
  return (
    <PlayableHand
      techs={techs}
      holderRole="defense"
      funds={funds}
      canAct={canAct}
      onPlay={onPlay}
      emptyHint={emptyHint}
      title="Tech"
      renderHelpButton={renderHelpButton}
    />
  );
}

export default TechRow;
