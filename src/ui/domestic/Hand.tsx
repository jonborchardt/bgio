// Domestic Hand — horizontal row of cards the Domestic seat can play.
// A single visual list mixing two card kinds:
//   • BuildingDef entries — buy via select-then-place flow on the grid.
//   • TechnologyDef entries — pay & play immediately (no placement).
// Both are rendered with their canonical card (BuildingCard / TechCard)
// inside the same row so the player sees one playable hand, not two.

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { BuildingDef, TechnologyDef } from '../../data/schema.ts';
import { buildingCost } from '../../data/index.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { BuildingCard } from '../cards/BuildingCard.tsx';
import { TechCard } from '../cards/TechCard.tsx';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';

export interface HandProps {
  hand: BuildingDef[];
  /** Tech cards in the same hand, played via `domesticPlayTech`. */
  techs?: TechnologyDef[];
  /** True when the seat can act (in `domesticTurn` and not yet done).
   *  Drives the Play-button disable state for techs. */
  canAct?: boolean;
  /** Dispatched when the player clicks Play on a tech entry. */
  onPlayTech?: (techName: string) => void;
  selectedName?: string;
  onSelect: (name: string) => void;
  // Full stash, used for the per-card affordability check on multi-
  // resource costs. Optional for back-compat; when omitted we fall back
  // to gold-only.
  stash?: ResourceBag;
  /** Optional message to render when the (already-filtered) hand is
   *  empty — e.g. "complete a science card to unlock buildings". */
  emptyHint?: string;
  /** Render a per-building help-request button next to the Place
   *  button. Returns null when the building is fully affordable. */
  renderBuildingHelp?: (def: BuildingDef) => ReactNode;
  /** Render a per-tech help-request button next to the Play button. */
  renderTechHelp?: (def: TechnologyDef) => ReactNode;
}

const costEntries = (
  bag: Partial<ResourceBag>,
): Array<{ resource: Resource; amount: number }> => {
  const out: Array<{ resource: Resource; amount: number }> = [];
  for (const r of RESOURCES) {
    const v = bag[r] ?? 0;
    if (v > 0) out.push({ resource: r, amount: v });
  }
  return out;
};

// Render a cost as inline icons for use inside a MUI Tooltip body. Falls
// back to "free" when nothing is owed so the tooltip still has useful
// content (and avoids a stray empty row).
const costIcons = (
  entries: ReadonlyArray<{ resource: Resource; amount: number }>,
): ReactNode =>
  entries.length === 0 ? (
    'free'
  ) : (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.4,
        verticalAlign: 'middle',
      }}
    >
      {entries.map((e) => (
        <ResourceToken
          key={e.resource}
          resource={e.resource}
          count={e.amount}
          size="small"
        />
      ))}
    </Box>
  );

