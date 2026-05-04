// Display-card extractor — converts a typed game-content def
// (BuildingDef / UnitDef / TechnologyDef / CanonicalScienceCardDef) into
// a single `DisplayCard` descriptor. The v9 shell (`V9CardShell.tsx`)
// renders only this descriptor, so visuals stay decoupled from data.

import type { BuildingDef, TechnologyDef, UnitDef } from '../../data/schema.ts';
import type { CanonicalScienceCardDef } from '../../data/scienceCards.ts';
import { ADJACENCY_RULES } from '../../data/adjacency.ts';
import { findBuildingId, findTechId } from '../../cards/registry.ts';
import type { Role } from '../../game/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { CardKind } from './kindGlyphs.tsx';
import type { CardRefKind } from './CardRefChip.tsx';

export type EventColor = 'blue' | 'green' | 'red' | 'gold';

export interface DisplayStat {
  label: string;
  value: string;
}

export interface DisplayCost {
  bag: Array<{ resource: string; count: number }>;
  short: string;
}

/** Per-role section for techs. One entry per role; v9 panels render
 *  whatever lines the role receives (buildings / units / resources).
 *  Empty role sections are omitted. */
export interface DisplayRoleSection {
  role: Role;
  color: EventColor;
  buildings?: string;
  units?: string;
  resources?: string;
}

/** One token from a unit's `requires` field, paired with the resolved
 *  card kind so the renderer can plug it straight into a `CardRefChip`
 *  (and the `?` button hops to the right canonical card). Tech wins
 *  over building when both exist — that's how the relationships graph
 *  resolves the same tokens (`resolveUnitRequire` in
 *  `src/cards/relationships.ts`). Tokens that match neither still get
 *  rendered, just as plain text without a `?`. */
export interface DisplayRequiresItem {
  name: string;
  kind: CardRefKind;
}

/** One row in the building card's "Adjacency" reward block. `active` is
 *  true when this rule is currently firing for the placed building (a
 *  neighbour with the matching defID exists on the grid). For preview /
 *  in-hand rendering, every entry is `active: false` and the row reads
 *  as "if you place this next to X, gain Y." */
export interface DisplayAdjacency {
  neighbor: string;
  active: boolean;
  bonus: Array<{ resource: string; count: number }>;
}

export interface DisplayCard {
  kind: CardKind;
  /** The role whose colour "owns" this card (drives accent). */
  role: Role;
  /** Long role label ("Domestic", "Chief", …). */
  roleLabel: string;
  /** Card title. */
  title: string;
  /** Short kind label ("Building", "Unit", "Tech", "Science"). */
  kindLabel: string;
  /** Free-text subtitle (branch, tier, …). */
  subtitle?: string;
  /** Count badge (army size, building copies). Only set when > 1. */
  count?: number;
  cost?: DisplayCost;
  stats?: DisplayStat[];
  /** Plain benefit text for non-tech cards (Building / Unit / Science). */
  benefit?: string;
  /** Optional small-caps label rendered before `benefit` (e.g. "Gives"
   *  on building cards so the production line reads as a labelled
   *  reward). */
  benefitLabel?: string;
  /** Tech / building prerequisites for this card (currently units only).
   *  Rendered as a separate "Requires" line whose names are clickable
   *  `CardRefChip`s — so seeing "Requires: Bombs + Chemistry" on a unit
   *  lets the reader `?`-hop straight to the Bombs / Chemistry tech
   *  cards instead of having to know what those names refer to. */
  requires?: DisplayRequiresItem[];
  /** Per-role sections (techs only). */
  roleSections?: DisplayRoleSection[];
  /** Adjacency rules for this building, with `active` flags when context
   *  was provided. Empty / undefined for non-building cards. */
  adjacencies?: DisplayAdjacency[];
  flavor?: string;
}

const ROLE_LABEL: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  defense: 'Defense',
};

const ROLE_BY_SCIENCE_COLOR: Record<EventColor, Role> = {
  blue: 'science',
  green: 'domestic',
  red: 'defense',
  gold: 'chief',
};

const bagToList = (
  bag: Partial<ResourceBag> | undefined,
): Array<{ resource: string; count: number }> => {
  if (!bag) return [];
  const out: Array<{ resource: string; count: number }> = [];
  for (const r of RESOURCES) {
    const v = bag[r] ?? 0;
    if (v > 0) out.push({ resource: r, count: v });
  }
  return out;
};

const compactBag = (bag: Partial<ResourceBag> | undefined): string => {
  const list = bagToList(bag);
  if (list.length === 0) return 'free';
  return list.map((b) => `${b.count}${b.resource[0]}`).join(' ');
};

