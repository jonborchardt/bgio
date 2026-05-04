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
import { ADJACENCY_RULES } from '../data/adjacency.ts';

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
  | 'building-requires-tech'
  /** A science card's color maps to a tech branch (red → Fighting,
   *  gold → Exploration, green → Civic, blue → Education — see
   *  src/game/roles/science/setup.ts). Only emitted from the **top
   *  tier** cell of each color (currently `advanced` / L2), pointing
   *  at every tech in that branch. The lower-tier cells link to the
   *  top-tier cell via `science-cell-prereq`, so a tech's full chain
   *  reads bottom→top through the science column.
   *  Source = top-tier science card, target = tech. */
  | 'science-rewards-tech'
  /** Within a single color column, each higher-tier science cell
   *  depends on the next-lower-tier cell. The data uses the tiers
   *  `beginner` / `intermediate` / `advanced` (and `level` 0/1/2/3
   *  for future content). We sort cells of one color by `level` and
   *  chain them in order. Source = higher tier, target = lower tier. */
  | 'science-cell-prereq';

export const ALL_EDGE_KINDS: ReadonlyArray<EdgeKind> = [
  'tech-unlocks-building',
  'tech-unlocks-unit',
  'tech-event-link',
  'unit-requires-tech',
  'unit-requires-building',
  'building-adjacent',
  'tech-prereq-tech',
  'building-requires-tech',
  'science-rewards-tech',
  'science-cell-prereq',
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
 *
 * - `tech-unlocks-building` and `tech-unlocks-unit` already store the
 *   prereq as `source` (the tech) and the dependent as `target`.
 * - `unit-requires-tech` and `unit-requires-building` store the
 *   dependent as `source` (the unit) — flipped.
 * - `tech-event-link` and `building-adjacent` are not prerequisite
 *   relationships; return null so layout does not order against them.
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
      // Source = the later tech, target = the prereq.
      return { prereq: edge.target, dependent: edge.source };
    case 'science-rewards-tech':
      // The science card "produces" the tech — semantically the science
      // card is upstream (a source of techs), so it sits as the prereq
      // and the tech as its dependent.
      return { prereq: edge.source, dependent: edge.target };
    case 'science-cell-prereq':
      // Source = higher-tier cell (depends on lower), target = lower-tier
      // cell (the prereq). Layout puts target above source.
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
  'science-rewards-tech': 'Science → Tech (rewards)',
  'science-cell-prereq': 'Science → Science (level)',
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

// Split a comma- or "+"-separated text field into trimmed name tokens.
// Empty tokens are dropped. Tolerates "Foo + Bar, Baz" and similar.
const splitNames = (raw: string): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(/[,+]/)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter((s) => s.length > 0);
};

const stripParenthetical = (s: string): string => s.replace(/\s*\(.*$/, '').trim();

// Pull the prereq tech tokens out of a TechnologyDef.order string.
// Forms in the data:
//   "free"                                        → []
//   "after Loot store"                             → ["Loot store"]
//   "after Loot store + Packing"                   → ["Loot store", "Packing"]
//   "after Loot corpse + Packing"                  → ["Loot corpse", "Packing"]
// Anything before "after " is informational and dropped.
const parseOrderPrereqs = (raw: string): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  const lower = raw.toLowerCase();
  if (lower === 'free' || lower === 'starter' || lower === 'none') return [];
  // Find the substring after the "after " marker (if present).
  const idx = lower.indexOf('after ');
  const tail = idx >= 0 ? raw.slice(idx + 'after '.length) : raw;
  return splitNames(tail);
};

// Pull the "Requires X + Y + ..." tokens out of a free-text note.
// Forms in the data:
//   "Requires Farming. Stores grain..."
//   "Requires Library (tech) + Reading. Shelf..."
//   "Requires Public Health + Refrigeration. Wings..."
// Returns [] when the note has no "Requires" sentence.
const parseNoteRequires = (raw: string): string[] => {
  if (typeof raw !== 'string') return [];
  const m = raw.match(/Requires\s+([^.]+)\./i);
  if (!m) return [];
  return splitNames(m[1]);
};

// Best-effort: try to resolve a token against techs first (most specific
// for unit `requires`), then buildings. Returns the resolved id or
// undefined.
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
 * gameplay-state-derived edges. Currently used to override the
 * default depth-derived `science-rewards-tech` mapping with the
 * actual per-cell tech assignment in `G.science.underCards`, so
 * the canonical card view in the relationships modal matches the
 * specific 4 techs shown on the in-game science card.
 *
 * Kept as a structural type (not the full `SettlementState`) so
 * tests don't need to seed unrelated state slots.
 */
export interface MatchStateForGraph {
  science?: {
    underCards?: Record<string, ReadonlyArray<{ name: string }>>;
  };
}

