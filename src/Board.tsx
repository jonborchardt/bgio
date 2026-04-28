import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from './game/index.ts';
import { ChiefPanel } from './ui/chief/ChiefPanel.tsx';
import { SciencePanel } from './ui/science/SciencePanel.tsx';
import { DomesticPanel } from './ui/domestic/DomesticPanel.tsx';
import { ForeignPanel } from './ui/foreign/ForeignPanel.tsx';

export function SettlementBoard(props: BoardProps<SettlementState>) {
  const { G, ctx, moves } = props;
  const gameOver = ctx.gameover !== undefined;
  const seats = Object.keys(G.roleAssignments).sort();

  return (
    <Box sx={{ width: 'min(100%, 36rem)', display: 'grid', gap: 3 }}>
      <Box component="header" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: '0.02em', mb: 0.5 }}
        >
          Settlement
        </Typography>
        <Typography
          sx={{
            fontWeight: 500,
            color: (t) =>
              gameOver ? t.palette.status.muted : t.palette.status.active,
          }}
        >
          {gameOver
            ? 'Game over'
            : `Player ${Number(ctx.currentPlayer) + 1}'s turn`}
        </Typography>
      </Box>

      <Stack component="section" spacing={1.5} aria-label="Role assignments">
        {seats.map((seat) => {
          const active = ctx.currentPlayer === seat && !gameOver;
          const roles = G.roleAssignments[seat] ?? [];
          return (
            <Paper
              key={seat}
              elevation={0}
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: (t) => t.palette.card.surface,
                border: '1px solid',
                borderColor: (t) =>
                  active ? t.palette.status.active : 'transparent',
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                Player {Number(seat) + 1}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {roles.join(', ')}
              </Typography>
            </Paper>
          );
        })}
      </Stack>

      <ChiefPanel {...props} />
      <SciencePanel {...props} />
      <DomesticPanel {...props} />
      <ForeignPanel {...props} />

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          disabled={gameOver}
          onClick={() => moves.pass()}
        >
          End my turn
        </Button>
      </Box>
    </Box>
  );
}
