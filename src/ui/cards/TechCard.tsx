// TechCard (09.2) — presentational view of a TechnologyDef.
//
// Renders the tech's name, branch, and order. Branch color hint pulls from
// the role palette (loose mapping — branch strings vary per JSON content),
// otherwise the frame is a plain CardFrame.

import { Stack, Typography } from '@mui/material';
import type { TechnologyDef } from '../../data/schema.ts';
import { CardFrame } from './CardFrame.tsx';

export interface TechCardProps {
  def: TechnologyDef;
}

export function TechCard({ def }: TechCardProps) {
  return (
    <CardFrame>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {def.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
        >
          {def.branch}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          Order: {def.order}
        </Typography>
      </Stack>
    </CardFrame>
  );
}

export default TechCard;
