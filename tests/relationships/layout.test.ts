// Layout engines — pure functions over clusters + edges.

import { describe, expect, it } from 'vitest';
import { cluster } from '../../src/ui/relationships/clustering.ts';
import { layoutGraph } from '../../src/ui/relationships/layout.ts';
import { buildCardGraph } from '../../src/cards/relationships.ts';

describe('ui/relationships/layout', () => {
  const graph = buildCardGraph();

  for (const engine of ['dagre', 'force', 'circular', 'grid'] as const) {
    it(`"${engine}" assigns a position to every node`, () => {
      const clusters = cluster('byKind', { nodes: graph.nodes });
      const result = layoutGraph({
        clusters,
        nodes: graph.nodes,
        edges: graph.edges,
        engine,
        nodeSpacing: 50,
        clusterSpacing: 200,
      });
      for (const n of graph.nodes) {
        const p = result.positions.get(n.id);
        expect(p).toBeDefined();
        expect(Number.isFinite(p!.x)).toBe(true);
        expect(Number.isFinite(p!.y)).toBe(true);
      }
    });
  }

  it('handles an empty cluster set without throwing', () => {
    const result = layoutGraph({
      clusters: [],
      nodes: [],
      edges: [],
      engine: 'dagre',
      nodeSpacing: 50,
      clusterSpacing: 200,
    });
    expect(result.positions.size).toBe(0);
    expect(result.clusterBounds.size).toBe(0);
  });
});
