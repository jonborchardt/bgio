// ScienceCard (05.5) — single-card view for the SciencePanel grid.
//
// Renders the card's color/level header, a per-resource cost vs. paid summary,
// "+1 <resource>" buttons (one per cost line) gated on `canAct && isLowest`,
// and a "Complete" button gated on `canComplete && isLowest`. When the card
// is NOT the lowest unfinished card in its color column we dim it visually
// and disable every interaction (the contribute / complete moves enforce the
// lowest-first rule too — this is just a UX hint).
//
// All visual choices route through theme tokens. The card surface uses
// `palette.card.surface` and the dimmed state lowers opacity rather than
// reaching for a raw hex.

import { Box, Button, Stack, Typography } from '@mui/material';
import type { ScienceCardDef } from '../../data/scienceCards.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';

export interface ScienceCardProps {
  card: ScienceCardDef;
  paid: ResourceBag;
  canAct: boolean;
  canComplete: boolean;
  isLowest: boolean;
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

export function ScienceCard({
  card,
  paid,
  canAct,
  canComplete,
  isLowest,
  onContribute,
  onComplete,
}: ScienceCardProps) {
  const resources = costResources(card.cost);
  const dimmed = !isLowest;

  return (
    <Box
      aria-label={`Science card ${card.id}`}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        border: '1px solid',
        borderColor: (t) => t.palette.eventColor[card.color].main,
        bgcolor: (t) => t.palette.card.surface,
        opacity: dimmed ? 0.45 : 1,
        minWidth: '11rem',
      }}
    >
      <Stack spacing={0.75}>
        <Typography
          variant="body2"
          sx={{
            color: (t) => t.palette.eventColor[card.color].main,
            fontWeight: 700,
            textTransform: 'capitalize',
          }}
        >
          {card.color} L{card.level}
        </Typography>

        {resources.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            No cost
          </Typography>
        ) : (
          resources.map((resource) => {
            const need = card.cost[resource] ?? 0;
            const have = paid[resource] ?? 0;
            return (
              <Stack
                key={resource}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center' }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: '0.625rem',
                    height: '0.625rem',
                    borderRadius: '50%',
                    bgcolor: (t) => t.palette.resource[resource].main,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.resource[resource].main,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    minWidth: '5.5rem',
                  }}
                >
                  {resource}: {have}/{need}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canAct || !isLowest || have >= need}
                  onClick={() => onContribute(resource, 1)}
                  aria-label={`Contribute +1 ${resource} to ${card.id}`}
                >
                  +1
                </Button>
              </Stack>
            );
          })
        )}

        <Button
          size="small"
          variant="contained"
          disabled={!canComplete || !isLowest}
          onClick={onComplete}
          aria-label={`Complete science card ${card.id}`}
          sx={{
            mt: 0.5,
            bgcolor: (t) => t.palette.eventColor[card.color].main,
            color: (t) => t.palette.eventColor[card.color].contrastText,
            '&:hover': {
              bgcolor: (t) => t.palette.eventColor[card.color].dark,
            },
          }}
        >
          Complete
        </Button>
      </Stack>
    </Box>
  );
}

export default ScienceCard;
