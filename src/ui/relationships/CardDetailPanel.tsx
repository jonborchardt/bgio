// Detail view for a single focused card. Shows the card at `detailed`
// size on top, then "Outgoing" + "Incoming" relationship lists
// (with each related card rendered at micro size + clickable to jump
// focus). Used by the side drawer in variations 1 / 5 and as the modal
// body when no graph is involved.

import { Box, Divider, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { AnyCard } from '../cards/AnyCard.tsx';
import { cardById } from '../../cards/registry.ts';
import type { CardGraph } from '../../cards/relationships.ts';
import { EDGE_KIND_LABELS } from '../../cards/relationships.ts';

export interface CardDetailPanelProps {
  graph: CardGraph;
  focusId: string | null;
  onSelect: (cardId: string) => void;
  /** When true, render the Incoming group above Outgoing (variation 6
   *  default — "what reaches this card" is usually the question). */
  incomingFirst?: boolean;
}

export function CardDetailPanel({
  graph,
  focusId,
  onSelect,
  incomingFirst,
}: CardDetailPanelProps) {
  const entry = focusId ? cardById(focusId) : undefined;

  const { outgoing, incoming } = useMemo(() => {
    const out: typeof graph.edges[number][] = [];
    const inc: typeof graph.edges[number][] = [];
    if (!focusId) return { outgoing: out, incoming: inc };
    for (const e of graph.edges) {
      if (e.source === focusId) out.push(e);
      if (e.target === focusId && e.source !== focusId) inc.push(e);
    }
    return { outgoing: out, incoming: inc };
  }, [graph, focusId]);

  if (!entry) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
          Pick a card from the list or graph to see its relationships.
        </Typography>
      </Box>
    );
  }

  const groupByKind = (edges: typeof graph.edges) => {
    const m = new Map<string, typeof graph.edges[number][]>();
    for (const e of edges) {
      const arr = m.get(e.kind);
      if (arr) arr.push(e);
      else m.set(e.kind, [e]);
    }
    return m;
  };

  const renderEdgeGroup = (
    title: string,
    edges: typeof graph.edges,
    direction: 'out' | 'in',
  ) => {
    if (edges.length === 0) return null;
    const groups = groupByKind(edges);
    return (
      <Box>
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
          {title} ({edges.length})
        </Typography>
        <Stack spacing={1} sx={{ mt: 0.5 }}>
          {[...groups.entries()].map(([kind, es]) => (
            <Box key={kind}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {EDGE_KIND_LABELS[kind as keyof typeof EDGE_KIND_LABELS]}
              </Typography>
              <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                {es.map((e) => {
                  const otherId = direction === 'out' ? e.target : e.source;
                  const other = cardById(otherId);
                  if (!other) return null;
                  return (
                    <Box
                      key={e.id}
                      onClick={() => onSelect(otherId)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <AnyCard entry={other} size="micro" />
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  };

  return (
    <Stack spacing={2} sx={{ p: 2, minWidth: 320 }}>
      <AnyCard entry={entry} size="detailed" />
      <Divider />
      {incomingFirst ? (
        <>
          {renderEdgeGroup('Incoming', incoming, 'in')}
          {renderEdgeGroup('Outgoing', outgoing, 'out')}
        </>
      ) : (
        <>
          {renderEdgeGroup('Outgoing', outgoing, 'out')}
          {renderEdgeGroup('Incoming', incoming, 'in')}
        </>
      )}
      {outgoing.length === 0 && incoming.length === 0 ? (
        <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
          No typed relationships found for this card.
        </Typography>
      ) : null}
    </Stack>
  );
}

export default CardDetailPanel;
