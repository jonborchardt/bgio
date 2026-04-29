// ForeignPanel (07.7) — the foreign seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `foreign` role, OR
//   - `G.foreign` is missing (legacy fixtures pre-07.1).
//
// Otherwise we render:
//   1. Foreign hand row — recruit (+1) buttons per UnitDef in the hand.
//   2. <Army>           — count-collapsed list of in-play units, each with a
//                          Release button.
//   3. <Decks>          — Battle / Trade decks with Flip buttons.
//   4. <BattlePanel>    — visible only when `inFlight.battle !== null`;
//                          opens the AssignDamageDialog.
//   5. "Pay Upkeep"     — fires `foreignUpkeep()`.
//
// Stage gating: most actions require `ctx.activePlayers?.[playerID] ===
// 'foreignTurn'`. Assign-damage requires `'foreignAwaitingDamage'` (the
// stage `foreignFlipBattle` pushes the seat into).

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import type { DamageAllocation } from '../../game/roles/foreign/battleResolver.ts';
import { Army } from './Army.tsx';
import { Decks } from './Decks.tsx';
import { BattlePanel } from './BattlePanel.tsx';

export function ForeignPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('foreign')) return null;

  const foreign = G.foreign;
  if (foreign === undefined) return null;

  const stage = ctx.activePlayers?.[playerID];
  const canActOnTurn = stage === 'foreignTurn';
  const canAssignDamage = stage === 'foreignAwaitingDamage';
  const battleInFlight = foreign.inFlight.battle !== null;
  const canFlipTrade = foreign.lastBattleOutcome === 'win';
  const upkeepPaid = foreign._upkeepPaid === true;

  const handleRecruit = (defID: string): void => {
    moves.foreignRecruit(defID, 1);
  };

  const handleRelease = (defID: string): void => {
    moves.foreignReleaseUnit(defID);
  };

  const handleFlipBattle = (): void => {
    moves.foreignFlipBattle();
  };

  const handleFlipTrade = (): void => {
    moves.foreignFlipTrade();
  };

  const handleUpkeep = (): void => {
    moves.foreignUpkeep();
  };

  const handleAssignDamage = (allocations: DamageAllocation[]): void => {
    moves.foreignAssignDamage(allocations);
  };

  const handleSeatDone = (): void => {
    moves.foreignSeatDone();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 2,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role.foreign.main,
      }}
      aria-label="Foreign panel"
    >
      <Stack spacing={1.5}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: (t) => t.palette.role.foreign.main,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          Foreign
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          aria-label="Foreign hand"
          sx={{ flexWrap: 'wrap', rowGap: 1 }}
        >
          {foreign.hand.length === 0 ? (
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              No recruitable units.
            </Typography>
          ) : (
            foreign.hand.map((unit) => (
              <Button
                key={unit.name}
                size="small"
                variant="outlined"
                disabled={!canActOnTurn}
                onClick={() => handleRecruit(unit.name)}
                aria-label={`Recruit one ${unit.name}`}
                sx={{
                  color: (t) => t.palette.role.foreign.main,
                  borderColor: (t) => t.palette.role.foreign.main,
                }}
              >
                + {unit.name} ({unit.cost}g)
              </Button>
            ))
          )}
        </Stack>

        <Army
          inPlay={foreign.inPlay.map((u) => ({ ...u }))}
          canAct={canActOnTurn}
          onRelease={handleRelease}
        />

        <Decks
          battleDeckCount={foreign.battleDeck.length}
          tradeDeckCount={foreign.tradeDeck.length}
          battleInFlight={battleInFlight}
          canFlipTrade={canFlipTrade}
          canAct={canActOnTurn}
          onFlipBattle={handleFlipBattle}
          onFlipTrade={handleFlipTrade}
        />

        <BattlePanel
          inFlight={foreign.inFlight}
          inPlay={foreign.inPlay.map((u) => ({ ...u }))}
          canAssignDamage={canAssignDamage}
          onAssignDamage={handleAssignDamage}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            variant="contained"
            disabled={!canActOnTurn || upkeepPaid}
            onClick={handleUpkeep}
            aria-label="Pay upkeep"
            sx={{
              bgcolor: (t) => t.palette.role.foreign.main,
              color: (t) => t.palette.role.foreign.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.foreign.dark,
              },
            }}
          >
            {upkeepPaid ? 'Upkeep paid' : 'Pay Upkeep'}
          </Button>
          {/* 14.2 — "End my turn" — flips G.othersDone[seat]; bgio
              transitions to endOfRound once every non-chief seat has.
              Allowed from foreignTurn or foreignAwaitingDamage so the
              seat is never stuck in a battle interrupt. */}
          <Button
            variant="contained"
            disabled={!canActOnTurn && !canAssignDamage}
            onClick={handleSeatDone}
            aria-label="End my Foreign turn"
            sx={{
              bgcolor: (t) => t.palette.role.foreign.main,
              color: (t) => t.palette.role.foreign.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.foreign.dark,
              },
            }}
          >
            End my turn
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default ForeignPanel;
