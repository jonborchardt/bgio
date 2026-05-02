// Thin React Flow wrapper: takes the prebuilt CardGraph + GraphViewSettings,
// applies filters, runs clustering + layout, and hands the positioned
// nodes/edges to React Flow. Pure presentational — variations decide the
// surrounding layout (sidebar position, drawer presence, etc.).

import { useMemo } from 'react';
import { Box } from '@mui/material';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { CardGraph, EdgeKind } from '../../cards/relationships.ts';
import {
  prereqDirection,
  EDGE_KIND_LABELS,
} from '../../cards/relationships.ts';
import type { GraphViewSettings } from './types.ts';
import { cluster } from './clustering.ts';
import { layoutGraph } from './layout.ts';
import { cardNodeTypes } from './nodeTypes.ts';
import type { CardNodeData } from './CardNode.tsx';
import { useTheme } from '@mui/material/styles';

export interface RelationshipsGraphProps {
  graph: CardGraph;
  settings: GraphViewSettings;
  /** Card id currently focused, or null. Highlights the node and dims
   *  edges that don't touch it. */
  focusId?: string | null;
  /** Callback when the user clicks a card node. */
  onSelectCard?: (cardId: string) => void;
}

const EDGE_COLOR_TOKEN: Record<EdgeKind, 'role.science' | 'role.domestic' | 'role.foreign' | 'role.chief' | 'status.muted' | 'status.active'> = {
  'tech-unlocks-building': 'role.domestic',
  'tech-unlocks-unit': 'role.foreign',
  'tech-event-link': 'role.science',
  'unit-requires-tech': 'role.chief',
  'unit-requires-building': 'status.muted',
  'building-adjacent': 'status.active',
  // Tech ordering = science web → use the science accent.
  'tech-prereq-tech': 'role.science',
  // Building → its enabling tech reads as domestic infrastructure.
  'building-requires-tech': 'role.domestic',
  // Battle → unit reads as a foreign / military relationship.
  'battle-needs-unit': 'role.foreign',
  // Science → tech rewards: science role accent.
  'science-rewards-tech': 'role.science',
  // Cell-to-cell chain within a color column: muted, since the chain
  // is a structural backbone rather than the user-actionable
  // "what does this unlock" reading.
  'science-cell-prereq': 'status.muted',
};

const resolveEdgeColor = (
  theme: { palette: { role: Record<string, { main: string }>; status: { active: string; muted: string } } },
  token: string,
): string => {
  if (token.startsWith('role.')) {
    const k = token.slice(5);
    return theme.palette.role[k]?.main ?? theme.palette.status.muted;
  }
  if (token === 'status.active') return theme.palette.status.active;
  return theme.palette.status.muted;
};

