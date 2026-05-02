// Presentational science card — renders the *canonical* science card
// (one per `color × tier × level` cell), with its cost variants surfaced
// inside the body. Five canonical sizes per `sizes.ts`.
//
// IMPORTANT: this is the GENERIC presentational science card used by the
// relationships modal, list panels, and React Flow nodes. The Science
// role's panel-specific card (with +1 contribute buttons and a Complete
// button) lives at `src/ui/science/ScienceCard.tsx` — that one still
// renders an in-game variant with its specific cost. Don't conflate.

import { Box, Stack, Typography } from '@mui/material';
import type {
  CanonicalScienceCardDef,
  ScienceColor,
} from '../../data/scienceCards.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { CardFrame } from './CardFrame.tsx';
import { ResourceChip } from '../resources/ResourceChip.tsx';
import type { CardSize } from './sizes.ts';
import { idForScience } from '../../cards/registry.ts';
import { useCardInfo } from './cardInfoContextValue.ts';

// Mirrors the static mapping in src/game/roles/science/setup.ts and the
// in-game ScienceCard's RECIPIENT_BY_COLOR. Centralising here would be
// nice but requires shuffling imports across the game/UI boundary —
// kept duplicated for now (4 lines, very stable).
const RECIPIENT_BY_COLOR: Record<
  ScienceColor,
  { role: string; branch: string }
> = {
  red: { role: 'Foreign', branch: 'Fighting' },
  gold: { role: 'Chief', branch: 'Exploration' },
  green: { role: 'Domestic', branch: 'Civic' },
  blue: { role: 'Science', branch: 'Education' },
};

export interface ScienceCardProps {
  def: CanonicalScienceCardDef;
  size?: CardSize;
  cardId?: string;
}

const costResources = (cost: Partial<ResourceBag>): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    if ((cost[r] ?? 0) > 0) out.push(r);
  }
  return out;
};

// Compact "3w 2s 1g" — one short string per variant cost so several
// variants can sit side-by-side on a small card.
const compactCost = (cost: Partial<ResourceBag>): string => {
  const rs = costResources(cost);
  if (rs.length === 0) return 'free';
  return rs.map((r) => `${cost[r]}${r.charAt(0)}`).join(' ');
};

export function ScienceCard({
  def,
  size = 'normal',
  cardId,
}: ScienceCardProps) {
  const id = cardId === undefined ? idForScience(def) : cardId || undefined;
  const variantCount = def.variants.length;
  // Highlight the variant the user came from (if they opened this card
  // by clicking `?` on an in-game variant). Only meaningful at sizes
  // that render the variant list — drawer / page views.
  const ctx = useCardInfo();
  const highlightVariantId =
    ctx && ctx.focusId === id ? ctx.highlightSubId : null;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id} tier={def.tier} color={def.color}>
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.eventColor[def.color].main,
            fontWeight: 700,
            textTransform: 'capitalize',
            fontSize: '0.65rem',
          }}
        >
          {def.color} L{def.level} ({def.tier.slice(0, 3)})
        </Typography>
      </CardFrame>
    );
  }

  if (size === 'small') {
    const r = RECIPIENT_BY_COLOR[def.color];
    return (
      <CardFrame size="small" cardId={id} tier={def.tier} color={def.color}>
        <Stack spacing={0.25}>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.eventColor[def.color].main,
              fontWeight: 700,
              textTransform: 'capitalize',
              fontSize: '0.7rem',
            }}
          >
            {def.color} L{def.level}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontSize: '0.6rem',
              textTransform: 'capitalize',
            }}
          >
            {def.tier}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.card.text, fontSize: '0.6rem' }}
          >
            → {r.role}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontSize: '0.6rem',
            }}
          >
            {variantCount} variant{variantCount === 1 ? '' : 's'}
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  const recipient = RECIPIENT_BY_COLOR[def.color];

  return (
    <CardFrame size={size} cardId={id} tier={def.tier} color={def.color}>
      <Stack spacing={0.5}>
        <Typography
          variant="body2"
          sx={{
            color: (t) => t.palette.eventColor[def.color].main,
            fontWeight: 700,
            textTransform: 'capitalize',
          }}
        >
          {def.color} L{def.level} {def.tier}
        </Typography>

        {/* Recipient + branch — matches what the in-game card shows in
            its header, so the user can match a graph card to the cell
            they were just looking at. */}
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontSize: '0.6rem',
              fontWeight: 700,
            }}
          >
            Reward
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.card.text, lineHeight: 1.3 }}
          >
            → {recipient.role} ({recipient.branch})
          </Typography>
        </Stack>

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
          Cost variants ({variantCount})
        </Typography>

        {(size === 'detailed' || size === 'page') ? (
          <Stack spacing={0.5}>
            {def.variants.map((variant) => {
              const resources = costResources(variant.cost);
              const isActive = highlightVariantId === variant.id;
              return (
                <Stack
                  key={variant.id}
                  direction="row"
                  spacing={0.5}
                  sx={{
                    flexWrap: 'wrap',
                    rowGap: 0.5,
                    alignItems: 'center',
                    px: isActive ? 0.75 : 0,
                    py: isActive ? 0.5 : 0,
                    borderRadius: 1,
                    border: isActive ? '1px solid' : 'none',
                    borderColor: (t) => t.palette.status.active,
                    bgcolor: (t) =>
                      isActive
                        ? `${t.palette.status.active}1a`
                        : 'transparent',
                  }}
                >
                  {isActive ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: (t) => t.palette.status.active,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        fontSize: '0.6rem',
                        mr: 0.5,
                      }}
                    >
                      In your match
                    </Typography>
                  ) : null}
                  {resources.length === 0 ? (
                    <Typography
                      variant="caption"
                      sx={{ color: (t) => t.palette.status.muted }}
                    >
                      Free
                    </Typography>
                  ) : (
                    resources.map((r) => (
                      <ResourceChip
                        key={r}
                        resource={r}
                        count={variant.cost[r] ?? 0}
                        size="sm"
                        label={`${variant.cost[r]} ${r}`}
                      />
                    ))
                  )}
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <Stack spacing={0.125}>
            {def.variants.map((variant) => {
              const isActive = highlightVariantId === variant.id;
              return (
                <Typography
                  key={variant.id}
                  variant="caption"
                  sx={{
                    color: (t) =>
                      isActive ? t.palette.status.active : t.palette.card.text,
                    fontSize: '0.7rem',
                    lineHeight: 1.3,
                    fontWeight: isActive ? 700 : undefined,
                  }}
                >
                  · {compactCost(variant.cost)}
                  {isActive ? '  ← in your match' : ''}
                </Typography>
              );
            })}
          </Stack>
        )}

        {size === 'page' ? (
          <Box sx={{ pt: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontStyle: 'italic',
                lineHeight: 1.35,
              }}
            >
              Each match places one variant in this cell. The cost differs but
              the rewards are identical — 4 random techs from the matching
              branch ({def.color} → branch).
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default ScienceCard;
