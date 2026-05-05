// VillageBuildingCard — postage-stamp tile (110×90) for buildings already
// placed on the village grid. Distinct from the canonical BuildingCard
// because, on the grid, cost is irrelevant (already paid) and the player
// wants to read what the tile *does* at a glance: title + benefit, with
// active-adjacency dots if any rules are firing. Hover shows the full
// detailed card via the wrapping CellSlot tooltip.
//
// The shell echoes V9CardShell visually (top accent bar, kind glyph,
// uppercase role line) so a placed tile reads as the same family as the
// canonical card — just trimmed to the tile footprint.

import { Box, Paper, Stack, Typography } from '@mui/material';
import type { BuildingDef } from '../../data/schema.ts';
import { ADJACENCY_RULES } from '../../data/adjacency.ts';
import { idForBuilding } from '../../cards/registry.ts';
import { CARD_HEIGHT, CARD_WIDTH } from './sizes.ts';
import { KindGlyph } from './kindGlyphs.tsx';
import { CardInfoButton } from './CardInfoButton.tsx';
import { ResourceText } from '../resources/ResourceText.tsx';

export interface VillageBuildingCardProps {
  def: BuildingDef;
  /** Stack count (placed copies). When > 1, renders an `×N` badge. */
  count?: number;
  /** defIDs of orthogonally-adjacent buildings on the grid. Drives the
   *  active-adjacency dot row when at least one rule is firing. */
  activeNeighbors?: ReadonlySet<string>;
}

const w = CARD_WIDTH.small;
const h = CARD_HEIGHT.small;

export function VillageBuildingCard({
  def,
  count,
  activeNeighbors,
}: VillageBuildingCardProps) {
  const cardId = idForBuilding(def);

  // Count adjacency rules currently firing for this building. The dot row
  // is purely an at-a-glance "is this tile contributing its bonus right
  // now?" signal — the full rule list lives in the hover detail card.
  const activeAdjacencyCount = (() => {
    if (!activeNeighbors) return 0;
    let n = 0;
    for (const rule of ADJACENCY_RULES) {
      if (rule.defID !== def.name) continue;
      if (rule.whenAdjacentTo === '*') {
        if (activeNeighbors.size > 0) n += 1;
      } else if (activeNeighbors.has(rule.whenAdjacentTo)) {
        n += 1;
      }
    }
    return n;
  })();

  return (
    <Paper
      elevation={0}
      sx={(t) => ({
        width: w,
        height: h,
        bgcolor: t.palette.card.surface,
        color: t.palette.card.text,
        border: `1px solid ${t.palette.status.muted}66`,
        borderRadius: 1,
        boxShadow: t.palette.shadow.card,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      })}
    >
      <Box sx={(t) => ({ height: 4, bgcolor: t.palette.role.domestic.main })} />

      {cardId !== undefined ? (
        <CardInfoButton cardId={cardId} size="small" />
      ) : null}

      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'flex-start', px: 0.75, pt: 0.4 }}
      >
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={(t) => ({
              color: t.palette.role.domestic.main,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              fontWeight: 800,
              lineHeight: 1.2,
              fontSize: '0.6rem',
            })}
          >
            Village · Domestic
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -0.2,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.85rem',
            }}
          >
            {def.name}
          </Typography>
        </Stack>
        <Box sx={(t) => ({ color: t.palette.role.domestic.main, flexShrink: 0 })}>
          <KindGlyph kind="buildingPlaced" size={22} />
        </Box>
        {count !== undefined && count > 1 ? (
          <Box
            sx={(t) => ({
              alignSelf: 'flex-start',
              px: 0.5,
              py: 0.05,
              bgcolor: t.palette.role.domestic.main,
              color: t.palette.role.domestic.contrastText,
              fontWeight: 800,
              fontSize: '0.7rem',
              borderRadius: 0.5,
              ml: -0.5,
            })}
          >
            ×{count}
          </Box>
        ) : null}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0 }} />

      {def.benefit ? (
        <Box
          sx={{
            color: 'text.primary',
            lineHeight: 1.25,
            fontSize: '0.72rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.25,
            rowGap: 0.15,
            px: 0.75,
            pb: activeAdjacencyCount > 0 ? 0.2 : 0.4,
          }}
        >
          <ResourceText text={def.benefit} size="small" />
        </Box>
      ) : null}

      {activeAdjacencyCount > 0 ? (
        <Stack
          direction="row"
          spacing={0.3}
          sx={{ alignItems: 'center', px: 0.75, pb: 0.4 }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              fontWeight: 800,
              fontSize: '0.5rem',
            }}
          >
            Adj
          </Typography>
          <Typography
            component="span"
            sx={(t) => ({
              color: t.palette.role.domestic.main,
              fontWeight: 800,
              fontSize: '0.6rem',
              lineHeight: 1,
            })}
          >
            {'✓'.repeat(activeAdjacencyCount)}
          </Typography>
        </Stack>
      ) : null}
    </Paper>
  );
}

export default VillageBuildingCard;
