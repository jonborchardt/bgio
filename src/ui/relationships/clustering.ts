// Pure clustering functions. Each takes the visible nodes + a chosen
// algorithm and returns clusters: [{ id, label, nodeIds }]. Layout code
// places clusters as boxes and lays out their members within.
//
// No React imports; no MUI; no @xyflow types — this file is reusable by
// tests.

import type { CardNode } from '../../cards/relationships.ts';
import type { ClusterAlgorithm } from './types.ts';
import { CARD_KIND_LABELS } from '../../cards/registry.ts';

export interface Cluster {
  id: string;
  label: string;
  nodeIds: string[];
}

const COST_BANDS: ReadonlyArray<{ id: string; label: string; max: number }> = [
  { id: 'cheap', label: 'Cheap (≤10g)', max: 10 },
  { id: 'mid', label: 'Mid (11–25g)', max: 25 },
  { id: 'pricey', label: 'Pricey (26–50g)', max: 50 },
  { id: 'lategame', label: 'Late game (>50g)', max: Infinity },
];

const costForNode = (node: CardNode): number | undefined => {
  const def = node.entry.def as { cost?: number | string };
  if (typeof def.cost === 'number') return def.cost;
  return undefined;
};

const branchOrTierLabel = (node: CardNode): string => {
  switch (node.kind) {
    case 'tech':
      return (node.entry.def as { branch?: string }).branch ?? 'Tech';
    case 'science':
      return `Science · ${(node.entry.def as { tier: string }).tier}`;
    default:
      return CARD_KIND_LABELS[node.kind];
  }
};

const costBandLabel = (node: CardNode): string => {
  const c = costForNode(node);
  if (c === undefined) return 'No cost data';
  for (const band of COST_BANDS) {
    if (c <= band.max) return band.label;
  }
  return COST_BANDS[COST_BANDS.length - 1].label;
};

const groupBy = <T>(items: T[], key: (t: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = out.get(k);
    if (arr) arr.push(item);
    else out.set(k, [item]);
  }
  return out;
};

// Flood-fill over the edge list to find connected components. Only used
// when algorithm === 'byComponent'.
const componentClusters = (
  nodes: CardNode[],
  adjacency: ReadonlyMap<string, string[]>,
): Map<string, CardNode[]> => {
  const seen = new Set<string>();
  const components = new Map<string, CardNode[]>();
  let seq = 0;
  for (const start of nodes) {
    if (seen.has(start.id)) continue;
    const queue: CardNode[] = [start];
    const compId = `c${++seq}`;
    const compNodes: CardNode[] = [];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (seen.has(cur.id)) continue;
      seen.add(cur.id);
      compNodes.push(cur);
      const neighborIds = adjacency.get(cur.id) ?? [];
      for (const nid of neighborIds) {
        if (seen.has(nid)) continue;
        const n = nodes.find((nn) => nn.id === nid);
        if (n) queue.push(n);
      }
    }
    components.set(compId, compNodes);
  }
  return components;
};

export interface ClusterInput {
  nodes: ReadonlyArray<CardNode>;
  /** Adjacency of *visible* edges. Required only by `byComponent`. */
  adjacency?: ReadonlyMap<string, string[]>;
}

export const cluster = (
  algorithm: ClusterAlgorithm,
  input: ClusterInput,
): Cluster[] => {
  const nodes = [...input.nodes];

  if (algorithm === 'none') {
    return [{ id: 'all', label: 'All cards', nodeIds: nodes.map((n) => n.id) }];
  }

  if (algorithm === 'byKind') {
    const groups = groupBy(nodes, (n) => n.kind);
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, ns]) => ({
        id: `kind:${k}`,
        label: CARD_KIND_LABELS[k as keyof typeof CARD_KIND_LABELS],
        nodeIds: ns.map((n) => n.id),
      }));
  }

  if (algorithm === 'byBranchOrTier') {
    const groups = groupBy(nodes, branchOrTierLabel);
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, ns], i) => ({
        id: `bt:${i}:${label}`,
        label,
        nodeIds: ns.map((n) => n.id),
      }));
  }

  if (algorithm === 'byCostBand') {
    const groups = groupBy(nodes, costBandLabel);
    // Preserve the COST_BANDS order rather than alpha.
    const order = ['Cheap (≤10g)', 'Mid (11–25g)', 'Pricey (26–50g)', 'Late game (>50g)', 'No cost data'];
    return order
      .filter((o) => groups.has(o))
      .map((label, i) => ({
        id: `cost:${i}`,
        label,
        nodeIds: groups.get(label)!.map((n) => n.id),
      }));
  }

  if (algorithm === 'byComponent') {
    const adjacency = input.adjacency ?? new Map();
    const components = componentClusters(nodes, adjacency);
    return [...components.entries()].map(([id, ns]) => ({
      id,
      label: `Component (${ns.length})`,
      nodeIds: ns.map((n) => n.id),
    }));
  }

  return [{ id: 'all', label: 'All cards', nodeIds: nodes.map((n) => n.id) }];
};
