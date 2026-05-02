// Single source of truth for "what canonical card kinds exist in the game",
// their backing loaders, and their stable identifiers.
//
// Every card kind has:
//   - a `CardKind` literal (used as the discriminator on `AnyCardEntry`),
//   - a way to derive a stable `id` from a def (some loaders ship `id`,
//     others use `name`),
//   - a list of all defs of that kind (sourced from the typed loader).
//
// Anywhere code wants to talk about "all cards" it imports `ALL_CARDS`
// from here. Anywhere code wants to look up a card by id it uses
// `cardById`. The relationships graph and the relationships UI both go
// through this barrel — there is no second mapping layer between JSON
// and the visual representation.

import { BUILDINGS, UNITS, TECHNOLOGIES } from '../data/index.ts';
import type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
} from '../data/schema.ts';
import {
  SCIENCE_CANONICAL_CARDS,
  canonicalScienceCardId,
} from '../data/scienceCards.ts';
import type {
  ScienceCardDef,
  CanonicalScienceCardDef,
} from '../data/scienceCards.ts';
import { WANDER_CARDS } from '../data/wanderCards.ts';
import type { WanderCardDef } from '../data/wanderCards.ts';
import { EVENT_CARDS } from '../data/events.ts';
import type { EventCardDef } from '../data/events.ts';
import { TRADE_CARDS } from '../data/tradeCards.ts';
import type { TradeCardDef } from '../data/tradeCards.ts';
import { BATTLE_CARDS } from '../data/battleCards.ts';
import type { BattleCardDef } from '../data/battleCards.ts';

export type CardKind =
  | 'building'
  | 'unit'
  | 'tech'
  | 'science'
  | 'wander'
  | 'event'
  | 'trade'
  | 'battle';

export const CARD_KINDS: ReadonlyArray<CardKind> = [
  'building',
  'unit',
  'tech',
  'science',
  'wander',
  'event',
  'trade',
  'battle',
];

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  building: 'Buildings',
  unit: 'Units',
  tech: 'Technologies',
  science: 'Science',
  wander: 'Wander',
  event: 'Events',
  trade: 'Trade',
  battle: 'Battle',
};

export type AnyCardEntry =
  | { id: string; kind: 'building'; def: BuildingDef }
  | { id: string; kind: 'unit'; def: UnitDef }
  | { id: string; kind: 'tech'; def: TechnologyDef }
  | { id: string; kind: 'science'; def: CanonicalScienceCardDef }
  | { id: string; kind: 'wander'; def: WanderCardDef }
  | { id: string; kind: 'event'; def: EventCardDef }
  | { id: string; kind: 'trade'; def: TradeCardDef }
  | { id: string; kind: 'battle'; def: BattleCardDef };

// Stable id format: `${kind}:${name-or-id}`. Buildings, units and techs
// use `name` (no `id` field in their JSON); the rest use the def's `id`.
//
// Science is special: every (color, tier, level) cost variant collapses
// to a single canonical id. Pass either a variant or a canonical card —
// `idForScience` derives the canonical id from the (color, tier, level)
// tuple either way, so clicking `?` on an in-game variant opens the
// canonical card and the relationships graph treats it as one node.
export const idForBuilding = (def: BuildingDef): string => `building:${def.name}`;
export const idForUnit = (def: UnitDef): string => `unit:${def.name}`;
export const idForTech = (def: TechnologyDef): string => `tech:${def.name}`;
export const idForScience = (
  def: { color: ScienceCardDef['color']; tier: ScienceCardDef['tier']; level: ScienceCardDef['level'] },
): string => `science:${canonicalScienceCardId(def)}`;
export const idForWander = (def: WanderCardDef): string => `wander:${def.id}`;
export const idForEvent = (def: EventCardDef): string => `event:${def.id}`;
export const idForTrade = (def: TradeCardDef): string => `trade:${def.id}`;
export const idForBattle = (def: BattleCardDef): string => `battle:${def.id}`;

