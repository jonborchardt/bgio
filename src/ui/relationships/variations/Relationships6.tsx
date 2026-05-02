// Variation 6 — refinement of variation 5. Single Autocomplete that
// lists every card with its kind label (replacing the separate filter
// + dropdown), incoming relationships listed before outgoing in the
// detail pane, and the left filter rail is scrollable so the controls
// don't push other UI off-screen on short viewports.

import {
  Autocomplete,
  Box,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { CardGraph } from '../../../cards/relationships.ts';
import { ALL_EDGE_KINDS } from '../../../cards/relationships.ts';
import { CARD_KINDS, CARD_KIND_LABELS } from '../../../cards/registry.ts';
import { GraphControls } from '../GraphControls.tsx';
import { RelationshipsGraph } from '../RelationshipsGraph.tsx';
import { CardDetailPanel } from '../CardDetailPanel.tsx';
import { defaultGraphSettings, type GraphViewSettings } from '../types.ts';
import type { VariationProps } from './index.ts';

const neighborhood = (
  graph: CardGraph,
  focusId: string,
  hops: number,
): { nodes: typeof graph.nodes; edges: typeof graph.edges } => {
  const visible = new Set<string>([focusId]);
  let frontier = new Set<string>([focusId]);
  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const e of graph.edges) {
      if (frontier.has(e.source) && !visible.has(e.target)) {
        next.add(e.target);
        visible.add(e.target);
      }
      if (frontier.has(e.target) && !visible.has(e.source)) {
        next.add(e.source);
        visible.add(e.source);
      }
    }
    if (next.size === 0) break;
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((n) => visible.has(n.id)),
    edges: graph.edges.filter(
      (e) => visible.has(e.source) && visible.has(e.target),
    ),
  };
};

interface PickerOption {
  id: string;
  label: string;
  kind: string;
}

export function Relationships6({ graph, initialFocusId }: VariationProps) {
  // Neighborhood views need every edge kind on by default — otherwise
  // the poster-style "tech→building only" default in
  // `defaultGraphSettings` strips most of what `hops` just expanded
  // and the slider looks like a no-op. We also leave orphans visible:
  // a hopped-in card with no in-filter edges is still meaningful here.
  const [settings, setSettings] = useState<GraphViewSettings>(() => ({
    ...defaultGraphSettings(ALL_EDGE_KINDS, CARD_KINDS),
    visibleEdgeKinds: new Set(ALL_EDGE_KINDS),
    hideOrphans: false,
    // V6 defaults: a focus/neighborhood view reads best as a single
    // dagre tree from the focus card, no per-kind grouping.
    cluster: 'none',
    layout: 'dagre',
  }));
  // Default focus: the user-supplied initialFocusId wins, then the
  // first card of the first kind in CARD_KINDS that the graph contains
  // (currently `building` — order is the canonical reading order from
  // src/cards/registry.ts), then the first node overall, then null.
  // Re-derived on every render is cheap and keeps the picker honest if
  // a kind ever loses all its cards.
  const firstOfFirstKind = useMemo<string | null>(() => {
    for (const kind of CARD_KINDS) {
      const found = graph.nodes.find((n) => n.kind === kind);
      if (found) return found.id;
    }
    return graph.nodes[0]?.id ?? null;
  }, [graph.nodes]);
  const [focusId, setFocusId] = useState<string | null>(
    initialFocusId ?? firstOfFirstKind,
  );
  const [hops, setHops] = useState<number>(2);

  const focusedGraph = useMemo<CardGraph>(() => {
    if (!focusId) return graph;
    const sub = neighborhood(graph, focusId, hops);
    return { nodes: sub.nodes, edges: sub.edges, warnings: [] };
  }, [graph, focusId, hops]);

  const options = useMemo<PickerOption[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        label: n.name,
        kind: CARD_KIND_LABELS[n.kind],
      })),
    [graph.nodes],
  );

  const selected = options.find((o) => o.id === focusId) ?? null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr 360px',
        gap: 1,
        height: '100%',
        minHeight: 600,
      }}
    >
      <Box
        sx={{
          // Scrollable left rail so the focus picker + hops slider +
          // GraphControls (long checkbox lists) don't push each other
          // off-screen.
          overflow: 'auto',
          height: '100%',
          borderRight: '1px solid',
          borderColor: (t) => t.palette.status.muted,
        }}
      >
        <Stack spacing={2} sx={{ p: 1.5 }}>
          <Autocomplete<PickerOption>
            options={options}
            value={selected}
            onChange={(_e, v) => setFocusId(v?.id ?? null)}
            groupBy={(o) => o.kind}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Focus card" />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  <Typography variant="body2">{option.label}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: (t) => t.palette.status.muted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      fontSize: '0.65rem',
                    }}
                  >
                    {option.kind}
                  </Typography>
                </Stack>
              </li>
            )}
          />
          <Box>
            <Typography variant="caption" sx={{ color: (t) => t.palette.status.muted }}>
              Hops: {hops}
            </Typography>
            <Slider
              size="small"
              value={hops}
              min={1}
              max={4}
              step={1}
              marks
              onChange={(_e, v) => setHops(v as number)}
            />
          </Box>
        </Stack>
        {/* Variation 6 has its own focus picker, so suppress the
            redundant "Search cards" field by passing an empty search
            and a no-op onChange — but keep the rest of the controls
            (filters, layout, clustering). The picker above is the
            authoritative selector. */}
        <GraphControls
          value={settings}
          onChange={(next) => setSettings({ ...next, search: '' })}
          hideSearch
        />
      </Box>
      <Stack sx={{ minHeight: 600 }}>
        <RelationshipsGraph
          graph={focusedGraph}
          settings={settings}
          focusId={focusId}
          onSelectCard={setFocusId}
        />
      </Stack>
      <Box
        sx={{
          overflow: 'auto',
          borderLeft: '1px solid',
          borderColor: (t) => t.palette.status.muted,
        }}
      >
        <CardDetailPanel
          graph={graph}
          focusId={focusId}
          onSelect={setFocusId}
          incomingFirst
        />
      </Box>
    </Box>
  );
}

export default Relationships6;
