// Defense redesign 3.6 — UnitHand.
//
// Horizontal row of the Defense seat's `G.defense.hand` cards. Each
// card is rendered via the local `UnitCard` (which wraps the canonical
// V9 UnitCard with a buy-and-place trigger). Selection is hoisted to
// the parent (DefensePanel) so the placement-overlay flow can see which
// card is "armed."
//
// Empty state surfaces a one-line italic hint pinned with the defense
// accent so the panel doesn't render a blank gap when the seat starts
// without any unit cards.

import { Stack, Typography } from '@mui/material';
import type { UnitDef } from '../../data/schema.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { UnitCard } from './UnitCard.tsx';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';

export interface UnitHandProps {
  hand: ReadonlyArray<UnitDef>;
  /** Seat stash — forwarded to the per-card affordability gate. */
  stash?: ResourceBag;
  /** True when the seat is in `defenseTurn` and not yet ended. */
  canAct: boolean;
  /** Currently-armed unit name (toggled by clicking a card). */
  selectedName?: string;
  /** Toggle selection. The hand calls back with the unit's name. */
  onSelect: (unitDefID: string) => void;
  /** Optional fallback message when the hand is empty. */
  emptyHint?: string;
}

export function UnitHand({
  hand,
  stash,
  canAct,
  selectedName,
  onSelect,
  emptyHint = 'No unit cards available.',
}: UnitHandProps) {
  if (hand.length === 0) {
    return (
      <EmbossedFrame
        role="defense"
        sx={{
          alignSelf: 'stretch',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          data-defense-hand-empty="true"
          sx={{
            color: (t) => t.palette.status.muted,
            fontStyle: 'italic',
            py: 2,
          }}
        >
          {emptyHint}
        </Typography>
      </EmbossedFrame>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1.25}
      data-defense-hand="true"
      aria-label="Defense unit hand"
      sx={{ flexWrap: 'wrap', rowGap: 1.25, alignItems: 'stretch' }}
    >
      {hand.map((def) => (
        <UnitCard
          key={def.name}
          def={def}
          stash={stash}
          canAct={canAct}
          selectedName={selectedName}
          onSelect={onSelect}
        />
      ))}
    </Stack>
  );
}

export default UnitHand;
