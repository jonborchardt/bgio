// TechCard — presentational view of a TechnologyDef. Five canonical
// sizes (see `sizes.ts`). The micro / small sizes show name + branch +
// cost only; normal mirrors the prior in-game look; detailed / page
// surface the unlocks, all four event lines, and effect badges.

import { Box, Chip, Stack, Typography } from '@mui/material';
import type { TechnologyDef } from '../../data/schema.ts';
import type { Role } from '../../game/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { CardFrame } from './CardFrame.tsx';
import { ResourceChip } from '../resources/ResourceChip.tsx';
import type { CardSize } from './sizes.ts';
import { idForTech } from '../../cards/registry.ts';

export interface TechCardProps {
  def: TechnologyDef;
  /** The role currently holding this tech in hand. Drives which color
   *  event line is highlighted. */
  holderRole?: Role;
  size?: CardSize;
  cardId?: string;
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

export function TechCard({
  def,
  holderRole,
  size = 'normal',
  cardId,
}: TechCardProps) {
  const id = cardId === undefined ? idForTech(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
            🔬 {def.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            {def.branch}
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  if (size === 'small') {
    const smallCostBag = def.costBag ? costResources(def.costBag) : [];
    // Cards like Compass have no building/unit grants — their entire
    // value is the per-color event reactions. Surface those reactions
    // on the small card so the player can see what the card is FOR
    // without flipping to the full view.
    const hasGrants = isNonEmpty(def.buildings) || isNonEmpty(def.units);
    const eventLines: Array<{ color: EventColor; text: string }> = ALL_COLORS
      .map((c) => {
        const v = def[COLOR_FIELD[c]];
        return typeof v === 'string' && v.trim().length > 0
          ? { color: c, text: v }
          : null;
      })
      .filter(
        (e): e is { color: EventColor; text: string } => e !== null,
      );
    return (
      <CardFrame size="small" cardId={id}>
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {def.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            {def.branch}
          </Typography>
          {smallCostBag.length > 0 ? (
            <Stack direction="row" spacing={0.25} sx={{ flexWrap: 'wrap', rowGap: 0.25 }}>
              {smallCostBag.map((resource) => {
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
          ) : isNonEmpty(def.cost) ? (
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted, fontSize: '0.6rem' }}
            >
              {def.cost}
            </Typography>
          ) : null}
          {isNonEmpty(def.buildings) ? (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1.2 }}>
              <Box
                component="span"
                sx={{ fontWeight: 700, color: (t) => t.palette.role.domestic.main }}
              >
                Domestic gets:
              </Box>{' '}
              {def.buildings}
            </Typography>
          ) : null}
          {isNonEmpty(def.units) ? (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1.2 }}>
              <Box
                component="span"
                sx={{ fontWeight: 700, color: (t) => t.palette.role.foreign.main }}
              >
                Foreign gets:
              </Box>{' '}
              {def.units}
            </Typography>
          ) : null}
          {!hasGrants && eventLines.length > 0 ? (
            <Stack spacing={0.125}>
              {eventLines.map((entry) => (
                <Typography
                  key={entry.color}
                  variant="caption"
                  sx={{ fontSize: '0.6rem', lineHeight: 1.2 }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 700,
                      color: (t) => t.palette.eventColor[entry.color].main,
                    }}
                  >
                    {entry.color[0]!.toUpperCase() + entry.color.slice(1)}:
                  </Box>{' '}
                  {entry.text}
                </Typography>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </CardFrame>
    );
  }

  // normal / detailed / page
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
    .filter(
      (entry): entry is { color: EventColor; label: string; text: string } =>
        entry !== null,
    );
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
    <CardFrame size={size} cardId={id}>
      <Stack spacing={0.75}>
        <Stack spacing={0.25}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {def.name}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
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
            {/* Surface human-readable `cost` text only when the structured
                `costBag` chips below are absent — otherwise we'd render the
                same cost twice. */}
            {costBagResources.length === 0 && isNonEmpty(def.cost) ? (
              <Typography
                variant="caption"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                · Cost: {def.cost}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

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
              On play, grants
            </Typography>
            {isNonEmpty(def.buildings) ? (
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>
                <Box
                  component="span"
                  sx={{ fontWeight: 700, color: (t) => t.palette.role.domestic.main }}
                >
                  Domestic gets:
                </Box>{' '}
                {def.buildings}
              </Typography>
            ) : null}
            {isNonEmpty(def.units) ? (
              <Typography variant="caption" sx={{ lineHeight: 1.3 }}>
                <Box
                  component="span"
                  sx={{ fontWeight: 700, color: (t) => t.palette.role.foreign.main }}
                >
                  Foreign gets:
                </Box>{' '}
                {def.units}
              </Typography>
            ) : null}
          </Stack>
        ) : null}

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
