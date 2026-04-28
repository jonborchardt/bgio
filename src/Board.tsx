import { Box, ButtonBase, Paper, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { CardSweepState } from './game.ts';

export function CardSweepBoard({ G, ctx, moves }: BoardProps<CardSweepState>) {
  const winner = ctx.gameover?.winner as string | undefined;
  const draw = ctx.gameover?.draw as boolean | undefined;
  const gameOver = winner !== undefined || draw === true;

  const status = gameOver
    ? draw
      ? 'Draw!'
      : `Player ${Number(winner) + 1} wins!`
    : `Player ${Number(ctx.currentPlayer) + 1}'s turn`;

  return (
    <Box sx={{ width: 'min(100%, 36rem)', display: 'grid', gap: 3 }}>
      <Box component="header" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: '0.02em', mb: 0.5 }}
        >
          Card Sweep
        </Typography>
        <Typography
          sx={{
            fontWeight: 500,
            color: (t) => (gameOver ? t.palette.status.muted : t.palette.status.active),
          }}
        >
          {status}
        </Typography>
      </Box>

      <Box
        component="section"
        sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
      >
        {(['0', '1'] as const).map((pid) => {
          const active = ctx.currentPlayer === pid && !gameOver;
          return (
            <Paper
              key={pid}
              elevation={0}
              sx={{
                display: 'grid',
                gap: 0.5,
                px: 2,
                py: 1.5,
                textAlign: 'center',
                bgcolor: (t) => t.palette.card.surface,
                border: '1px solid',
                borderColor: (t) =>
                  active ? t.palette.status.active : 'transparent',
              }}
            >
              <Typography variant="body2" sx={{ color: (t) => t.palette.status.muted }}>
                Player {Number(pid) + 1}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {G.scores[pid] ?? 0}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      <Box
        component="section"
        aria-label="Cards on the table"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}
      >
        {G.cards.map((value, idx) => {
          const taken = value === null;
          return (
            <ButtonBase
              key={idx}
              disabled={taken || gameOver}
              onClick={() => moves.pickCard(idx)}
              aria-label={taken ? 'Card already taken' : `Take card ${value}`}
              focusRipple
              sx={{
                aspectRatio: '3 / 4',
                fontSize: taken ? '1.5rem' : '2.5rem',
                fontWeight: 700,
                borderRadius: 1.5,
                border: '2px solid transparent',
                bgcolor: (t) =>
                  taken ? t.palette.card.takenSurface : t.palette.card.surface,
                color: (t) => (taken ? t.palette.card.takenText : t.palette.card.text),
                transition:
                  'transform 80ms ease, border-color 120ms ease, background 120ms ease',
                '&:hover:not(.Mui-disabled)': {
                  borderColor: (t) => t.palette.status.active,
                  transform: 'translateY(-2px)',
                },
                '&.Mui-disabled': {
                  cursor: 'not-allowed',
                },
              }}
            >
              {taken ? '·' : value}
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        component="footer"
        sx={{ textAlign: 'center', color: (t) => t.palette.status.muted }}
      >
        <Typography variant="body2">
          Pick the highest-value card on your turn. Take turns until all nine cards are gone — the
          higher total score wins.
        </Typography>
      </Box>
    </Box>
  );
}
