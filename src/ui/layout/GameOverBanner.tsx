// GameOverBanner (14.5) — sticky strip at the top of the board that
// renders when bgio's `endIf` (08.5) has fired and stored a
// `GameOutcome` on `ctx.gameover`.
//
// Two outcome kinds:
//   - 'win' — the village resolved the boss card (Phase 2.7). Chief-gold
//     accent. Until 2.7 lands the boss, this branch is unreachable in
//     practice; the banner still handles it for future-proofing.
//   - 'timeUp' — the round cap was reached without winning. Muted accent.
// "Play again" reloads the page; the proper lobby `playAgain` plumbing
// (10.x) is out of scope here.

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { GameOutcome } from '../../game/endConditions.ts';

export interface GameOverBannerProps {
  outcome: GameOutcome;
  onPlayAgain?: () => void;
}

export function GameOverBanner({
  outcome,
  onPlayAgain,
}: GameOverBannerProps) {
  const isWin = outcome.kind === 'win';
  const headline = isWin
    ? 'You won!'
    : "Time's up";
  const detail = isWin
    ? `Turns taken: ${outcome.turns}`
    : `Reached turn ${outcome.turns}.`;

  return (
    <Paper
      elevation={0}
      aria-label="Game over banner"
      sx={{
        px: 2.5,
        py: 1.5,
        bgcolor: (t) => t.palette.card.surface,
        border: '2px solid',
        borderColor: (t) =>
          isWin ? t.palette.role.chief.main : t.palette.status.muted,
        borderRadius: 1,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography
            variant="h5"
            component="p"
            sx={{
              fontWeight: 700,
              color: (t) =>
                isWin ? t.palette.role.chief.main : t.palette.status.muted,
            }}
          >
            {headline}
          </Typography>
          <Typography variant="body2">{detail}</Typography>
        </Box>
        {onPlayAgain ? (
          <Button
            variant="outlined"
            onClick={onPlayAgain}
            aria-label="Play again"
          >
            Play again
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default GameOverBanner;
