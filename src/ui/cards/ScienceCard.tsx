// ScienceCard (09.2 — presentational variant).
//
// IMPORTANT: this file is the GENERIC presentational science card used by
// reusable views. The Science role's panel-specific card (with +1 contribute
// buttons and a Complete button) lives at `src/ui/science/ScienceCard.tsx`
// and is the one wired into SciencePanel. Don't conflate them.
//
// Wraps a ScienceCardDef in a CardFrame whose tier border + color stripe come
// from the def itself, then renders cost / paid resource chips via 09.3's
// ResourceBag component.

import { Stack, Typography } from '@mui/material';
import type { ScienceCardDef } from '../../data/scienceCards.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { CardFrame } from './CardFrame.tsx';
import { ResourceChip } from '../resources/ResourceChip.tsx';

export interface ScienceCardProps {
  def: ScienceCardDef;
  paid: ResourceBag;
}

const costResources = (cost: Partial<ResourceBag>): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    if ((cost[r] ?? 0) > 0) out.push(r);
  }
  return out;
};

export function ScienceCard({ def, paid }: ScienceCardProps) {
  const resources = costResources(def.cost);
  return (
    <CardFrame tier={def.tier} color={def.color}>
      <Stack spacing={0.5}>
        <Typography
          variant="body2"
          sx={{
            color: (t) => t.palette.eventColor[def.color].main,
            fontWeight: 700,
            textTransform: 'capitalize',
          }}
        >
          {def.color} L{def.level}
        </Typography>

        {resources.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            No cost
          </Typography>
        ) : (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {resources.map((resource) => {
              const need = def.cost[resource] ?? 0;
              const have = paid[resource] ?? 0;
              return (
                <ResourceChip
                  key={resource}
                  resource={resource}
                  count={have}
                  size="sm"
                  label={`${resource} ${have}/${need}`}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </CardFrame>
  );
}

export default ScienceCard;
