// Science Library SL 5.1 — single-slot tile for the LibraryRow.
//
// Renders one of the 6 face-up market slots. An empty slot is a faint
// dashed outline so the table reads "this slot will fill at end of
// turn." A filled slot shows:
//   - tier badge (T1 / T2 / T3)
//   - color band along the top, painted from the recipient role's
//     accent (gold→chief, blue→science, green→domestic, red→defense)
//   - card name
//   - the card's printed deploy cost (the recipient pays this later;
//     untouched by the library plan)
//   - the science seat's *effective* research cost (post-discount)
//     when the viewer is the science seat — otherwise the base cost
//   - per-slot Buy / Burn buttons gated by `canAct` + affordability
//
// Buy is disabled with a reason tooltip when stash falls short of the
// effective cost; Burn is enabled whenever `canAct` (free in
// resources, expensive in opportunity cost — that's the point).
//
// The `compact` prop opts into a smaller, read-only variant used by
// preview surfaces (e.g. LostIdeasPile): it keeps the color band, tier
// badge, and card name but drops the cost rows and the action footer.
//
// The component is presentational. It does not read `G` directly; the
// parent `LibraryRow` resolves the viewer's discount tableau and
// stash, then hands the values down so a future bgio playerView change
// only touches the row, not the tile.

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { LibraryCard } from '../../game/library/types.ts';
import type { LibraryColor } from '../../data/schema.ts';
import type { Role } from '../../game/types.ts';
import type {
  Resource,
  ResourceBag,
} from '../../game/resources/types.ts';
import {
  EMPTY_BAG,
  RESOURCES,
  RESOURCE_DISPLAY,
} from '../../game/resources/types.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';

// LibraryColor → Role mapping is fixed by the master plan: each color's
// recipient role drives the visual accent so a glance at the row tells
// the table who'll get the card on a buy.
const RECIPIENT_ROLE: Record<LibraryColor, Role> = {
  gold: 'chief',
  blue: 'science',
  green: 'domestic',
  red: 'defense',
};

// Stable, deterministic order over the resources actually present in a
// bag. Mirrors the canonical RESOURCES order so the cost row reads in
// the same sequence everywhere.
const presentResources = (bag: ResourceBag): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    if ((bag[r] ?? 0) > 0) out.push(r);
  }
  return out;
};

// Shortfall scan: returns the first resource the stash can't cover, or
// null when the stash covers the bag. Used to build a human-readable
// "why is buy disabled" tooltip.
const firstShortfall = (
  cost: ResourceBag,
  stash: ResourceBag,
): { resource: Resource; need: number; have: number } | null => {
  for (const r of RESOURCES) {
    const need = cost[r] ?? 0;
    if (need <= 0) continue;
    const have = stash[r] ?? 0;
    if (have < need) return { resource: r, need, have };
  }
  return null;
};

export interface LibraryCardTileProps {
  /** The slot's card, or `null` for an empty slot. */
  card: LibraryCard | null;
  /** Slot index (0..5). Surfaced in aria-label and forwarded to the
   *  Buy / Burn handlers. */
  slotIndex: number;
  /** Effective research cost (post-discount) for the viewer's tableau.
   *  When the viewer is *not* the science seat this is the base cost
   *  (no tableau, no discount). Ignored when `card === null`. */
  effectiveCost: ResourceBag;
  /** Viewer's stash. Used to gate the Buy button + build the
   *  shortfall tooltip. Empty bag when there's no viewer (spectator). */
  viewerStash: ResourceBag;
  /** True when the viewer is the science seat AND in scienceTurn AND
   *  has not yet ended their turn. False on every other seat / phase
   *  (including the science seat's own pre-/post-turn windows). */
  canAct: boolean;
  /** True when the viewer occupies the science seat. Buy / Burn
   *  controls are hidden for non-science viewers — the row stays
   *  visible to the table, but only science can act on it. */
  viewerIsScience: boolean;
  onBuy: (slotIndex: number) => void;
  onBurn: (slotIndex: number) => void;
  /** Smaller, read-only variant for pile / preview surfaces. Drops the
   *  Research / Deploy cost rows and the action footer; the buy / burn
   *  callbacks are never invoked. Default `false`. */
  compact?: boolean;
}

