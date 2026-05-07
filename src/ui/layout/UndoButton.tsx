// UndoButton — single-slot undo control surfaced in each role panel's
// header actions row. Shows the label of the seat's most recent
// undoable action ("Undo: Recruit Scout", "Undo: Play Compass", …) and
// fires the generic `undoLast` move; renders nothing when the local
// seat has no pending undo.

import { Button } from '@mui/material';
import type { SettlementState } from '../../game/types.ts';

export interface UndoButtonProps {
  G: SettlementState;
  playerID: string;
  /** Whether the seat is currently in a stage / phase where moves are
   *  legal. The undo move itself rejects from `playingEvent`, but the
   *  caller often already computes a `canAct` flag for the role panel
   *  and we mirror it here so a stale undo button doesn't appear after
   *  the seat ends their turn. */
  canAct: boolean;
  onUndo: () => void;
}

export function UndoButton({ G, playerID, canAct, onUndo }: UndoButtonProps) {
  const last = G._lastAction;
  if (last === undefined || last.seat !== playerID) return null;
  return (
    <Button
      size="small"
      variant="text"
      disabled={!canAct}
      onClick={onUndo}
      aria-label={`Undo ${last.label}`}
    >
      Undo: {last.label}
    </Button>
  );
}

export default UndoButton;