// Split a `requires` field on `+` / `,`, drop trailing parentheticals
// like "Forge (building)", and resolve each token to a tech (preferred)
// or building card. Mirrors `resolveUnitRequire` in
// `src/cards/relationships.ts` so the card UI and the relationships
// graph agree on how to interpret the same text.
const parseRequires = (raw: string): DisplayRequiresItem[] => {
  if (!raw) return [];
  return raw
    .split(/[,+]/)
    .map((s) => s.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter((s) => s.length > 0)
    .map((name): DisplayRequiresItem => {
      if (findTechId(name)) return { name, kind: 'tech' };
      if (findBuildingId(name)) return { name, kind: 'building' };
      // Unmatched tokens still render as text — the chip's `?` falls
      // through silently when the registry has no entry. Tagging
      // them `tech` mirrors how unit prereqs are most commonly used.
      return { name, kind: 'tech' };
    });
};

const isComplexBuilding = (def: BuildingDef): boolean => {
  if (!def.costBag) return false;
  // "Complex" = multi-resource cost (more than just gold).
  const keys = Object.keys(def.costBag);
  return keys.length > 1 || (keys.length === 1 && keys[0] !== 'gold');
};

// --- builders --------------------------------------------------------------

/** Pull every adjacency rule whose source matches `def.name`, and mark
 *  each as `active` if `activeNeighbors` (the set of neighbouring defIDs
 *  on the grid) satisfies the rule's `whenAdjacentTo` slot. */
const adjacencyRowsFor = (
  def: BuildingDef,
  activeNeighbors?: ReadonlySet<string>,
): DisplayAdjacency[] => {
  const rows: DisplayAdjacency[] = [];
  for (const rule of ADJACENCY_RULES) {
    if (rule.defID !== def.name) continue;
    const active =
      activeNeighbors !== undefined &&
      (rule.whenAdjacentTo === '*'
        ? activeNeighbors.size > 0
        : activeNeighbors.has(rule.whenAdjacentTo));
    rows.push({
      neighbor: rule.whenAdjacentTo === '*' ? 'any building' : rule.whenAdjacentTo,
      active,
      bonus: bagToList(rule.bonus),
    });
  }
  return rows;
};

export function buildingDisplay(
  def: BuildingDef,
  count?: number,
  activeNeighbors?: ReadonlySet<string>,
): DisplayCard {
  const placed = count !== undefined && count > 1;
  const bag = def.costBag ?? { gold: def.cost };
  const result: DisplayCard = {
    kind: placed
      ? 'buildingPlaced'
      : isComplexBuilding(def)
        ? 'buildingComplex'
        : 'building',
    role: 'domestic',
    roleLabel: ROLE_LABEL.domestic,
    title: def.name,
    kindLabel: placed ? 'Village' : 'Building',
    subtitle: placed ? `Placed × ${count}` : 'Building',
    cost: { bag: bagToList(bag), short: `${def.cost}g` },
    benefit: def.benefit,
    benefitLabel: 'Gives',
    adjacencies: adjacencyRowsFor(def, activeNeighbors),
    flavor: def.note,
  };
  if (placed) result.count = count;
  return result;
}

export function unitDisplay(def: UnitDef, count?: number): DisplayCard {
  const isArmy = count !== undefined && count > 1;
  const bag = def.costBag ?? { gold: def.cost };
  const result: DisplayCard = {
    kind: isArmy ? 'army' : 'unit',
    role: 'defense',
    roleLabel: ROLE_LABEL.defense,
    title: def.name,
    kindLabel: isArmy ? 'Army' : 'Unit',
    subtitle: isArmy ? `Army × ${count}` : 'Unit',
    cost: { bag: bagToList(bag), short: `${def.cost}g` },
    stats: [
      { label: 'ATK', value: String(def.attack) },
      { label: 'DEF', value: String(def.hp) },
      { label: 'INI', value: String(def.initiative) },
    ],
    flavor: def.note,
  };
  if (isArmy) result.count = count;
  if (def.requires) {
    const items = parseRequires(def.requires);
    if (items.length > 0) result.requires = items;
  }
  return result;
}

export function scienceDisplay(def: CanonicalScienceCardDef): DisplayCard {
  const recipientRole = ROLE_BY_SCIENCE_COLOR[def.color];
  const cellLabel = `${def.color[0]!.toUpperCase()}${def.color.slice(1)} L${def.level}`;
  const head = def.variants[0]?.cost ?? {};
  const variantCount = def.variants.length;
  return {
    kind: def.tier === 'advanced' ? 'scienceAdvanced' : 'science',
    role: recipientRole,
    roleLabel: ROLE_LABEL[recipientRole],
    title: cellLabel,
    kindLabel: 'Science',
    subtitle: `${def.tier} · ${variantCount} variant${variantCount === 1 ? '' : 's'} · → ${ROLE_LABEL[recipientRole]}`,
    cost: { bag: bagToList(head), short: compactBag(head) },
    benefit: `Reward: 4 random ${def.color} techs.`,
    flavor:
      'Each match places one variant in this cell. Costs differ; rewards are identical.',
  };
}

export function techDisplay(
  def: TechnologyDef,
  holderRole?: Role,
): DisplayCard {
  const grants = (def.buildings && def.buildings.trim()) ||
    (def.units && def.units.trim());
  const owner: Role = holderRole ?? 'chief';
  const roleSections: DisplayRoleSection[] = [
    {
      role: 'chief',
      color: 'gold',
      resources:
        def.goldEvent && def.goldEvent.trim() ? def.goldEvent : undefined,
    },
    {
      role: 'science',
      color: 'blue',
      resources:
        def.blueEvent && def.blueEvent.trim() ? def.blueEvent : undefined,
    },
    {
      role: 'domestic',
      color: 'green',
      buildings:
        def.buildings && def.buildings.trim() ? def.buildings : undefined,
      resources:
        def.greenEvent && def.greenEvent.trim() ? def.greenEvent : undefined,
    },
    {
      role: 'defense',
      color: 'red',
      units: def.units && def.units.trim() ? def.units : undefined,
      resources:
        def.redEvent && def.redEvent.trim() ? def.redEvent : undefined,
    },
  ];
  return {
    kind: grants ? 'techGrant' : 'tech',
    role: owner,
    roleLabel: ROLE_LABEL[owner],
    title: def.name,
    kindLabel: 'Tech',
    subtitle: `${def.branch} · ${grants ? 'grants cards' : 'resource events'}`,
    cost: { bag: bagToList(def.costBag), short: def.cost || 'free' },
    roleSections,
  };
}
