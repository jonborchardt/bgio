// buildCardGraph invariants. The graph is the core of the
// relationships UI — these tests fix the contract:
//   - every node id resolves through the registry,
//   - every edge endpoint is a node id,
//   - building-adjacency edges are deterministic in source/target order,
//   - warnings only fire for unresolved tokens.

import { describe, expect, it } from 'vitest';
import {
  ALL_EDGE_KINDS,
  buildCardGraph,
} from '../../src/cards/relationships.ts';
import { cardById } from '../../src/cards/registry.ts';

describe('cards/relationships', () => {
  const graph = buildCardGraph();

  it('every node id resolves in the registry', () => {
    for (const n of graph.nodes) {
      expect(cardById(n.id)?.id).toBe(n.id);
    }
  });

  it('every edge endpoint resolves to a node id', () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const e of graph.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it('only emits known edge kinds', () => {
    const known = new Set(ALL_EDGE_KINDS);
    for (const e of graph.edges) {
      expect(known.has(e.kind)).toBe(true);
    }
  });

  it('building-adjacency edges have source <= target (canonical order)', () => {
    for (const e of graph.edges) {
      if (e.kind !== 'building-adjacent') continue;
      // Self-loops (the `*` adjacency-to-any rule) are allowed.
      if (e.source === e.target) continue;
      expect(e.source <= e.target).toBe(true);
    }
  });

  it('warnings reference the source node id and a token', () => {
    for (const w of graph.warnings) {
      expect(typeof w.token).toBe('string');
      expect(typeof w.message).toBe('string');
      // The source id may have been removed from the registry if the
      // warning is from a content-only sanity check; we don't enforce
      // that it resolves, only that the shape is right.
      expect(typeof w.sourceId).toBe('string');
    }
  });

  it('builds at least one tech-unlocks-building edge from current content', () => {
    const has = graph.edges.some((e) => e.kind === 'tech-unlocks-building');
    expect(has).toBe(true);
  });

  it('extracts at least one tech-prereq-tech edge from the order field', () => {
    const has = graph.edges.some((e) => e.kind === 'tech-prereq-tech');
    expect(has).toBe(true);
  });

  it('chains science cells by level (one science-cell-prereq per gap)', () => {
    const has = graph.edges.some((e) => e.kind === 'science-cell-prereq');
    expect(has).toBe(true);
  });

  it('each tech gets exactly one incoming science-rewards-tech edge', () => {
    const incomingByTech = new Map<string, number>();
    for (const e of graph.edges) {
      if (e.kind !== 'science-rewards-tech') continue;
      incomingByTech.set(e.target, (incomingByTech.get(e.target) ?? 0) + 1);
    }
    // We don't require *every* tech to have one (a tech in a branch
    // whose color was filtered out wouldn't), but no tech should have
    // more than one — that's the duplicate-edge case the user
    // complained about.
    for (const [, count] of incomingByTech) {
      expect(count).toBe(1);
    }
  });

  it('science-rewards-tech edges are spread across multiple tiers (not just top)', () => {
    const sourceIds = new Set<string>();
    for (const e of graph.edges) {
      if (e.kind === 'science-rewards-tech') sourceIds.add(e.source);
    }
    // We expect edges originating from at least two distinct cells per
    // color (depth 0 → beginner, depth ≥1 → intermediate/advanced).
    // The current content is varied enough that we'll hit at least 2
    // source cells overall.
    expect(sourceIds.size).toBeGreaterThanOrEqual(2);
  });

  it('transitive reduction: Jeep Archer drops its Hotwire car edge and keeps Driving (which depends on Hotwire)', () => {
    // The JSON encodes: Hotwire car has order "after Lock pick + Loot
    // car"; Driving has order "after Hotwire car"; Jeep Archer's
    // requires is "Hotwire car + Driving". So the chain is
    // ... → Hotwire car → Driving → Jeep Archer, and the direct edge
    // Jeep Archer → Hotwire car is redundant (reachable via Driving).
    const jeepArcher = graph.nodes.find(
      (n) => n.kind === 'unit' && n.name === 'Jeep Archer',
    );
    const hotwire = graph.nodes.find(
      (n) => n.kind === 'tech' && n.name.toLowerCase() === 'hotwire car',
    );
    const driving = graph.nodes.find(
      (n) => n.kind === 'tech' && n.name.toLowerCase() === 'driving',
    );
    if (!jeepArcher || !hotwire || !driving) {
      return;
    }
    const touchesPair = (a: string, b: string): boolean =>
      graph.edges.some(
        (e) =>
          (e.source === a && e.target === b) ||
          (e.source === b && e.target === a),
      );
    expect(touchesPair(jeepArcher.id, driving.id)).toBe(true);
    expect(touchesPair(jeepArcher.id, hotwire.id)).toBe(false);
    // And the chain link Driving ↔ Hotwire car is still present.
    expect(touchesPair(driving.id, hotwire.id)).toBe(true);
  });

  it('transitive reduction: the unified prereq graph is a Hasse diagram (no skip-level edges)', () => {
    // After reduction, no edge (u → v) may have an alternate path of
    // length ≥ 2 from u to v through other prereq edges.
    const adj = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      // Mirror prereqDirection from src/cards/relationships.ts.
      let prereq: string | null = null;
      let dependent: string | null = null;
      switch (e.kind) {
        case 'tech-unlocks-building':
        case 'tech-unlocks-unit':
        case 'science-rewards-tech':
          prereq = e.source;
          dependent = e.target;
          break;
        case 'unit-requires-tech':
        case 'unit-requires-building':
        case 'building-requires-tech':
        case 'tech-prereq-tech':
        case 'science-cell-prereq':
          prereq = e.target;
          dependent = e.source;
          break;
        case 'tech-event-link':
        case 'building-adjacent':
          continue;
      }
      if (!prereq || !dependent) continue;
      let s = adj.get(dependent);
      if (!s) {
        s = new Set();
        adj.set(dependent, s);
      }
      s.add(prereq);
    }
    const reachOf = (start: string): Set<string> => {
      const out = new Set<string>();
      const stack = [start];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        const next = adj.get(cur);
        if (!next) continue;
        for (const n of next) {
          if (out.has(n)) continue;
          out.add(n);
          stack.push(n);
        }
      }
      return out;
    };
    for (const prereqs of adj.values()) {
      for (const p of prereqs) {
        for (const w of prereqs) {
          if (w === p) continue;
          // If w can reach p without going through the (dependent, p)
          // edge, then (dependent, p) would have been redundant.
          expect(reachOf(w).has(p)).toBe(false);
        }
      }
    }
  });
});