export const buildCardGraph = (match?: MatchStateForGraph): CardGraph => {
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

    // Buildings
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

    // Units
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

    // Events — only via the typed `unlockEvents` (the legacy color-event
    // strings are effect-text, not card references).
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

    // Tech prereqs from the `order` field. Source = this tech, target =
    // the prereq tech. We then normalize via prereqDirection at layout
    // time (top = prereq, bottom = dependent).
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
  // `note` field ("Requires Farming", "Requires Public Health +
  // Refrigeration", etc.). Source = building, target = tech.
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
      // Some "Requires X (building)" notes name another building (e.g.
      // "Requires Knives + Forge (building)") — emit no edge but skip
      // the warning when the token resolves to a building, so we don't
      // spam warnings for a known authoring convention.
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
    if (!sourceId) {
      // The adjacency loader already validates against BUILDINGS, so
      // this should be unreachable — keep the safety check anyway.
      continue;
    }
    if (rule.whenAdjacentTo === '*') {
      // Self-loop encodes "applies next to any building." React Flow
      // tolerates self-loops; the layout code de-prioritizes them.
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
    // Use a deterministic ordering so building↔A and A↔building collapse
    // to one edge.
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

  // Science cell graph wiring. Two relationships:
  //
  //   1. `science-cell-prereq` — within a single color column, each
  //      higher-tier cell depends on the next-lower-tier cell.
  //
  //   2. `science-rewards-tech` — each tech depends on **exactly one**
  //      science cell, picked by the tech's prereq-chain depth in the
  //      `order` field:
  //         depth 0 (`order: "free"`)        → cell at tier `beginner`
  //         depth 1 ("after X")               → cell at tier `intermediate`
  //         depth ≥2 ("after X + Y", deeper) → cell at tier `advanced`
  //      This distributes techs naturally across the column instead of
  //      collapsing them all at the top, and is derived from existing
  //      authoring data (no new fields required).
  const COLOR_TO_BRANCH: Record<'red' | 'gold' | 'green' | 'blue', string> = {
    red: 'Fighting',
    gold: 'Exploration',
    green: 'Civic',
    blue: 'Education',
  };

  // Lookup techs by lowercase name for the depth walk.
  const techByName = new Map<string, { node: typeof nodes[number]; def: import('../data/schema.ts').TechnologyDef }>();
  for (const node of nodes) {
    if (node.kind !== 'tech') continue;
    const def = node.entry.def as import('../data/schema.ts').TechnologyDef;
    techByName.set(def.name.toLowerCase(), { node, def });
  }

  // Memoized longest-path depth over the order field. Cycle guard
  // breaks any accidental loops in content (returns 0 mid-cycle).
  const techDepths = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (name: string): number => {
    const key = name.toLowerCase();
    if (techDepths.has(key)) return techDepths.get(key)!;
    if (visiting.has(key)) return 0;
    const entry = techByName.get(key);
    if (!entry) {
      techDepths.set(key, 0);
      return 0;
    }
    visiting.add(key);
    const prereqs = parseOrderPrereqs(entry.def.order);
    let max = 0;
    for (const p of prereqs) {
      const d = depthOf(p);
      if (d + 1 > max) max = d + 1;
    }
    visiting.delete(key);
    techDepths.set(key, max);
    return max;
  };
  for (const [, entry] of techByName) depthOf(entry.def.name);

  type ScienceTierLocal = 'beginner' | 'intermediate' | 'advanced';
  const tierForDepth = (d: number): ScienceTierLocal => {
    if (d <= 0) return 'beginner';
    if (d === 1) return 'intermediate';
    return 'advanced';
  };

  // Cell lookup: (color, tier) → node id.
  type ScienceLocal = import('../data/scienceCards.ts').CanonicalScienceCardDef;
  const cellByColorTier = new Map<string, typeof nodes[number]>();
  const cellsByColor = new Map<string, typeof nodes[number][]>();
  for (const node of nodes) {
    if (node.kind !== 'science') continue;
    const science = node.entry.def as ScienceLocal;
    cellByColorTier.set(`${science.color}|${science.tier}`, node);
    const arr = cellsByColor.get(science.color);
    if (arr) arr.push(node);
    else cellsByColor.set(science.color, [node]);
  }

  // Cell-to-cell prereq chain per color column.
  for (const [, cellNodes] of cellsByColor) {
    const sorted = [...cellNodes].sort((a, b) => {
      const ad = (a.entry.def as ScienceLocal).level;
      const bd = (b.entry.def as ScienceLocal).level;
      return ad - bd;
    });
    for (let i = 1; i < sorted.length; i++) {
      const higher = sorted[i];
      const lower = sorted[i - 1];
      edges.push({
        id: nextId(),
        kind: 'science-cell-prereq',
        source: higher.id,
        target: lower.id,
        label: `L${(lower.entry.def as ScienceLocal).level} → L${(higher.entry.def as ScienceLocal).level}`,
      });
    }
  }

  // Two emission paths:
  //
  //   - With a live match: read `G.science.underCards` and emit one
  //     edge per (cell, tech) pair that the match actually placed.
  //     This makes the modal's "Reward" list match the in-game card.
  //
  //   - Without a live match (tests, design review): fall back to the
  //     depth-derivation heuristic — each tech gets one edge from the
  //     cell tier matching its prereq-chain depth.
  //
  // The match path uses the variant id stored under each cell to look
  // up the canonical cell node.
  const branchToColor: Record<string, 'red' | 'gold' | 'green' | 'blue'> = {};
  for (const [color, branch] of Object.entries(COLOR_TO_BRANCH)) {
    branchToColor[branch] = color as 'red' | 'gold' | 'green' | 'blue';
  }

  if (match?.science?.underCards) {
    // Variant id → canonical cell node lookup. The variant id is the
    // raw `ScienceCardDef.id`; we find which canonical cell contains
    // that variant by walking the cell list once.
    const cellByVariantId = new Map<string, typeof nodes[number]>();
    for (const node of nodes) {
      if (node.kind !== 'science') continue;
      const science = node.entry.def as ScienceLocal;
      for (const v of science.variants) {
        cellByVariantId.set(v.id, node);
      }
    }
    for (const [variantId, techs] of Object.entries(match.science.underCards)) {
      const cellNode = cellByVariantId.get(variantId);
      if (!cellNode) continue;
      for (const tech of techs) {
        const techNodeEntry = techByName.get(tech.name.toLowerCase());
        if (!techNodeEntry) continue;
        edges.push({
          id: nextId(),
          kind: 'science-rewards-tech',
          source: cellNode.id,
          target: techNodeEntry.node.id,
          label: `placed in this match`,
        });
      }
    }
  } else {
    for (const [, entry] of techByName) {
      const color = branchToColor[entry.def.branch];
      if (!color) continue;
      const depth = techDepths.get(entry.def.name.toLowerCase()) ?? 0;
      const tier = tierForDepth(depth);
      // If the chosen tier doesn't exist in the deck (e.g. only 2 of 3
      // tiers present in trimmed-down content), fall back to the
      // highest available tier in this color column so the tech still
      // gets one edge.
      let cellNode = cellByColorTier.get(`${color}|${tier}`);
      if (!cellNode) {
        const cells = cellsByColor.get(color) ?? [];
        const sortedDesc = [...cells].sort(
          (a, b) =>
            (b.entry.def as ScienceLocal).level -
            (a.entry.def as ScienceLocal).level,
        );
        cellNode = sortedDesc[0];
      }
      if (!cellNode) continue;
      edges.push({
        id: nextId(),
        kind: 'science-rewards-tech',
        source: cellNode.id,
        target: entry.node.id,
        label: `depth ${depth} → ${tier}`,
      });
    }
  }

  // Sanity: every adjacency rule's defID resolves through findBuildingId.
  // (idForBuilding is just used to silence the "unused import" lint when
  // adjacency rules happen to be empty — it's the same id format the
  // resolver returns.)
  void idForBuilding;

  // Dedupe: the same dependency is often encoded twice in the JSON
  // (e.g. a tech lists `units: "Jeep Archer"` and the unit lists
  // `requires: "Hotwire car + Driving"`). `collisionClassFor` collapses
  // those mirror pairs to a single canonical edge, keeping the first
  // one we emitted (tech-side first, since the tech loop runs before
  // the unit/building loops above).
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

  // Transitive reduction over the unified prereq DAG. If "Jeep Archer"
  // → Driving exists AND "Jeep Archer" → Hotwire car → Driving also
  // exists, drop the direct edge — the chain expresses the dependency
  // more honestly. Applies across all prereq edge kinds at once
  // (unit-requires-tech, tech-prereq-tech, building-requires-tech,
  // tech-unlocks-*, science-cell-prereq, science-rewards-tech). Edges
  // without prereq semantics (event-link, adjacency) pass through.
  //
  // Algorithm: for each prereq edge (dependent → prereq) — using the
  // canonical direction from `prereqDirection` — BFS the dependent's
  // *other* direct prereqs and see if any of them reaches the prereq
  // transitively. If yes, the direct edge is redundant.
  const adj = new Map<string, Set<string>>(); // dependent → set of prereqs
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
  // Memoized reachability: from `start`, what prereqs are reachable
  // following any number of prereq edges? Computed lazily and cached.
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
