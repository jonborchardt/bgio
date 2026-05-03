// ScienceCard — single-card view for the SciencePanel grid.
//
// Card shape (header / body / footer):
//   - Header: color + level chip, with the "reward → recipient role" hint
//     painted opposite. The reward is the always-visible "pro" the seat is
//     paying for; the role mapping is fixed (red→Foreign, gold→Chief,
//     green→Domestic, blue→Science).
//   - Body: per-resource cost vs. paid lines (the "con") with a +1 button on
//     each, gated on `canAct && isLowest`.
//   - Footer: "Complete" button gated on `canComplete && isLowest`.
//   - Hover (tooltip on the header): the names of the tech cards that will
//     be handed to the recipient role on completion. Pulled from
//     `underTechs` so we don't need to thread the whole science slice in.
//
// When the card is NOT the lowest unfinished card in its color column we
// dim it visually and disable every interaction (the contribute / complete
// moves enforce the lowest-first rule too — this is just a UX hint).

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { ScienceCardDef, ScienceColor } from '../../data/scienceCards.ts';
import type { TechnologyDef } from '../../data/schema.ts';
import { RESOURCES, RESOURCE_DISPLAY } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { CardInfoButton } from '../cards/CardInfoButton.tsx';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { ResourceText } from '../resources/ResourceText.tsx';
import { idForScience } from '../../cards/registry.ts';

export interface ScienceCardProps {
  card: ScienceCardDef;
  paid: ResourceBag;
  stash: ResourceBag;
  canAct: boolean;
  canComplete: boolean;
  /** Optional human-readable reason the Complete button is disabled.
   *  Surfaced as a tooltip on the button. The most common case is the
   *  one-completion-per-round cap, which is otherwise indistinguishable
   *  from "not yet paid" without context. */
  completionDisabledReason?: string;
  isLowest: boolean;
  // Tech cards that will be distributed on completion. Empty array when the
  // science slice has no entry for this card (legacy fixtures); the panel
  // should pass `science.underCards[card.id] ?? []`.
  underTechs: TechnologyDef[];
  onContribute: (resource: Resource, amount: number) => void;
  onComplete: () => void;
}

// Stable, deterministic order over the cost entries actually present on the
// card. Mirrors the canonical RESOURCES ordering so the +1 buttons appear in
// the same order regardless of JSON key order.
const costResources = (cost: Partial<ResourceBag>): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    if ((cost[r] ?? 0) > 0) out.push(r);
  }
  return out;
};

// Render a tech card's populated detail fields as a labeled list. Skips
// empty strings so the tooltip doesn't fill with blank rows when the
// content team hasn't authored a particular field yet (most techs in
// technologies.json today only carry `branch` + `name`).
const techDetailEntries = (
  tech: TechnologyDef,
): Array<{ label: string; value: string }> => {
  const costFields: Array<{ label: string; key: keyof TechnologyDef }> = [
    { label: 'Cost', key: 'cost' },
  ];
  const givesFields: Array<{ label: string; key: keyof TechnologyDef }> = [
    { label: 'Buildings', key: 'buildings' },
    { label: 'Units', key: 'units' },
    { label: 'Blue gets', key: 'blueEvent' },
    { label: 'Green gets', key: 'greenEvent' },
    { label: 'Red gets', key: 'redEvent' },
    { label: 'Gold gets', key: 'goldEvent' },
  ];
  const out: Array<{ label: string; value: string }> = [];
  const pushIfPresent = (
    fields: Array<{ label: string; key: keyof TechnologyDef }>,
  ) => {
    for (const f of fields) {
      const v = tech[f.key];
      if (typeof v === 'string' && v.trim().length > 0) {
        out.push({ label: f.label, value: v });
      }
    }
  };
  pushIfPresent(costFields);
  const givesStart = out.length;
  pushIfPresent(givesFields);
  if (out.length > givesStart) {
    out.splice(givesStart, 0, { label: 'Gives', value: '' });
  }
  return out;
};

// Fixed color → recipient-role mapping. Mirrors the switch in scienceComplete.
const RECIPIENT_BY_COLOR: Record<ScienceColor, { role: string; branch: string }> = {
  red: { role: 'Foreign', branch: 'Fighting' },
  gold: { role: 'Chief', branch: 'Exploration' },
  green: { role: 'Domestic', branch: 'Civic' },
  blue: { role: 'Science', branch: 'Education' },
};

