// TechCard — presentational view of a TechnologyDef.
//
// Renders every populated field on the def so the card sells itself at the
// table:
//   - Header: name + branch + cost
//   - Order line (prereq techs)
//   - costBag chips (when present) for the science contribute path
//   - Unlocks: buildings + units (only the rows that are non-empty)
//   - The per-color event line that matches `holderRole`, highlighted as
//     "For you"; the other three color lines render below as muted context
//   - Effect badges: 'auto' / 'play' / 'passive' for the typed 08.6 fields
//
// `holderRole` is optional: when undefined (e.g. SciencePanel preview before
// distribution), all four color lines render equally.

import { Box, Chip, Stack, Typography } from '@mui/material';
import type { TechnologyDef } from '../../data/schema.ts';
import type { Role } from '../../game/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { CardFrame } from './CardFrame.tsx';
import { ResourceChip } from '../resources/ResourceChip.tsx';

export interface TechCardProps {
  def: TechnologyDef;
  // The role currently holding this tech in hand. Drives which color event
  // line is highlighted as "for you". Mirrors the fixed mapping in
  // scienceComplete + the SciencePanel ScienceCard tooltip.
  holderRole?: Role;
}

type EventColor = 'blue' | 'green' | 'red' | 'gold';

const COLOR_BY_ROLE: Record<Role, EventColor> = {
  science: 'blue',
  domestic: 'green',
  foreign: 'red',
  chief: 'gold',
};

const COLOR_FIELD: Record<EventColor, keyof TechnologyDef> = {
  blue: 'blueEvent',
  green: 'greenEvent',
  red: 'redEvent',
  gold: 'goldEvent',
};

const COLOR_LABEL: Record<EventColor, string> = {
  blue: 'Blue (Science)',
  green: 'Green (Domestic)',
  red: 'Red (Foreign)',
  gold: 'Gold (Chief)',
};

const ALL_COLORS: ReadonlyArray<EventColor> = ['blue', 'green', 'red', 'gold'];

const costResources = (cost: Partial<ResourceBag>): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    if ((cost[r] ?? 0) > 0) out.push(r);
  }
  return out;
};

const isNonEmpty = (s: string | undefined): s is string =>
  typeof s === 'string' && s.trim().length > 0;

export function TechCard({ def, holderRole }: TechCardProps) {
  const myColor: EventColor | undefined = holderRole
    ? COLOR_BY_ROLE[holderRole]
    : undefined;
  const myEventField = myColor ? COLOR_FIELD[myColor] : undefined;
  const myEventText =
    myEventField && typeof def[myEventField] === 'string'
      ? (def[myEventField] as string)
      : '';

  const costBagResources = def.costBag ? costResources(def.costBag) : [];

  const otherColorLines = ALL_COLORS.filter((c) => c !== myColor)
    .map((c) => {
      const v = def[COLOR_FIELD[c]];
      return typeof v === 'string' && v.trim().length > 0
        ? { color: c, label: COLOR_LABEL[c], text: v }
        : null;
    })
    .filter((entry): entry is { color: EventColor; label: string; text: string } => entry !== null);

  const effectBadges: Array<{ label: string; title: string }> = [];
  if ((def.onAcquireEffects?.length ?? 0) > 0) {
    effectBadges.push({
      label: 'Auto',
      title: 'Effect fires when this tech is distributed into a hand.',
    });
  }
  if ((def.onPlayEffects?.length ?? 0) > 0) {
    effectBadges.push({
      label: 'Play',
      title: 'Effect fires when the holder explicitly plays this tech.',
    });
  }
  if ((def.passiveEffects?.length ?? 0) > 0) {
    effectBadges.push({
      label: 'Passive',
      title: 'Effect modifies the holder while the card is in hand.',
    });
  }

  return (
    <CardFrame>
      <Stack spacing={0.75}>
        {/* Header: name + branch + cost text */}
        <Stack spacing={0.25}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {def.name}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
            {isNonEmpty(def.branch) ? (
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {def.branch}
              </Typography>
            ) : null}
            {isNonEmpty(def.cost) ? (
              <Typography
                variant="caption"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                · Cost: {def.cost}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        {/* costBag chips (machine-readable cost) */}
        {costBagResources.length > 0 ? (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            {costBagResources.map((resource) => {
              const need = def.costBag?.[resource] ?? 0;
              return (
                <ResourceChip
                  key={resource}
                  resource={resource}
                  count={need}
                  size="sm"
                  label={`${resource} ${need}`}
                />
              );
            })}
          </Stack>
        ) : null}

        {/* Order (prereq techs) */}
        {isNonEmpty(def.order) ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, lineHeight: 1.3 }}
          >
            <Box component="span" sx={{ fontWeight: 700 }}>
              Order:
            </Box>{' '}
            {def.order}
          </Typography>
        ) : null}

        {/* Unlocks */}
        {isNonEmpty(def.buildings) || isNonEmpty(def.units) ? (
          <Stack spacing={0.125}>
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
              Unlocks
            </Typography>
            {isNonEmpty(def.buildings) ? (
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  Buildings:
                </Box>{' '}
                {def.buildings}
              </Typography>
            ) : null}
            {isNonEmpty(def.units) ? (
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  Units:
                </Box>{' '}
                {def.units}
              </Typography>
            ) : null}
          </Stack>
        ) : null}

        {/* Highlighted "for you" event line, when the holder role is known */}
        {myColor && isNonEmpty(myEventText) ? (
          <Box
            sx={{
              borderLeft: '3px solid',
              borderColor: (t) => t.palette.eventColor[myColor].main,
              pl: 0.75,
              py: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: (t) => t.palette.eventColor[myColor].main,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.65rem',
              }}
            >
              For you ({COLOR_LABEL[myColor]})
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', lineHeight: 1.3, color: (t) => t.palette.card.text }}
            >
              {myEventText}
            </Typography>
          </Box>
        ) : null}

        {/* Other color lines — context only, muted. */}
        {otherColorLines.length > 0 ? (
          <Stack spacing={0.125}>
            {otherColorLines.map((entry) => (
              <Typography
                key={entry.color}
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  lineHeight: 1.3,
                  fontSize: '0.65rem',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontWeight: 700,
                    color: (t) => t.palette.eventColor[entry.color].main,
                  }}
                >
                  {entry.label}:
                </Box>{' '}
                {entry.text}
              </Typography>
            ))}
          </Stack>
        ) : null}

        {/* Effect badges — only when the typed 08.6 fields are populated. */}
        {effectBadges.length > 0 ? (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            {effectBadges.map((b) => (
              <Chip
                key={b.label}
                label={b.label}
                size="small"
                title={b.title}
                sx={{ height: '1.25rem', fontSize: '0.65rem', fontWeight: 700 }}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default TechCard;
