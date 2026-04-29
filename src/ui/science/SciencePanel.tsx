// SciencePanel (05.5) — the science seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `science` role, OR
//   - `G.science` is missing (legacy fixtures that pre-date 05.1).
//
// Otherwise we draw the 3×3 grid (3 colors × 3 tiers). For each cell we
// compute the "lowest unfinished card in that color column" — only that
// card may receive contributions or be completed (the lowest-first rule
// enforced by `scienceContribute` / `scienceComplete`). Higher-level cards
// in the same column are dimmed inside `ScienceCard`.
//
// Contribute and Complete buttons are gated additionally on the science
// seat being in the `scienceTurn` stage (`ctx.activePlayers?.[playerID]`).
// The completion button also requires `paid >= cost` and that the seat
// hasn't already used its one-completion-per-round allowance.

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import type {
  Resource,
  ResourceBag,
} from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import type { ScienceCardDef } from '../../data/scienceCards.ts';
import { ScienceCard } from './ScienceCard.tsx';

export function SciencePanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('science')) return null;

  const science = G.science;
  if (science === undefined) return null;

  const canAct = ctx.activePlayers?.[playerID] === 'scienceTurn';
  const completionsLeft = science.perRoundCompletions < 1;
  // 14.13 — once the seat flips its done flag (via scienceSeatDone),
  // the End-my-turn button should reflect that. Re-clicking is a
  // no-op but the unchanged UI gave no feedback.
  const alreadyDone = G.othersDone?.[playerID] === true;

  // For a given card, find the lowest-level non-completed card in its color
  // column. The cell's card matches → it's the legal contribute/complete
  // target. Mirrors the rule encoded in scienceContribute.
  const lowestCardIDByColor = new Map<string, string | null>();
  for (const column of science.grid) {
    if (column.length === 0) continue;
    const color = column[0]!.color;
    let best: ScienceCardDef | undefined;
    for (const c of column) {
      if (science.completed.includes(c.id)) continue;
      if (best === undefined || c.level < best.level) best = c;
    }
    lowestCardIDByColor.set(color, best?.id ?? null);
  }

  const handleContribute = (
    cardID: string,
    resource: Resource,
    amount: number,
  ): void => {
    const amounts: Partial<ResourceBag> = { [resource]: amount };
    moves.scienceContribute(cardID, amounts);
  };

  const handleComplete = (cardID: string): void => {
    moves.scienceComplete(cardID);
  };

  const handleSeatDone = (): void => {
    moves.scienceSeatDone();
  };

  // Visualize as columns side-by-side. Each column = one color, with row 0
  // (lowest tier) at the top.
  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 2,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role.science.main,
      }}
      aria-label="Science panel"
    >
      <Stack spacing={1.5}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: (t) => t.palette.role.science.main,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          Science
        </Typography>

        <Box
          aria-label="Science grid"
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${science.grid.length}, minmax(0, 1fr))`,
            gap: 1,
          }}
        >
          {science.grid.map((column, ci) => (
            <Stack
              key={`col-${ci}`}
              spacing={1}
              aria-label={
                column[0] ? `Science column ${column[0].color}` : `Science column ${ci}`
              }
            >
              {column.map((card) => {
                const isCompleted = science.completed.includes(card.id);
                const isLowest =
                  !isCompleted &&
                  lowestCardIDByColor.get(card.color) === card.id;
                const paid = science.paid[card.id] ?? {
                  gold: 0,
                  wood: 0,
                  stone: 0,
                  steel: 0,
                  horse: 0,
                  food: 0,
                  production: 0,
                  science: 0,
                  happiness: 0,
                  worker: 0,
                };
                const completable =
                  canAct &&
                  completionsLeft &&
                  !isCompleted &&
                  canAfford(paid, card.cost);

                return (
                  <ScienceCard
                    key={card.id}
                    card={card}
                    paid={paid}
                    canAct={canAct && !isCompleted}
                    canComplete={completable}
                    isLowest={isLowest}
                    onContribute={(resource, amount) =>
                      handleContribute(card.id, resource, amount)
                    }
                    onComplete={() => handleComplete(card.id)}
                  />
                );
              })}
            </Stack>
          ))}
        </Box>

        {/* 14.2 — "End my turn" footer. Without this move + button the
            othersPhase endIf cannot trip from any UI (review fix #1
            stripped the test-only `__testSetOthersDone` from the
            production move set). */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            disabled={!canAct || alreadyDone}
            onClick={handleSeatDone}
            aria-label="End my Science turn"
            sx={{
              bgcolor: (t) => t.palette.role.science.main,
              color: (t) => t.palette.role.science.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.science.dark,
              },
            }}
          >
            {alreadyDone ? 'Turn ended' : 'End my turn'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default SciencePanel;
