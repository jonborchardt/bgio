// PlayableHand — horizontal row of tech cards a role currently holds, each
// with a "Pay & play" affordance. Used by the four role panels (Chief,
// Science, Domestic, Foreign) to surface the tech-cards-in-hand list the
// engine already populates via `scienceComplete` and (later) other
// card-spawning effects.
//
// The four `<role>PlayTech` moves all funnel through `playTechStub`, which
// charges `def.costBag` and dispatches `onPlayEffects`. This component is
// the UI seam: it asks "can the seat afford this cost?" and "is the seat
// currently allowed to act?" and disables the button accordingly. The
// engine re-checks (via INVALID_MOVE) so the UI guard is presentational.
//
// Cards with no `onPlayEffects` are still shown (the player should see
// their passives) but the play button is disabled with an explanatory
// tooltip.

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { TechnologyDef } from '../../data/schema.ts';
import type { Role } from '../../game/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { TechCard } from './TechCard.tsx';
import { idForTech } from '../../cards/registry.ts';

export interface PlayableHandProps {
  techs: ReadonlyArray<TechnologyDef>;
  /** The role this hand belongs to — colors the header and drives the
   *  per-color event line highlight on each TechCard. */
  holderRole: Role;
  /** Funds the cost is paid from. For non-chief roles this is the seat's
   *  `mats[seat].stash`; for the chief it is `G.bank`. */
  funds: ResourceBag | undefined;
  /** True when it is the holder's turn to act (e.g., they are in their
   *  per-role stage). When false, every Play button is disabled. */
  canAct: boolean;
  /** Dispatched with the tech's `name` (the canonical id `playTechStub`
   *  matches against). */
  onPlay: (cardName: string) => void;
  /** Optional empty-state message. */
  emptyHint?: string;
  /** Header label. Defaults to "Technologies in hand". */
  title?: string;
}

const costEntries = (
  bag: Partial<ResourceBag> | undefined,
): Array<{ resource: Resource; amount: number }> => {
  if (bag === undefined) return [];
  const out: Array<{ resource: Resource; amount: number }> = [];
  for (const r of RESOURCES) {
    const v = bag[r] ?? 0;
    if (v > 0) out.push({ resource: r, amount: v });
  }
  return out;
};

const formatCost = (
  entries: ReadonlyArray<{ resource: Resource; amount: number }>,
): string =>
  entries.length === 0
    ? 'free'
    : entries.map((e) => `${e.amount} ${e.resource}`).join(', ');

export function PlayableHand({
  techs,
  holderRole,
  funds,
  canAct,
  onPlay,
  emptyHint,
  title = 'Technologies in hand',
}: PlayableHandProps) {
  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.role[holderRole].main,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
        }}
      >
        {title}
      </Typography>
      {techs.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
        >
          {emptyHint ?? 'No technologies yet.'}
        </Typography>
      ) : (
        <Stack
          direction="row"
          spacing={1.25}
          aria-label={`${holderRole} tech hand`}
          sx={{ flexWrap: 'wrap', rowGap: 1.25, alignItems: 'stretch' }}
        >
          {techs.map((tech) => {
            const cardId = idForTech(tech);
            const cost = tech.costBag;
            const entries = costEntries(cost);
            const affordable =
              entries.length === 0
                ? true
                : funds !== undefined && canAfford(funds, cost ?? {});
            const enabled = canAct && affordable;

            const tooltipParts: string[] = [];
            if (!affordable) tooltipParts.push(`Need ${formatCost(entries)}`);
            if (!canAct) tooltipParts.push('Not your turn.');
            const tooltip = tooltipParts.join(' — ');

            return (
              <Box
                key={cardId}
                sx={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0.5,
                }}
              >
                <TechCard def={tech} holderRole={holderRole} size="small" />
                <Tooltip
                  title={tooltip}
                  placement="bottom"
                  disableHoverListener={tooltip === ''}
                >
                  <Box>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!enabled}
                      onClick={() => onPlay(tech.name)}
                      aria-label={`Play ${tech.name}`}
                      sx={{
                        width: '100%',
                        bgcolor: (t) => t.palette.role[holderRole].main,
                        color: (t) => t.palette.role[holderRole].contrastText,
                        '&:hover': {
                          bgcolor: (t) => t.palette.role[holderRole].dark,
                        },
                      }}
                    >
                      Play
                    </Button>
                  </Box>
                </Tooltip>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default PlayableHand;