export function ScienceCard({
  card,
  paid,
  stash,
  canAct,
  canComplete,
  completionDisabledReason,
  isLowest,
  underTechs,
  onContribute,
  onComplete,
}: ScienceCardProps) {
  const resources = costResources(card.cost);
  const dimmed = !isLowest;
  const recipient = RECIPIENT_BY_COLOR[card.color];

  const headerTooltip = `On complete, the ${recipient.role} player gains ${underTechs.length} ${recipient.branch} tech card${underTechs.length === 1 ? '' : 's'}.`;

  return (
    <Box
      aria-label={`Science card ${card.id}`}
      sx={{
        position: 'relative',
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: (t) =>
          dimmed
            ? t.palette.status.muted
            : t.palette.eventColor[card.color].dark,
        bgcolor: (t) =>
          dimmed ? t.palette.card.takenSurface : t.palette.card.surface,
        opacity: dimmed ? 0.55 : 1,
        filter: dimmed ? 'grayscale(0.6)' : 'none',
        boxShadow: dimmed ? 'none' : '0 1px 3px rgba(0,0,0,0.35)',
        minWidth: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 120ms, border-color 120ms',
      }}
    >
      <CardInfoButton
        cardId={idForScience(card)}
        size="normal"
        highlightSubId={card.id}
      />
      <Tooltip title={headerTooltip} placement="top">
        <Box
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: (t) =>
              dimmed
                ? 'transparent'
                : t.palette.eventColor[card.color].dark,
            color: (t) =>
              dimmed
                ? t.palette.card.takenText
                : t.palette.eventColor[card.color].contrastText,
            borderBottom: '1px solid',
            borderColor: (t) =>
              dimmed
                ? t.palette.status.muted
                : t.palette.eventColor[card.color].light,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'capitalize',
              letterSpacing: 0.2,
            }}
          >
            {card.color} L{card.level}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, whiteSpace: 'nowrap', opacity: 0.95 }}
          >
            → {recipient.role}
          </Typography>
        </Box>
      </Tooltip>

      <Stack spacing={0.5} sx={{ px: 1, py: 0.75, flex: 1 }}>
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
          Reward
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.card.text,
            lineHeight: 1.3,
            opacity: 0.95,
          }}
        >
          {recipient.role} player gains {underTechs.length} {recipient.branch} tech
          card{underTechs.length === 1 ? '' : 's'}:
        </Typography>
        {underTechs.length > 0 ? (
          <Stack component="ul" sx={{ m: 0, pl: 2, gap: 0.125 }}>
            {underTechs.map((tech, i) => {
              const name = tech.name || `Tech ${i + 1}`;
              const details = techDetailEntries(tech);
              const tooltip = (
                <Box sx={{ maxWidth: '18rem' }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}
                  >
                    {name}
                    {tech.branch ? ` — ${tech.branch}` : ''}
                  </Typography>
                  {details.length === 0 ? (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', opacity: 0.8 }}
                    >
                      No additional details on this card.
                    </Typography>
                  ) : (
                    details.map((d) => (
                      <Box
                        key={d.label}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 0.4,
                          rowGap: 0.2,
                          lineHeight: 1.3,
                          fontSize: '0.75rem',
                        }}
                      >
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {d.label}:
                        </Box>
                        {d.value ? (
                          <ResourceText text={d.value} size="small" />
                        ) : null}
                      </Box>
                    ))
                  )}
                </Box>
              );
              return (
                <Tooltip
                  key={`${name}-${i}`}
                  title={tooltip}
                  placement="right"
                  arrow
                >
                  <Typography
                    component="li"
                    variant="caption"
                    sx={{
                      color: (t) => t.palette.card.text,
                      lineHeight: 1.25,
                      opacity: 0.85,
                      cursor: 'help',
                      textDecoration: 'underline dotted',
                      textDecorationColor: (t) => t.palette.status.muted,
                      textUnderlineOffset: '2px',
                      width: 'fit-content',
                    }}
                  >
                    {name}
                  </Typography>
                </Tooltip>
              );
            })}
          </Stack>
        ) : null}

        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            color: (t) => t.palette.status.muted,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            fontSize: '0.65rem',
          }}
        >
          Cost
        </Typography>

        {resources.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Free
          </Typography>
        ) : (
          resources.map((resource) => {
            const need = card.cost[resource] ?? 0;
            const have = paid[resource] ?? 0;
            const fulfilled = have >= need;
            const displayName = RESOURCE_DISPLAY[resource].name;
            return (
              <Stack
                key={resource}
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center', minWidth: 0 }}
              >
                <ResourceToken
                  resource={resource}
                  count={need}
                  size="normal"
                />
                <Tooltip title={`${displayName}: ${have}/${need}`} placement="top">
                  <Typography
                    variant="caption"
                    sx={{
                      color: (t) =>
                        fulfilled
                          ? t.palette.status.muted
                          : t.palette.resource[resource].main,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textDecoration: fulfilled ? 'line-through' : 'none',
                    }}
                  >
                    {have}/{need}
                  </Typography>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={
                    !canAct ||
                    !isLowest ||
                    have >= need ||
                    (stash[resource] ?? 0) < 1
                  }
                  onClick={() => onContribute(resource, 1)}
                  aria-label={`Contribute +1 ${displayName} to ${card.id}`}
                  sx={{ flexShrink: 0, minWidth: '2rem', px: 0.5 }}
                >
                  +1
                </Button>
              </Stack>
            );
          })
        )}
      </Stack>

      <Box sx={{ px: 1, pb: 1 }}>
        <Tooltip
          title={completionDisabledReason ?? ''}
          placement="top"
          disableHoverListener={
            !completionDisabledReason || canComplete
          }
        >
          {/* Wrap the disabled Button in a span so the Tooltip still
              receives pointer events — disabled buttons swallow them. */}
          <Box component="span" sx={{ display: 'block' }}>
            <Button
              fullWidth
              size="small"
              variant="contained"
              disabled={!canComplete || !isLowest}
              onClick={onComplete}
              aria-label={`Complete science card ${card.id}`}
              sx={{
                bgcolor: (t) => t.palette.eventColor[card.color].main,
                color: (t) => t.palette.eventColor[card.color].contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.eventColor[card.color].dark,
                },
              }}
            >
              Complete
            </Button>
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default ScienceCard;
