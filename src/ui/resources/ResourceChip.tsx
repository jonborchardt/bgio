// ResourceChip (09.3) — single resource + count, painted in the resource's
// theme color. MUI Chip is the natural primitive — it gives us a colored
// background, a label, and a fixed-height pill shape with no extra work.
//
// The bg color comes from `palette.resource[resource].main` and contrast text
// from `.contrastText` — both live in the theme so no raw hex literals appear
// here.
//
// The optional `label` prop lets callers override the default
// `"<resource>: <count>"` text (e.g. ScienceCard wants "wood 1/3").

import { Chip } from '@mui/material';
import { RESOURCE_DISPLAY, type Resource } from '../../game/resources/types.ts';

export type ChipSize = 'sm' | 'md' | 'lg';

export interface ResourceChipProps {
  resource: Resource;
  count: number;
  size?: ChipSize;
  label?: string;
}

const sizeProps: Record<
  ChipSize,
  { muiSize: 'small' | 'medium'; fontSize: string; height: string }
> = {
  sm: { muiSize: 'small', fontSize: '0.75rem', height: '1.25rem' },
  md: { muiSize: 'small', fontSize: '0.875rem', height: '1.5rem' },
  lg: { muiSize: 'medium', fontSize: '1rem', height: '2rem' },
};

export function ResourceChip({
  resource,
  count,
  size = 'md',
  label,
}: ResourceChipProps) {
  const cfg = sizeProps[size];
  const name = RESOURCE_DISPLAY[resource].name;
  const display = label ?? `${name}: ${count}`;
  return (
    <Chip
      size={cfg.muiSize}
      label={display}
      aria-label={`${name} ${count}`}
      sx={{
        height: cfg.height,
        fontSize: cfg.fontSize,
        fontWeight: 600,
        bgcolor: (t) => t.palette.resource[resource].main,
        color: (t) => t.palette.resource[resource].contrastText,
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  );
}

export default ResourceChip;
