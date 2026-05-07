// Build the typed card-relationship graph used by the dev / "?" panel.
//
// Pure function over the registry: returns nodes (one per card), edges
// (one per typed relationship), and warnings (one per unresolved name
// reference, so content authors can spot typos in the dev UI). No React
// imports — this file is reusable by tests and headless inspection
// tools.

import type { AnyCardEntry, CardKind } from './registry.ts';
import {
  ALL_CARDS,
  cardName,
  findBuildingId,
  findEventId,
  findTechId,
  findUnitId,
  idForBuilding,
} from './registry.ts';
import { ADJACENCY_RULES } from '../data/index.ts';

export type EdgeKind =
  /** A tech entry mentions a building it unlocks. */
  | 'tech-unlocks-building'
  /** A tech entry mentions a unit it unlocks. */
  | 'tech-unlocks-unit'
  /** A tech entry references one of the four event cards. */
  | 'tech-event-link'
  /** A unit's `requires` text references a tech prerequisite. */
  | 'unit-requires-tech'
  /** A unit's `requires` text references a building prerequisite. */
  | 'unit-requires-building'
  /** Two buildings appear in an adjacency rule (`*` becomes a self-loop
   *  flagged as `appliesToAll: true` on the edge). */
  | 'building-adjacent'
  /** A tech's `order` field names another tech as a prereq
   *  ("after Reading + Math"). Source = the tech, target = the prereq. */
  | 'tech-prereq-tech'
  /** A building's `note` field says "Requires X" where X is a tech.
   *  Source = building, target = tech. */
  | 'building-requires-tech';

export const ALL_EDGE_KINDS: ReadonlyArray<EdgeKind> = [
  'tech-unlocks-building',
  'tech-unlocks-unit',
  'tech-event-link',
  'unit-requires-tech',
  'unit-requires-building',
  'building-adjacent',
  'tech-prereq-tech',
  'building-requires-tech',
];

/**
 * Canonical "what kind of dependency is this?" key. Two edge kinds
 * that encode the same relationship in different directions share a
 * collision class so the deduper in `buildCardGraph` collapses them
 * to a single edge. Edge kinds without a counterpart return their
 * own kind name.
 */
const collisionClassFor = (kind: EdgeKind): string => {
  switch (kind) {
    case 'tech-unlocks-unit':
    case 'unit-requires-tech':
      return 'tech-unit-prereq';
    case 'tech-unlocks-building':
    case 'building-requires-tech':
      return 'tech-building-prereq';
    default:
      return kind;
  }
};

/**
 * Normalizes an edge to its "prereq → dependent" direction so the
 * layout can flow top (incoming / depended-on) to bottom (outgoing /
 * enables) regardless of which way the raw edge points.
 */
export const prereqDirection = (
  edge: CardEdge,
): { prereq: string; dependent: string } | null => {
  switch (edge.kind) {
    case 'tech-unlocks-building':
    case 'tech-unlocks-unit':
      return { prereq: edge.source, dependent: edge.target };
    case 'unit-requires-tech':
    case 'unit-requires-building':
    case 'building-requires-tech':
      return { prereq: edge.target, dependent: edge.source };
    case 'tech-prereq-tech':
      return { prereq: edge.target, dependent: edge.source };
    case 'tech-event-link':
    case 'building-adjacent':
      return null;
  }
};

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  'tech-unlocks-building': 'Tech → Building',
  'tech-unlocks-unit': 'Tech → Unit',
  'tech-event-link': 'Tech → Event',
  'unit-requires-tech': 'Unit → Tech (req)',
  'unit-requires-building': 'Unit → Building (req)',
  'building-adjacent': 'Building ↔ Building (adj)',
  'tech-prereq-tech': 'Tech → Tech (order)',
  'building-requires-tech': 'Building → Tech (req)',
};

export interface CardNode {
  id: string;
  kind: CardKind;
  name: string;
  entry: AnyCardEntry;
}

export interface CardEdge {
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  /** Free-text label (e.g. the original `requires` token). */
  label?: string;
}

export interface GraphWarning {
  /** Card the warning is attached to. */
  sourceId: string;
  /** Edge kind we tried to resolve. */
  kind: EdgeKind;
  /** Raw token we couldn't match. */
  token: string;
  message: string;
}

export interface CardGraph {
  nodes: ReadonlyArray<CardNode>;
  edges: ReadonlyArray<CardEdge>;
  warnings: ReadonlyArray<GraphWarning>;
}

