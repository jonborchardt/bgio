// WanderEffectRow — one-line view of the currently-applied wander card,
// rendered under each role panel's RequestsRow. Shows just the card name
// and a compact summary of its effect(s); deck and discard are
// intentionally not surfaced here.

import { Box, Stack, Typography } from '@mui/material';
import type { SettlementState } from '../../game/types.ts';
import type { WanderCardDef } from '../../data/wanderCards.ts';
import type { EventEffect } from '../../game/events/effects.ts';
import { GainResourceTokens } from './GainResourceTokens.tsx';
import { isGain, ruleText } from './wanderEffectFormat.ts';

export interface WanderEffectRowProps {
  opponent: SettlementState['opponent'];
}

const renderEffect = (effect: EventEffect, key: number) => {
  if (isGain(effect)) return <GainResourceTokens key={key} effect={effect} />;
  const text = ruleText(effect);
  if (text === null) return null;
  return (
    <Typography key={key} variant="caption" sx={{ lineHeight: 1.3 }}>
      {text}
    </Typography>
  );
};

export function WanderEffectRow({ opponent }: WanderEffectRowProps) {
  if (opponent === undefined) return null;
  const card: WanderCardDef | null = opponent.wander.currentlyApplied;

  return (
    <Box
      aria-label="Wander effect"
      sx={{
        px: 1,
        py: 0.5,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        borderRadius: 1,
        bgcolor: (t) => t.palette.card.surface,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
      >
        <Typography
          variant="overline"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1,
            color: (t) => t.palette.status.muted,
          }}
        >
          🌫 Wander
        </Typography>
        {card === null ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            No card flipped yet.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {card.name}
            </Typography>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              {(card.effects as EventEffect[]).map((e, i) => renderEffect(e, i))}
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}

export default WanderEffectRow;
