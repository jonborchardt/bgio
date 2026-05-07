// Pure layout: takes clusters + edges + the chosen engine and returns a
// `{ nodeId -> {x, y} }` map. No React Flow imports — the wrapper just
// applies these positions to RF nodes.
//
// Four engines are supported. None require external deps; for a graph
// of ~150 nodes that's plenty:
//   - dagre     simple longest-path layering using only edges within
//               the same cluster. Cluster boxes flow left-to-right.
//   - force     classic spring-electrical with cluster anchors. ~50
//               iterations is enough for our scale.
//   - circular  evenly distribute around a per-cluster ring.
//   - grid      sqrt-row grid per cluster.

import type { CardNode, CardEdge } from '../../cards/relationships.ts';
import { prereqDirection } from '../../cards/relationships.ts';
import type { Cluster } from './clustering.ts';
import type { LayoutEngine } from './types.ts';
import { CARD_WIDTH, CARD_HEIGHT } from '../cards/sizes.ts';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  /** Cluster the node was placed within. */
  clusterId: string;
}

export interface LayoutInput {
  clusters: ReadonlyArray<Cluster>;
  nodes: ReadonlyArray<CardNode>;
  edges: ReadonlyArray<CardEdge>;
  engine: LayoutEngine;
  nodeSpacing: number;
  clusterSpacing: number;
}

const NODE_W = CARD_WIDTH.small;
const NODE_H = CARD_HEIGHT.small;

const layoutGrid = (
  cluster: Cluster,
  nodeSpacing: number,
): Map<string, { x: number; y: number }> => {
  const out = new Map<string, { x: number; y: number }>();
  const n = cluster.nodeIds.length;
  if (n === 0) return out;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  cluster.nodeIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.set(id, {
      x: col * (NODE_W + nodeSpacing),
      y: row * (NODE_H + nodeSpacing),
    });
  });
  return out;
};

const layoutCircular = (
  cluster: Cluster,
  nodeSpacing: number,
): Map<string, { x: number; y: number }> => {
  const out = new Map<string, { x: number; y: number }>();
  const n = cluster.nodeIds.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(cluster.nodeIds[0], { x: 0, y: 0 });
    return out;
  }
  const circumference = n * (NODE_W + nodeSpacing);
  const radius = Math.max(NODE_W, circumference / (2 * Math.PI));
  cluster.nodeIds.forEach((id, i) => {
    const a = (2 * Math.PI * i) / n;
    out.set(id, { x: radius * Math.cos(a), y: radius * Math.sin(a) });
  });
  return out;
};

// Tiny dagre-ish layout: longest-path layering using only the
// prereq-typed edges within the cluster, oriented "prereq → dependent"
// regardless of how the raw edge points (see `prereqDirection` in
// `cards/relationships.ts`). Layers flow top → bottom so:
//   - top of the page = incoming / things you depend on,
//   - bottom of the page = outgoing / things you enable.
// Non-prereq edge kinds (adjacency, event linkage) are ignored for
// layering — they still draw, but they don't push nodes around.
const layoutDagre = (
  cluster: Cluster,
  edges: ReadonlyArray<CardEdge>,
  nodeSpacing: number,
): Map<string, { x: number; y: number }> => {
  const out = new Map<string, { x: number; y: number }>();
  const ids = new Set(cluster.nodeIds);
  if (ids.size === 0) return out;

  // Build directed adjacency restricted to the cluster, normalized to
  // "prereq → dependent" so longest-path layering puts prereqs above
  // their dependents.
  const inEdges = new Map<string, string[]>();
  for (const id of ids) inEdges.set(id, []);
  for (const e of edges) {
    const dir = prereqDirection(e);
    if (!dir) continue;
    if (!ids.has(dir.prereq) || !ids.has(dir.dependent)) continue;
    if (dir.prereq === dir.dependent) continue;
    inEdges.get(dir.dependent)!.push(dir.prereq);
  }

  // Longest-path layering: layer = 1 + max(layer of prereq neighbors).
  // Visit guard breaks cycles (data could in principle have one).
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const layerOf = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const incomers = inEdges.get(id) ?? [];
    let max = 0;
    for (const inc of incomers) {
      const l = layerOf(inc);
      if (l + 1 > max) max = l + 1;
    }
    visiting.delete(id);
    layer.set(id, max);
    return max;
  };
  for (const id of ids) layerOf(id);

  // Group nodes by layer, then place horizontally per layer.
  const byLayer = new Map<number, string[]>();
  for (const [id, l] of layer.entries()) {
    const arr = byLayer.get(l);
    if (arr) arr.push(id);
    else byLayer.set(l, [id]);
  }

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  sortedLayers.forEach((l) => {
    const nodes = byLayer.get(l)!.sort();
    nodes.forEach((id, i) => {
      // Top → bottom flow: layer drives y, intra-layer index drives x.
      // Layer 0 (no prereqs in the cluster) renders at the top; deeper
      // dependents render below.
      out.set(id, {
        x: i * (NODE_W + nodeSpacing),
        y: l * (NODE_H + nodeSpacing * 1.5),
      });
    });
  });
  return out;
};