const splitNames = (raw: string): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(/[,+]/)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter((s) => s.length > 0);
};

const stripParenthetical = (s: string): string => s.replace(/\s*\(.*$/, '').trim();

const parseOrderPrereqs = (raw: string): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  const lower = raw.toLowerCase();
  if (lower === 'free' || lower === 'starter' || lower === 'none') return [];
  const idx = lower.indexOf('after ');
  const tail = idx >= 0 ? raw.slice(idx + 'after '.length) : raw;
  return splitNames(tail);
};

const parseNoteRequires = (raw: string): string[] => {
  if (typeof raw !== 'string') return [];
  const m = raw.match(/Requires\s+([^.]+)\./i);
  if (!m) return [];
  return splitNames(m[1]);
};

const resolveUnitRequire = (
  raw: string,
): { id: string; kind: 'tech' | 'building' } | undefined => {
  const cleaned = stripParenthetical(raw);
  const tech = findTechId(cleaned);
  if (tech) return { id: tech, kind: 'tech' };
  const building = findBuildingId(cleaned);
  if (building) return { id: building, kind: 'building' };
  return undefined;
};

/**
 * Optional per-match shape that `buildCardGraph` reads to surface
 * gameplay-state-derived edges. Reserved for future hooks; today no
 * fields are consumed but kept on the public surface so call-sites
 * (e.g. `RelationshipsModalHost`) don't have to adapt when something
 * lands.
 */
export type MatchStateForGraph = object;

