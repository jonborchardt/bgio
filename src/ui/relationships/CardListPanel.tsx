// Filterable list of cards used by the list-style variations. Renders
// each card in `micro` size and emits `onSelect(cardId)` so the host
// variation can highlight in the graph or open the detail drawer.

import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { AnyCard } from '../cards/AnyCard.tsx';
import type { CardGraph } from '../../cards/relationships.ts';
import type { GraphViewSettings } from './types.ts';
import { CARD_KINDS, CARD_KIND_LABELS } from '../../cards/registry.ts';

export interface CardListPanelProps {
  graph: CardGraph;
  settings: GraphViewSettings;
  focusId?: string | null;
  onSelect: (cardId: string) => void;
  /** Show "matches/total" header. */
  showHeader?: boolean;
}

export function CardListPanel({
  graph,
  settings,
  focusId,
  onSelect,
  showHeader,
}: CardListPanelProps) {
  const filtered = useMemo(() => {
    const search = settings.search.trim().toLowerCase();
    return graph.nodes
      .filter((n) => settings.visibleCardKinds.has(n.kind))
      .filter((n) =>
        search.length === 0 ? true : n.name.toLowerCase().includes(search),
      );
  }, [graph, settings]);

  // Group by kind so the user gets a stable section per card type.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const k of CARD_KINDS) map.set(k, []);
    for (const n of filtered) map.get(n.kind)!.push(n);
    return map;
  }, [filtered]);

  return (
    <Stack spacing={1} sx={{ p: 1, minWidth: 220 }}>
      {showHeader ? (
        <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
          {filtered.length} of {graph.nodes.length} cards
        </Typography>
      ) : null}
      {CARD_KINDS.map((kind) => {
        const items = grouped.get(kind) ?? [];
        if (items.length === 0) return null;
        return (
          <Box key={kind}>
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.65rem',
              }}
            >
              {CARD_KIND_LABELS[kind]} ({items.length})
            </Typography>
            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
              {items.map((n) => (
                <Box
                  key={n.id}
                  onClick={() => onSelect(n.id)}
                  sx={{
                    cursor: 'pointer',
                    outline: focusId === n.id ? '2px solid' : 'none',
                    outlineColor: (t) => t.palette.status.active,
                    borderRadius: 1,
                  }}
                >
                  <AnyCard entry={n.entry} size="micro" />
                </Box>
              ))}
            </Stack>
          </Box>
        );
      })}
      {filtered.length === 0 ? (
        <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
          No cards match.
        </Typography>
      ) : null}
    </Stack>
  );
}

export default CardListPanel;