const buildingEntries: AnyCardEntry[] = BUILDINGS.map((def) => ({
  id: idForBuilding(def),
  kind: 'building' as const,
  def,
}));
const unitEntries: AnyCardEntry[] = UNITS.map((def) => ({
  id: idForUnit(def),
  kind: 'unit' as const,
  def,
}));
const techEntries: AnyCardEntry[] = TECHNOLOGIES.map((def) => ({
  id: idForTech(def),
  kind: 'tech' as const,
  def,
}));
const scienceEntries: AnyCardEntry[] = SCIENCE_CANONICAL_CARDS.map((def) => ({
  id: idForScience(def),
  kind: 'science' as const,
  def,
}));
const wanderEntries: AnyCardEntry[] = WANDER_CARDS.map((def) => ({
  id: idForWander(def),
  kind: 'wander' as const,
  def,
}));
const eventEntries: AnyCardEntry[] = EVENT_CARDS.map((def) => ({
  id: idForEvent(def),
  kind: 'event' as const,
  def,
}));
const tradeEntries: AnyCardEntry[] = TRADE_CARDS.map((def) => ({
  id: idForTrade(def),
  kind: 'trade' as const,
  def,
}));
const battleEntries: AnyCardEntry[] = BATTLE_CARDS.map((def) => ({
  id: idForBattle(def),
  kind: 'battle' as const,
  def,
}));

export const ALL_CARDS: ReadonlyArray<AnyCardEntry> = Object.freeze([
  ...buildingEntries,
  ...unitEntries,
  ...techEntries,
  ...scienceEntries,
  ...wanderEntries,
  ...eventEntries,
  ...tradeEntries,
  ...battleEntries,
]);

const byId: ReadonlyMap<string, AnyCardEntry> = (() => {
  const m = new Map<string, AnyCardEntry>();
  for (const entry of ALL_CARDS) m.set(entry.id, entry);
  return m;
})();

export const cardById = (id: string): AnyCardEntry | undefined => byId.get(id);

export const cardsOfKind = (kind: CardKind): ReadonlyArray<AnyCardEntry> =>
  ALL_CARDS.filter((c) => c.kind === kind);

// Helper: a human-readable name for any card. Used by labels, tooltips,
// search. Centralized so callers don't reach into the def shape.
//
// Science cards are the canonical (color, tier, level) entity — the
// raw cost variants are surfaced inside the card body, not in the name,
// so the name reads as one card the way the gameplay treats it.
export const cardName = (entry: AnyCardEntry): string => {
  switch (entry.kind) {
    case 'building':
      return entry.def.name;
    case 'unit':
      return entry.def.name;
    case 'tech':
      return entry.def.name;
    case 'science':
      return `${entry.def.color} L${entry.def.level} ${entry.def.tier}`;
    case 'wander':
      return entry.def.name;
    case 'event':
      return entry.def.name;
    case 'trade':
      return `Trade #${entry.def.id}`;
    case 'battle':
      return `Battle #${entry.def.id}`;
  }
};

// Best-effort lookup helpers used by the relationships graph builder. Each
// returns a stable card id, or `undefined` when the name is unrecognized
// (callers surface that as a graph warning).
const buildingsByName = new Map<string, BuildingDef>(
  BUILDINGS.map((b) => [b.name.toLowerCase(), b]),
);
const unitsByName = new Map<string, UnitDef>(
  UNITS.map((u) => [u.name.toLowerCase(), u]),
);
const techsByName = new Map<string, TechnologyDef>(
  TECHNOLOGIES.map((t) => [t.name.toLowerCase(), t]),
);
const eventsByColorName = new Map<string, EventCardDef>(
  EVENT_CARDS.map((e) => [`${e.color}:${e.name.toLowerCase()}`, e]),
);

export const findBuildingId = (name: string): string | undefined => {
  const def = buildingsByName.get(name.trim().toLowerCase());
  return def ? idForBuilding(def) : undefined;
};
export const findUnitId = (name: string): string | undefined => {
  const def = unitsByName.get(name.trim().toLowerCase());
  return def ? idForUnit(def) : undefined;
};
export const findTechId = (name: string): string | undefined => {
  const def = techsByName.get(name.trim().toLowerCase());
  return def ? idForTech(def) : undefined;
};
export const findEventId = (
  color: 'blue' | 'green' | 'red' | 'gold',
  name: string,
): string | undefined => {
  const def = eventsByColorName.get(`${color}:${name.trim().toLowerCase()}`);
  return def ? idForEvent(def) : undefined;
};