export const buildCardGraph = (match?: MatchStateForGraph): CardGraph => {
  void match;
  const nodes: CardNode[] = ALL_CARDS.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    name: cardName(entry),
    entry,
  }));

  const edges: CardEdge[] = [];
  const warnings: GraphWarning[] = [];
  let edgeSeq = 0;
  const nextId = () => `e${++edgeSeq}`;

  // Tech -> building / unit / event
  for (const node of nodes) {
    if (node.kind !== 'tech') continue;
    const tech = node.entry.def as import('../data/schema.ts').TechnologyDef;

    const buildingTokens = tech.unlocksBuildings ?? splitNames(tech.buildings);
    for (const token of buildingTokens) {
      const target = findBuildingId(token);
      if (target) {
        edges.push({
          id: nextId(),
          kind: 'tech-unlocks-building',
          source: node.id,
          target,
          label: token,
        });
      } else {
        warnings.push({
          sourceId: node.id,
          kind: 'tech-unlocks-building',
          token,
          message: `Tech "${tech.name}" lists building "${token}" but no building with that name exists.`,
        });
      }
    }

    const unitTokens = tech.unlocksUnits ?? splitNames(tech.units);
    for (const token of unitTokens) {
      const target = findUnitId(token);
      if (target) {
        edges.push({
          id: nextId(),
          kind: 'tech-unlocks-unit',
          source: node.id,
          target,
          label: token,
        });
      } else {
        warnings.push({
          sourceId: node.id,
          kind: 'tech-unlocks-unit',
          token,
          message: `Tech "${tech.name}" lists unit "${token}" but no unit with that name exists.`,
        });
      }
    }

    if (tech.unlockEvents) {
      for (const ref of tech.unlockEvents) {
        const target = findEventId(ref.color, ref.name);
        if (target) {
          edges.push({
            id: nextId(),
            kind: 'tech-event-link',
            source: node.id,
            target,
            label: `${ref.color}: ${ref.name}`,
          });
        } else {
          warnings.push({
            sourceId: node.id,
            kind: 'tech-event-link',
            token: `${ref.color}:${ref.name}`,
            message: `Tech "${tech.name}" links event "${ref.color}:${ref.name}" but no matching event card exists.`,
          });
        }
      }
    }

    const prereqTokens = parseOrderPrereqs(tech.order);
    for (const token of prereqTokens) {
      const target = findTechId(token);
      if (!target) {
        warnings.push({
          sourceId: node.id,
          kind: 'tech-prereq-tech',
          token,
          message: `Tech "${tech.name}" requires prereq tech "${token}" but no tech with that name exists.`,
        });
        continue;
      }
      if (target === node.id) continue;
      edges.push({
        id: nextId(),
        kind: 'tech-prereq-tech',
        source: node.id,
        target,
        label: token,
      });
    }
  }

  // Unit -> tech / building (prereqs)
  for (const node of nodes) {
    if (node.kind !== 'unit') continue;
    const unit = node.entry.def as import('../data/schema.ts').UnitDef;
    const tokens = unit.requiresList ?? splitNames(unit.requires);
    for (const token of tokens) {
      const resolved = resolveUnitRequire(token);
      if (resolved) {
        edges.push({
          id: nextId(),
          kind:
            resolved.kind === 'tech'
              ? 'unit-requires-tech'
              : 'unit-requires-building',
          source: node.id,
          target: resolved.id,
          label: token,
        });
      } else {
        warnings.push({
          sourceId: node.id,
          kind: 'unit-requires-tech',
          token,
          message: `Unit "${unit.name}" requires "${token}" which matches no tech or building.`,
        });
      }
    }
  }

  // Building -> tech requirement, parsed from the building's free-text
  // `note` field.
  for (const node of nodes) {
    if (node.kind !== 'building') continue;
    const building = node.entry.def as import('../data/schema.ts').BuildingDef;
    const tokens = parseNoteRequires(building.note);
    for (const token of tokens) {
      const cleaned = stripParenthetical(token);
      const techId = findTechId(cleaned);
      if (techId) {
        edges.push({
          id: nextId(),
          kind: 'building-requires-tech',
          source: node.id,
          target: techId,
          label: token,
        });
        continue;
      }
      if (findBuildingId(cleaned)) continue;
      warnings.push({
        sourceId: node.id,
        kind: 'building-requires-tech',
        token,
        message: `Building "${building.name}" requires "${token}" which matches no tech.`,
      });
    }
  }

  // Building <-> building adjacency
  for (const rule of ADJACENCY_RULES) {
    const sourceId = findBuildingId(rule.defID);
    if (!sourceId) continue;
    if (rule.whenAdjacentTo === '*') {
      edges.push({
        id: nextId(),
        kind: 'building-adjacent',
        source: sourceId,
        target: sourceId,
        label: '* (any neighbor)',
      });
      continue;
    }
    const targetId = findBuildingId(rule.whenAdjacentTo);
    if (!targetId) continue;
    const [a, b] =
      sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
    edges.push({
      id: nextId(),
      kind: 'building-adjacent',
      source: a,
      target: b,
      label: rule.flavor,
    });
  }

  // `idForBuilding` is referenced for parity with the resolver's id
  // format even when adjacency rules happen to be empty — keep the
  // import non-dead.
  void idForBuilding;

  // Dedupe mirror pairs (e.g. a tech lists `units: "Jeep Archer"` and
  // the unit lists `requires: "Hotwire car + Driving"`).
  const seenKeys = new Set<string>();
  const dedupedEdges: CardEdge[] = [];
  for (const e of edges) {
    const dir = prereqDirection(e);
    const key = dir
      ? `${collisionClassFor(e.kind)}|${dir.prereq}|${dir.dependent}`
      : `${e.kind}|${e.source}|${e.target}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    dedupedEdges.push(e);
  }

  // Transitive reduction: drop A→C when A→B→C exists in the prereq
  // DAG. Edges without prereq semantics pass through.
  const adj = new Map<string, Set<string>>();
  for (const e of dedupedEdges) {
    const dir = prereqDirection(e);
    if (!dir) continue;
    let s = adj.get(dir.dependent);
    if (!s) {
      s = new Set();
      adj.set(dir.dependent, s);
    }
    s.add(dir.prereq);
  }
  const reachCache = new Map<string, Set<string>>();
  const reachOf = (start: string): Set<string> => {
    const hit = reachCache.get(start);
    if (hit) return hit;
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
    reachCache.set(start, out);
    return out;
  };
  const isRedundant = (dependent: string, prereq: string): boolean => {
    const directs = adj.get(dependent);
    if (!directs) return false;
    for (const w of directs) {
      if (w === prereq) continue;
      if (reachOf(w).has(prereq)) return true;
    }
    return false;
  };
  const reducedEdges: CardEdge[] = [];
  for (const e of dedupedEdges) {
    const dir = prereqDirection(e);
    if (!dir) {
      reducedEdges.push(e);
      continue;
    }
    if (isRedundant(dir.dependent, dir.prereq)) continue;
    reducedEdges.push(e);
  }

  return {
    nodes: Object.freeze(nodes),
    edges: Object.freeze(reducedEdges),
    warnings: Object.freeze(warnings),
  };
};
