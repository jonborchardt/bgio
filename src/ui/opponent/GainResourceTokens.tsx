// Inline gain-resource render: a row of `+N` resource tokens followed
// by an arrow-prefixed target label. Used by both WanderCard's "Effect"
// list and WanderEffectRow's inline summary.
//
// Lives in its own file so `wanderEffectFormat.ts` (helpers + type
// guard) doesn't mix component + non-component exports — Vite's React
// Fast Refresh requires component files to export only components.

import { Stack, Typography } from '@mui/material';
import type { EventEffect } from '../../game/events/effects.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { bagResources } from './wanderEffectFormat.ts';

type GainEffect = Extract<EventEffect, { kind: 'gainResource' }>;

export function GainResourceTokens({ effect }: { effect: GainEffect }) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.25 }}
    >
      {bagResources(effect.bag).map((r) => (
        <ResourceToken
          key={r}
          resource={r}
          count={effect.bag[r] ?? 0}
          size="small"
          sign="+"
        />
      ))}
      <Typography
        variant="caption"
        sx={{ color: (t) => t.palette.status.muted, lineHeight: 1.2 }}
      >
        → {effect.target}
      </Typography>
    </Stack>
  );
}
