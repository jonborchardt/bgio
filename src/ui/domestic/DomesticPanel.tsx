// DomesticPanel (06.7) — the domestic seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `domestic` role, OR
//   - `G.domestic` is missing (legacy fixtures pre-06.1).
//
// Otherwise we render:
//   1. <Hand>           — building cards available to buy and place.
//   2. <BuildingGrid>   — placed buildings and a one-cell ring of empty
//                          slots; clicking a legal empty slot fires
//                          `domesticBuyBuilding(name, x, y)`.
//   3. "Produce" button — fires `domesticProduce()`. Disabled when:
//        - the domestic seat isn't in `domesticTurn`, OR
//        - `G.domestic.producedThisRound` is set (already produced).
//
// Local React state holds the currently-selected hand card. Selection is
// the panel-local "I'm placing this card" mode; clicking the same card
// again clears it. The contribute / upgrade flows are out of scope for
// V1 of this panel — they're reachable by extending the cell click
// handler in 06.7's follow-on work.

import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { Hand } from './Hand.tsx';
import { BuildingGrid } from './BuildingGrid.tsx';

export function DomesticPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;

  // Hooks must be called unconditionally — hold the panel-local "selected
  // hand card" state above the early-return guards. (When the panel is
  // hidden, the state simply has no consumers.)
  const [selectedCardName, setSelectedCardName] = useState<
    string | undefined
  >(undefined);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('domestic')) return null;

  const domestic = G.domestic;
  if (domestic === undefined) return null;

  const canAct = ctx.activePlayers?.[playerID] === 'domesticTurn';
  const alreadyProduced = domestic.producedThisRound === true;

  const activeCard = selectedCardName
    ? domestic.hand.find((c) => c.name === selectedCardName)
    : undefined;

  const handleSelect = (name: string): void => {
    setSelectedCardName((prev) => (prev === name ? undefined : name));
  };

  const handlePlace = (x: number, y: number): void => {
    if (selectedCardName === undefined) return;
    moves.domesticBuyBuilding(selectedCardName, x, y);
    // Clear selection after dispatch — buy moves consume one hand entry, and
    // even on INVALID_MOVE the user can re-select to retry.
    setSelectedCardName(undefined);
  };

  const handleProduce = (): void => {
    moves.domesticProduce();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 2,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role.domestic.main,
      }}
      aria-label="Domestic panel"
    >
      <Stack spacing={1.5}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: (t) => t.palette.role.domestic.main,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          Domestic
        </Typography>

        <Hand
          hand={[...domestic.hand]}
          selectedName={selectedCardName}
          onSelect={handleSelect}
        />

        <BuildingGrid
          grid={domestic.grid}
          activeCard={activeCard}
          onPlace={handlePlace}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            disabled={!canAct || alreadyProduced}
            onClick={handleProduce}
            aria-label="Produce this round"
            sx={{
              bgcolor: (t) => t.palette.role.domestic.main,
              color: (t) => t.palette.role.domestic.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.domestic.dark,
              },
            }}
          >
            {alreadyProduced ? 'Produced' : 'Produce'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default DomesticPanel;
