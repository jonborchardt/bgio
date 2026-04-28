// Foreign Decks (07.7) — two stacks (Battle, Trade) with face-down counts and
// "Flip" buttons. Disabled while a battle is in flight (the foreign seat
// must resolve damage first before flipping the next card).
//
// V1 simplification: trade flips are gated on `lastBattleOutcome === 'win'`
// per the move's contract; we surface that here as a disabled state.

import { Button, Paper, Stack, Typography } from '@mui/material';

export interface DecksProps {
  battleDeckCount: number;
  tradeDeckCount: number;
  battleInFlight: boolean;
  canFlipTrade: boolean;
  canAct: boolean;
  onFlipBattle: () => void;
  onFlipTrade: () => void;
}

export function Decks({
  battleDeckCount,
  tradeDeckCount,
  battleInFlight,
  canFlipTrade,
  canAct,
  onFlipBattle,
  onFlipTrade,
}: DecksProps) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      aria-label="Foreign decks"
      sx={{ alignItems: 'flex-start' }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          minWidth: '8rem',
          border: '1px solid',
          borderColor: (t) => t.palette.role.foreign.main,
          bgcolor: (t) => t.palette.card.surface,
        }}
      >
        <Stack spacing={0.5}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Battle deck
          </Typography>
          <Typography
            sx={{
              color: (t) => t.palette.role.foreign.main,
              fontWeight: 700,
            }}
          >
            {battleDeckCount}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={!canAct || battleInFlight || battleDeckCount === 0}
            onClick={onFlipBattle}
            aria-label="Flip a battle card"
          >
            Flip Battle
          </Button>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          minWidth: '8rem',
          border: '1px solid',
          borderColor: (t) => t.palette.role.foreign.main,
          bgcolor: (t) => t.palette.card.surface,
        }}
      >
        <Stack spacing={0.5}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Trade deck
          </Typography>
          <Typography
            sx={{
              color: (t) => t.palette.role.foreign.main,
              fontWeight: 700,
            }}
          >
            {tradeDeckCount}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={
              !canAct ||
              battleInFlight ||
              !canFlipTrade ||
              tradeDeckCount === 0
            }
            onClick={onFlipTrade}
            aria-label="Flip a trade card"
          >
            Flip Trade
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

export default Decks;