export function LibraryCardTile({
  card,
  slotIndex,
  effectiveCost,
  viewerStash,
  canAct,
  viewerIsScience,
  onBuy,
  onBurn,
  compact = false,
}: LibraryCardTileProps) {
  if (card === null) {
    return (
      <Box
        data-library-slot={slotIndex}
        data-library-slot-state="empty"
        aria-label={`Library slot ${slotIndex + 1}: empty`}
        sx={{
          width: 132,
          minHeight: 200,
          borderRadius: 1.5,
          border: '1px dashed',
          borderColor: (t) => t.palette.status.muted,
          bgcolor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.status.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Empty
        </Typography>
      </Box>
    );
  }

  const recipientRole = RECIPIENT_ROLE[card.scienceColor];
  const cardName = card.def.name;
  const tierLabel = `T${card.tier}`;
  const costEntries = presentResources(effectiveCost);

  const shortfall = firstShortfall(effectiveCost, viewerStash);
  const buyDisabled = !canAct || shortfall !== null;
  const burnDisabled = !canAct;

  // Buy tooltip text is the canonical disable reason — surfaced even
  // when the seat *can* act so the player gets a quick affordability
  // read without clicking. Empty when there's nothing useful to say.
  let buyTooltip = '';
  if (!canAct) {
    buyTooltip = viewerIsScience
      ? "Not your turn to act"
      : 'Only the science seat can buy from the Library';
  } else if (shortfall !== null) {
    const display = RESOURCE_DISPLAY[shortfall.resource];
    buyTooltip = `Need ${shortfall.need} ${display.name}, have ${shortfall.have}`;
  }

  // Render printed deploy cost only when the recipient pays from a
  // resource bag (buildings + units carry `costBag`). Tech / event
  // recipients use a different play-pipeline that doesn't render a
  // bag-shaped cost.
  let deployBag: ResourceBag | null = null;
  if (card.kind === 'building' || card.kind === 'unit') {
    if (card.def.costBag !== undefined) {
      const filled: ResourceBag = { ...EMPTY_BAG };
      for (const r of RESOURCES) {
        filled[r] = card.def.costBag[r] ?? 0;
      }
      deployBag = filled;
    } else if (card.def.cost > 0) {
      deployBag = { ...EMPTY_BAG, gold: card.def.cost };
    }
  }
  const deployEntries = deployBag === null ? [] : presentResources(deployBag);

  return (
    <Box
      data-library-slot={slotIndex}
      data-library-slot-state="filled"
      data-library-card-color={card.scienceColor}
      data-library-card-tier={card.tier}
      data-library-tile-compact={compact ? 'true' : 'false'}
      aria-label={`Library slot ${slotIndex + 1}: ${cardName} (${card.scienceColor} ${tierLabel})`}
      sx={{
        position: 'relative',
        width: compact ? 116 : 132,
        minHeight: compact ? 0 : 200,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: (t) => t.palette.role[recipientRole].dark,
        bgcolor: (t) => t.palette.card.surface,
        color: (t) => t.palette.card.text,
        boxShadow: (t) => t.palette.shadow.card,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        sx={{
          height: '0.3rem',
          bgcolor: (t) => t.palette.role[recipientRole].main,
        }}
      />

      <Stack spacing={0.5} sx={{ px: 0.75, py: 0.75, flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Box
            data-library-tier-badge="true"
            sx={{
              px: 0.5,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: (t) => t.palette.role[recipientRole].dark,
              color: (t) => t.palette.role[recipientRole].contrastText,
              fontWeight: 800,
              fontSize: '0.7rem',
              lineHeight: 1,
              letterSpacing: 0.4,
            }}
          >
            {tierLabel}
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'capitalize',
              color: (t) => t.palette.role[recipientRole].light,
              fontSize: '0.65rem',
            }}
          >
            {card.scienceColor}
          </Typography>
        </Stack>

        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: (t) => t.palette.card.text,
            lineHeight: 1.2,
            // Two-line clamp keeps tile heights uniform across long
            // and short card names.
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {cardName}
        </Typography>

        {compact ? null : (
          <>
            <Typography
              variant="caption"
              sx={{
                mt: 0.25,
                color: (t) => t.palette.status.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.6rem',
                fontWeight: 600,
              }}
            >
              Research
            </Typography>
            <Stack direction="row" spacing={0.25} sx={{ flexWrap: 'wrap' }}>
              {costEntries.length === 0 ? (
                <Typography
                  variant="caption"
                  sx={{ color: (t) => t.palette.status.muted }}
                >
                  Free
                </Typography>
              ) : (
                costEntries.map((r) => (
                  <ResourceToken
                    key={r}
                    resource={r}
                    count={effectiveCost[r]}
                    size="small"
                  />
                ))
              )}
            </Stack>
          </>
        )}

        {!compact && deployBag !== null ? (
          <>
            <Typography
              variant="caption"
              sx={{
                mt: 0.25,
                color: (t) => t.palette.status.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.6rem',
                fontWeight: 600,
              }}
            >
              Deploy
            </Typography>
            <Stack direction="row" spacing={0.25} sx={{ flexWrap: 'wrap' }}>
              {deployEntries.length === 0 ? (
                <Typography
                  variant="caption"
                  sx={{ color: (t) => t.palette.status.muted }}
                >
                  Free
                </Typography>
              ) : (
                deployEntries.map((r) => (
                  <ResourceToken
                    key={r}
                    resource={r}
                    count={deployBag![r]}
                    size="small"
                  />
                ))
              )}
            </Stack>
          </>
        ) : null}
      </Stack>

      {!compact && viewerIsScience ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            px: 0.5,
            pb: 0.5,
            pt: 0.25,
            alignItems: 'stretch',
          }}
        >
          <Tooltip
            title={buyTooltip}
            placement="top"
            disableHoverListener={buyTooltip.length === 0}
          >
            {/* Wrap the disabled Button so the Tooltip still receives
                pointer events — disabled buttons swallow them. */}
            <Box component="span" sx={{ display: 'flex', flex: 1 }}>
              <Button
                fullWidth
                size="small"
                variant="contained"
                disabled={buyDisabled}
                onClick={() => onBuy(slotIndex)}
                aria-label={`Buy ${cardName} from library slot ${slotIndex + 1}`}
                data-library-buy-button="true"
                data-library-buy-disabled={buyDisabled ? 'true' : 'false'}
                sx={{
                  bgcolor: (t) => t.palette.role.science.main,
                  color: (t) => t.palette.role.science.contrastText,
                  minWidth: 0,
                  px: 0.5,
                  fontSize: '0.7rem',
                  '&:hover': {
                    bgcolor: (t) => t.palette.role.science.dark,
                  },
                }}
              >
                Buy
              </Button>
            </Box>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            disabled={burnDisabled}
            onClick={() => onBurn(slotIndex)}
            aria-label={`Burn ${cardName} from library slot ${slotIndex + 1}`}
            data-library-burn-button="true"
            data-library-burn-disabled={burnDisabled ? 'true' : 'false'}
            sx={{
              borderColor: (t) => t.palette.status.critical,
              color: (t) => t.palette.status.critical,
              minWidth: 0,
              px: 0.5,
              fontSize: '0.7rem',
              flex: 1,
              '&:hover': {
                borderColor: (t) => t.palette.status.critical,
                bgcolor: (t) => t.palette.role.defense.dark,
                color: (t) => t.palette.role.defense.contrastText,
              },
            }}
          >
            Burn
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}

export default LibraryCardTile;
