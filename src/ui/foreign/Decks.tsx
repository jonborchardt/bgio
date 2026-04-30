// Foreign Decks (07.7) — two stacks (Battle, Trade) with face-down counts and
// "Flip" buttons. Disabled while a battle is in flight (the foreign seat
// must resolve damage first before flipping the next card).
//
// V1 simplification: trade flips are gated on `lastBattleOutcome === 'win'`
// per the move's contract; we surface that here as a disabled state.

import { Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material';

export interface DecksProps {
  battleDeckCount: number;
  tradeDeckCount: number;
  battleInFlight: boolean;
  canFlipTrade: boolean;
  canAct: boolean;
  hasUnits: boolean;
  onFlipBattle: () => void;
  onFlipTrade: () => void;
}

export function Decks({
  battleDeckCount,
  tradeDeckCount,
  battleInFlight,
  canFlipTrade,
  canAct,
  hasUnits,
  onFlipBattle,
  onFlipTrade,
}: DecksProps) {
  const flipBattleTooltip = !canAct
    ? "Wait for the Foreign seat's turn"
    : battleInFlight
      ? 'Resolve the current battle first'
      : battleDeckCount === 0
        ? 'Battle deck is empty'
        : !hasUnits
          ? 'Recruit at least one unit before flipping a battle'
          : '';

  const battleDeckExplainer =
    'Battle cards are enemy forces. Flipping one starts a fight: assign damage from the enemy units to your committed army. Win and you take the reward (and may flip a trade card next). Lose and you owe tribute. Cards are ordered low-number first, so threats escalate as the round goes on.';

  const tradeDeckExplainer =
    'Trade cards are foreign offers — each asks for specific resources in exchange for a reward. You can only flip a trade card after winning a battle, once per win. The drawn card goes to the center mat for the Chief to fulfill or refuse on their turn.';
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
          <Tooltip title={battleDeckExplainer} placement="top">
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontWeight: 600,
                cursor: 'help',
                textDecoration: 'underline dotted',
                textUnderlineOffset: '2px',
                alignSelf: 'flex-start',
              }}
            >
              Battle deck
            </Typography>
          </Tooltip>
          <Typography
            sx={{
              color: (t) => t.palette.role.foreign.main,
              fontWeight: 700,
            }}
          >
            {battleDeckCount}
          </Typography>
          <Tooltip
            title={flipBattleTooltip}
            placement="top"
            disableHoverListener={flipBattleTooltip === ''}
          >
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={
                  !canAct ||
                  battleInFlight ||
                  battleDeckCount === 0 ||
                  !hasUnits
                }
                onClick={onFlipBattle}
                aria-label="Flip a battle card"
              >
                Flip Battle
              </Button>
            </Box>
          </Tooltip>
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
          <Tooltip title={tradeDeckExplainer} placement="top">
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontWeight: 600,
                cursor: 'help',
                textDecoration: 'underline dotted',
                textUnderlineOffset: '2px',
                alignSelf: 'flex-start',
              }}
            >
              Trade deck
            </Typography>
          </Tooltip>
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
