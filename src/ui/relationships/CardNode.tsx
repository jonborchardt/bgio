// React Flow custom node: wraps the canonical card at `small` size,
// adds a thin selected ring, and exposes the standard four handles so
// edges connect cleanly. Dimming for non-matching search terms is
// applied via opacity on the wrapper.

import { Box } from '@mui/material';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AnyCardEntry } from '../../cards/registry.ts';
import { AnyCard } from '../cards/AnyCard.tsx';

export interface CardNodeData extends Record<string, unknown> {
  entry: AnyCardEntry;
  dim: boolean;
  highlight: boolean;
}

export function CardNode({ data, selected }: NodeProps) {
  const d = data as CardNodeData;
  return (
    <Box
      sx={{
        opacity: d.dim ? 0.3 : 1,
        outline: selected || d.highlight ? '2px solid' : 'none',
        outlineColor: (t) => t.palette.status.active,
        borderRadius: 1,
        transition: 'opacity 120ms ease',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <AnyCard entry={d.entry} size="small" />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
}

export default CardNode;
