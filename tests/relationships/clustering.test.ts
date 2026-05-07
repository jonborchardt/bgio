// Clustering algorithms — pure functions over CardNode lists.

import { describe, expect, it } from 'vitest';
import { cluster } from '../../src/ui/relationships/clustering.ts';
import { buildCardGraph } from '../../src/cards/relationships.ts';

describe('ui/relationships/clustering', () => {
  const graph = buildCardGraph();
  const allNodes = graph.nodes;

  it('"none" returns a single cluster with every node', () => {
    const out = cluster('none', { nodes: allNodes });
    expect(out.length).toBe(1);
    expect(out[0].nodeIds.length).toBe(allNodes.length);
  });

  it('"byKind" assigns every node to exactly one cluster', () => {
    const out = cluster('byKind', { nodes: allNodes });
    const total = out.reduce((acc, c) => acc + c.nodeIds.length, 0);
    expect(total).toBe(allNodes.length);
  });

  it('"byBranchOrTier" produces deterministic, sorted output', () => {
    const a = cluster('byBranchOrTier', { nodes: allNodes });
    const b = cluster('byBranchOrTier', { nodes: allNodes });
    expect(a.map((c) => c.label)).toEqual(b.map((c) => c.label));
  });

  it('"byCostBand" only emits the canonical band labels', () => {
    const out = cluster('byCostBand', { nodes: allNodes });
    const allowed = new Set([
      'Cheap (≤10g)',
      'Mid (11–25g)',
      'Pricey (26–50g)',
      'Late game (>50g)',
      'No cost data',
    ]);
    for (const c of out) {
      expect(allowed.has(c.label)).toBe(true);
    }
  });

  it('"byComponent" reproduces a known disconnected graph', () => {
    // Synthetic: two pairs of nodes connected within each pair only.
    const nodes = allNodes.slice(0, 4);
    const adjacency = new Map<string, string[]>([
      [nodes[0].id, [nodes[1].id]],
      [nodes[1].id, [nodes[0].id]],
      [nodes[2].id, [nodes[3].id]],
      [nodes[3].id, [nodes[2].id]],
    ]);
    const out = cluster('byComponent', { nodes, adjacency });
    expect(out.length).toBe(2);
    for (const c of out) expect(c.nodeIds.length).toBe(2);
  });
});
