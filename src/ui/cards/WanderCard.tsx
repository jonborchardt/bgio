// WanderCard — presentational view of a WanderCardDef. Mirrors the
// structured layout of EventCard / BattleCard: a titled header, an
// "Effect" section that renders each EventEffect (gainResource as a
// row of ResourceTokens, modifier / one-shot kinds as a one-line rule
// text), and an italic flavor tail at `detailed` size.
//
// The rule strings are kept in sync with the engine: each case mirrors
// what the dispatcher (events/dispatcher.ts) and the modifier consumers
// in role moves actually do when the matching kind is queued or applied.

import { Box, Stack, Typography } from '@mui/material';
import type { WanderCardDef } from '../../data/wanderCards.ts';
import type { EventEffect } from '../../game/events/effects.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForWander } from '../../cards/registry.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { GainResourceTokens } from '../opponent/GainResourceTokens.tsx';
import {
  bagResources,
  isGain,
  ruleText,
} from '../opponent/wanderEffectFormat.ts';

export interface WanderCardProps {
  def: WanderCardDef;
  size?: CardSize;
  cardId?: string;
}

export function WanderCard({
  def,
  size = 'normal',
  cardId,
}: WanderCardProps) {
  const id = cardId === undefined ? idForWander(def) : cardId || undefined;
  // `WanderCardDef.effects` is schema-typed as `unknown[]` (the schema
  // doesn't import the engine's `EventEffect` union). The dispatcher
  // already exhaustively narrows by `kind`; here the cast is the
  // boundary that matches the dispatcher's contract.
  const effects = def.effects as EventEffect[];

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
          🌫 {def.name}
        </Typography>
      </CardFrame>
    );
  }

  if (size === 'small') {
    const firstGain = effects.find(isGain);
    const firstRule = effects.map(ruleText).find((t): t is string => t !== null);
    return (
      <CardFrame size="small" cardId={id}>
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            🌫 {def.name}
          </Typography>
          {firstGain ? (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ flexWrap: 'wrap', rowGap: 0.25, alignItems: 'center' }}
            >
              {bagResources(firstGain.bag).map((r) => (
                <ResourceToken
                  key={r}
                  resource={r}
                  count={firstGain.bag[r] ?? 0}
                  size="small"
                  sign="+"
                />
              ))}
            </Stack>
          ) : firstRule ? (
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6rem',
                color: (t) => t.palette.status.muted,
                lineHeight: 1.2,
              }}
            >
              {firstRule}
            </Typography>
          ) : null}
        </Stack>
      </CardFrame>
    );
  }

  return (
    <CardFrame size={size} cardId={id}>
      <Stack spacing={0.75}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            🌫 {def.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontSize: '0.65rem',
            }}
          >
            Wander
          </Typography>
        </Stack>
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontSize: '0.65rem',
            }}
          >
            Effect
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 0.25 }}>
            {effects.map((e, i) => {
              if (isGain(e)) return <GainResourceTokens key={i} effect={e} />;
              const text = ruleText(e);
              if (text === null) return null;
              return (
                <Typography key={i} variant="caption" sx={{ lineHeight: 1.3 }}>
                  {text}
                </Typography>
              );
            })}
          </Stack>
        </Box>
        {def.flavor && size === 'detailed' ? (
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              lineHeight: 1.35,
            }}
          >
            {def.flavor}
          </Typography>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default WanderCard;