export function RelationshipsGraph({
  graph,
  settings,
  focusId,
  onSelectCard,
}: RelationshipsGraphProps) {
  const theme = useTheme();
  const { nodes, edges } = useMemo(() => {
    // 1. Filter nodes by visible kinds + search.
    const search = settings.search.trim().toLowerCase();
    const matchesSearch = (name: string) =>
      search.length === 0 ? true : name.toLowerCase().includes(search);

    const visibleNodes = graph.nodes.filter((n) =>
      settings.visibleCardKinds.has(n.kind),
    );

    // 2. Filter edges by visible kinds + endpoint visibility.
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graph.edges.filter(
      (e) =>
        settings.visibleEdgeKinds.has(e.kind) &&
        visibleNodeIds.has(e.source) &&
        visibleNodeIds.has(e.target),
    );

    // 3. Hide orphans if requested (only if hideOrphans is on).
    let workingNodes = visibleNodes;
    if (settings.hideOrphans) {
      const touched = new Set<string>();
      for (const e of visibleEdges) {
        touched.add(e.source);
        touched.add(e.target);
      }
      workingNodes = visibleNodes.filter((n) => touched.has(n.id));
    }

    // 4. Build adjacency for cluster=byComponent.
    const adjacency = new Map<string, string[]>();
    for (const e of visibleEdges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      if (!adjacency.has(e.target)) adjacency.set(e.target, []);
      adjacency.get(e.source)!.push(e.target);
      adjacency.get(e.target)!.push(e.source);
    }

    // 5. Cluster.
    const clusters = cluster(settings.cluster, {
      nodes: workingNodes,
      adjacency,
    });

    // 6. Layout.
    const { positions, clusterBounds } = layoutGraph({
      clusters,
      nodes: workingNodes,
      edges: visibleEdges,
      engine: settings.layout,
      nodeSpacing: settings.nodeSpacing,
      clusterSpacing: settings.clusterSpacing,
    });

    // 7. Build RF nodes.
    const focusNeighbors = new Set<string>();
    if (focusId) {
      focusNeighbors.add(focusId);
      for (const e of visibleEdges) {
        if (e.source === focusId) focusNeighbors.add(e.target);
        if (e.target === focusId) focusNeighbors.add(e.source);
      }
    }

    const rfNodes: Node<CardNodeData>[] = workingNodes.map((n) => {
      const p = positions.get(n.id);
      const isMatch = matchesSearch(n.name);
      const isFocusOrNeighbor =
        focusNeighbors.size === 0 ? true : focusNeighbors.has(n.id);
      return {
        id: n.id,
        type: 'card',
        position: { x: p?.x ?? 0, y: p?.y ?? 0 },
        data: {
          entry: n.entry,
          dim: !isMatch || !isFocusOrNeighbor,
          highlight: focusId === n.id,
        },
      };
    });

    // 8. Build RF edges. For edges with prereq semantics we normalize
    // the rendered direction so React Flow's source = the upper
    // (prereq) node and target = the lower (dependent) node. Without
    // this, edges stored as `unit-requires-tech` (source = unit /
    // dependent / lower; target = tech / prereq / upper) get drawn
    // with the arrow pointing UP, which contradicts the dagre layout
    // and reads as a backward dependency.
    const rfEdges: Edge[] = visibleEdges.map((e) => {
      const colorToken = EDGE_COLOR_TOKEN[e.kind];
      const stroke = resolveEdgeColor(theme as unknown as { palette: { role: Record<string, { main: string }>; status: { active: string; muted: string } } }, colorToken);
      const dir = prereqDirection(e);
      const renderSource = dir ? dir.prereq : e.source;
      const renderTarget = dir ? dir.dependent : e.target;
      const isFocusEdge =
        focusId !== null && focusId !== undefined &&
        (renderSource === focusId || renderTarget === focusId);
      return {
        id: e.id,
        source: renderSource,
        target: renderTarget,
        // Show the edge KIND (e.g. "Tech → Building", "Unit → Tech
        // (req)") instead of the raw token from the JSON. The kind
        // label is more useful for design review than the matched
        // token, which already shows up at the endpoints via the
        // node names.
        label: settings.showEdgeLabels ? EDGE_KIND_LABELS[e.kind] : undefined,
        style: {
          stroke,
          strokeWidth: isFocusEdge ? 2 : 1,
          opacity:
            focusId && !isFocusEdge && focusNeighbors.size > 0 ? 0.15 : 0.7,
        },
        labelStyle: { fill: stroke, fontSize: 10 },
      };
    });

    // Cluster rectangles are computed but not rendered: React Flow
    // owns pan/zoom and overlay rects don't follow the transform
    // without extra plumbing. Cluster identity is conveyed by the
    // layout spacing alone — the rects can be wired later via
    // `useReactFlow().getViewport()` if a designer wants explicit
    // cluster framing.
    void clusterBounds;

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, settings, focusId, theme]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={cardNodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_e, node) => onSelectCard?.(node.id)}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </Box>
  );
}

export default RelationshipsGraph;