const layoutForce = (
  cluster: Cluster,
  edges: ReadonlyArray<CardEdge>,
  nodeSpacing: number,
): Map<string, { x: number; y: number }> => {
  const ids = cluster.nodeIds;
  const positions = new Map<string, { x: number; y: number }>();
  if (ids.length === 0) return positions;

  // Seed on a circle so the initial state is not pathological.
  const seed = layoutCircular(cluster, nodeSpacing);
  for (const [id, p] of seed.entries()) positions.set(id, { ...p });

  const k = NODE_W + nodeSpacing; // ideal edge length
  const idsSet = new Set(ids);
  const internalEdges = edges.filter(
    (e) => idsSet.has(e.source) && idsSet.has(e.target) && e.source !== e.target,
  );

  const iterations = 50;
  for (let it = 0; it < iterations; it++) {
    const forces = new Map<string, { x: number; y: number }>();
    for (const id of ids) forces.set(id, { x: 0, y: 0 });

    // Repulsion: every pair of nodes.
    for (let i = 0; i < ids.length; i++) {
      const a = positions.get(ids[i])!;
      for (let j = i + 1; j < ids.length; j++) {
        const b = positions.get(ids[j])!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const f = (k * k) / dist;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        forces.get(ids[i])!.x += fx;
        forces.get(ids[i])!.y += fy;
        forces.get(ids[j])!.x -= fx;
        forces.get(ids[j])!.y -= fy;
      }
    }

    // Attraction: along each edge.
    for (const e of internalEdges) {
      const a = positions.get(e.source)!;
      const b = positions.get(e.target)!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f = (dist * dist) / k;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      forces.get(e.source)!.x -= fx;
      forces.get(e.source)!.y -= fy;
      forces.get(e.target)!.x += fx;
      forces.get(e.target)!.y += fy;
    }

    // Apply with cooling.
    const cooling = 1 - it / iterations;
    for (const id of ids) {
      const f = forces.get(id)!;
      const p = positions.get(id)!;
      const fLen = Math.sqrt(f.x * f.x + f.y * f.y) || 0.1;
      const step = Math.min(fLen, k) * cooling;
      p.x += (f.x / fLen) * step;
      p.y += (f.y / fLen) * step;
    }
  }
  return positions;
};

export interface LayoutResult {
  positions: Map<string, PositionedNode>;
  clusterBounds: Map<string, { x: number; y: number; w: number; h: number; label: string }>;
}

export const layoutGraph = (input: LayoutInput): LayoutResult => {
  const positions = new Map<string, PositionedNode>();
  const clusterBounds = new Map<
    string,
    { x: number; y: number; w: number; h: number; label: string }
  >();

  // Lay out each cluster independently, then pack clusters left-to-right.
  let cursorX = 0;
  let rowY = 0;
  let rowHeight = 0;
  const maxRowWidth = 2200;

  for (const c of input.clusters) {
    let local: Map<string, { x: number; y: number }>;
    switch (input.engine) {
      case 'grid':
        local = layoutGrid(c, input.nodeSpacing);
        break;
      case 'circular':
        local = layoutCircular(c, input.nodeSpacing);
        break;
      case 'force':
        local = layoutForce(c, input.edges, input.nodeSpacing);
        break;
      case 'dagre':
      default:
        local = layoutDagre(c, input.edges, input.nodeSpacing);
        break;
    }

    // Normalize so the cluster's min(x,y) = 0.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of local.values()) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (!Number.isFinite(minX)) {
      minX = 0; minY = 0; maxX = 0; maxY = 0;
    }
    const w = maxX - minX + NODE_W;
    const h = maxY - minY + NODE_H;

    if (cursorX + w > maxRowWidth && cursorX > 0) {
      rowY += rowHeight + input.clusterSpacing;
      cursorX = 0;
      rowHeight = 0;
    }

    clusterBounds.set(c.id, {
      x: cursorX,
      y: rowY,
      w,
      h,
      label: c.label,
    });

    for (const [id, p] of local.entries()) {
      positions.set(id, {
        id,
        x: cursorX + (p.x - minX),
        y: rowY + (p.y - minY),
        clusterId: c.id,
      });
    }

    cursorX += w + input.clusterSpacing;
    if (h > rowHeight) rowHeight = h;
  }

  return { positions, clusterBounds };
};