export function Hand({
  hand,
  techs = [],
  canAct = false,
  onPlayTech,
  selectedName,
  onSelect,
  stash,
  emptyHint,
  renderBuildingHelp,
  renderTechHelp,
}: HandProps) {
  // Show every buildable in the hand. The previous AFFORD_SLACK filter
  // hid anything more than 20 gold above the seat's current balance,
  // which silently dropped pricier unlocks (Engineering College, etc.)
  // from view even though the player wanted to see what they were
  // saving up for. Affordability is still expressed per-card via the
  // disabled-button state + tooltip below.
  const visible = hand;
  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.role.domestic.main,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
        }}
      >
        Cards
      </Typography>
      {visible.length === 0 && techs.length === 0 && emptyHint ? (
        <EmbossedFrame
          role="domestic"
          sx={{
            alignSelf: 'stretch',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              py: 2,
            }}
          >
            {emptyHint}
          </Typography>
        </EmbossedFrame>
      ) : null}
      <Stack
        direction="row"
        spacing={1.25}
        aria-label="Domestic hand"
        sx={{ flexWrap: 'wrap', rowGap: 1.25, alignItems: 'stretch' }}
      >
        {visible.map((card) => {
          const isSelected = card.name === selectedName;
          const cost = buildingCost(card);
          const entries = costEntries(cost);
          const affordable = stash ? canAfford(stash, cost) : false;
          const enabled = affordable;
          const tooltipNodes: ReactNode[] = [];
          if (card.note) tooltipNodes.push(<span key="note">{card.note}</span>);
          if (!affordable) {
            tooltipNodes.push(
              <Box
                key="need"
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
              >
                Need {costIcons(entries)}
              </Box>,
            );
          }
          const tooltip: ReactNode =
            tooltipNodes.length === 0 ? (
              ''
            ) : (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {tooltipNodes.map((node, i) => (
                  <Box
                    key={i}
                    component="span"
                    sx={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    {i > 0 ? <Box component="span" sx={{ mx: 0.5 }}>—</Box> : null}
                    {node}
                  </Box>
                ))}
              </Stack>
            );
          return (
            <Tooltip
              key={card.name}
              title={tooltip}
              placement="top"
              disableHoverListener={tooltipNodes.length === 0}
            >
              <Stack
                spacing={0.5}
                sx={{
                  alignItems: 'stretch',
                  outline: isSelected ? '2px solid' : 'none',
                  outlineColor: (t) => t.palette.role.domestic.light,
                  borderRadius: 1.5,
                }}
              >
                <BuildingCard def={card} size="normal" />
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: 'center' }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      fullWidth
                      disabled={!enabled}
                      onClick={() => onSelect(card.name)}
                      aria-pressed={isSelected}
                      aria-label={
                        isSelected
                          ? `Cancel selection of ${card.name}`
                          : `Select ${card.name} to place`
                      }
                      sx={{
                        bgcolor: (t) => t.palette.role.domestic.main,
                        color: (t) => t.palette.role.domestic.contrastText,
                        '&:hover': {
                          bgcolor: (t) => t.palette.role.domestic.dark,
                        },
                      }}
                    >
                      {isSelected ? 'Cancel' : 'Place'}
                    </Button>
                  </Box>
                  {renderBuildingHelp?.(card) ?? null}
                </Stack>
              </Stack>
            </Tooltip>
          );
        })}
        {techs.map((tech) => {
          const cost = tech.costBag ?? {};
          const entries = costEntries(cost);
          const affordable =
            entries.length === 0 || (stash !== undefined && canAfford(stash, cost));
          const enabled = canAct && affordable;
          const tooltipNodes: ReactNode[] = [];
          if (!affordable) {
            tooltipNodes.push(
              <Box
                key="need"
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
              >
                Need {costIcons(entries)}
              </Box>,
            );
          }
          if (!canAct) tooltipNodes.push(<span key="turn">Not your turn.</span>);
          const tooltip: ReactNode =
            tooltipNodes.length === 0 ? (
              ''
            ) : (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {tooltipNodes.map((node, i) => (
                  <Box
                    key={i}
                    component="span"
                    sx={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    {i > 0 ? <Box component="span" sx={{ mx: 0.5 }}>—</Box> : null}
                    {node}
                  </Box>
                ))}
              </Stack>
            );
          return (
            <Tooltip
              key={`tech-${tech.name}`}
              title={tooltip}
              placement="top"
              disableHoverListener={tooltipNodes.length === 0}
            >
              <Stack spacing={0.5} sx={{ alignItems: 'stretch' }}>
                <TechCard def={tech} holderRole="domestic" size="normal" />
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: 'center' }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      fullWidth
                      disabled={!enabled}
                      onClick={() => onPlayTech?.(tech.name)}
                      aria-label={`Play ${tech.name}`}
                      sx={{
                        bgcolor: (t) => t.palette.role.domestic.main,
                        color: (t) => t.palette.role.domestic.contrastText,
                        '&:hover': {
                          bgcolor: (t) => t.palette.role.domestic.dark,
                        },
                      }}
                    >
                      Play
                    </Button>
                  </Box>
                  {renderTechHelp?.(tech) ?? null}
                </Stack>
              </Stack>
            </Tooltip>
          );
        })}
      </Stack>
    </Stack>
  );
}

export default Hand;
