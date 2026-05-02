// Normalises a SampleCard into a single "what to display" descriptor so
// each variation renders only visuals, not data wrangling. The five new
// design variations all consume DisplayCard; the baseline uses the
// existing typed cards directly. A variation can be deleted in isolation
// without disturbing this file — but if all 5 design variations go away,
// this helper can also be deleted.

import type { Role } from '../../game/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { SampleCard, SampleCardKind } from './types.ts';

export type EventColor = 'blue' | 'green' | 'red' | 'gold';

export interface DisplayStat {
  label: string;
  value: string;
}

export interface DisplayEffect {
  /** Short label (e.g., "Blue (Science)" or "Benefit"). */
  label: string;
  /** The effect text. */
  text: string;
  /** Optional event color for tinting. Absent for non-event lines. */
  color?: EventColor;
  /** Optional emphasis flag; variations can render the matching role's
   *  effect more prominently. */
  emphasized?: boolean;
}

/** Card grants — buildings or units that get unlocked. Role-tagged so
 *  variations can render with per-role color (Buildings → domestic green,
 *  Units → foreign red). */
export interface DisplayGrant {
  role: 'domestic' | 'foreign';
  label: 'Buildings' | 'Units';
  items: string;
}

/** Per-role section for techs. Each entry collects everything the role
 *  receives from this tech: buildings unlocked (domestic only), units
 *  unlocked (foreign only), and the role's event line ("resources").
 *  Variations that want a "by role" view consume this; variations that
 *  prefer a "by event-color" view ignore it and read `effects` instead. */
export interface DisplayRoleSection {
  role: Role;
  color: EventColor;
  buildings?: string;
  units?: string;
  resources?: string;
}

export interface DisplayCost {
  /** Bag-of-resources cost. Empty for "free" cards. */
  bag: Array<{ resource: string; count: number }>;
  /** Optional short text used by tiny sizes (e.g., "8g"). */
  short: string;
}

export interface DisplayCard {
  kind: SampleCardKind;
  /** The role whose color "owns" this card (drives accent). */
  role: Role;
  /** Single-letter glyph for the role. */
  roleGlyph: string;
  /** Long role label ("Domestic", "Chief", …). */
  roleLabel: string;
  /** Card title (the main name). */
  title: string;
  /** Short kind label ("Building", "Unit", "Tech", "Science"). */
  kindLabel: string;
  /** Free-text subtitle shown beneath the title (branch, tier, …). */
  subtitle?: string;
  /** When > 1, indicates a count badge (army size, building copies). */
  count?: number;
  /** Card cost (may be a single-resource shortcut or a bag). */
  cost?: DisplayCost;
  /** Combat / production stats. */
  stats?: DisplayStat[];
  /** Primary benefit / effect text. */
  benefit?: string;
  /** Multiple typed effects (used by tech cards' four event lines). */
  effects?: DisplayEffect[];
  /** Card-grant lines (techs that unlock buildings or units). */
  grants?: DisplayGrant[];
  /** Per-role sections (techs only). One entry per role, each holding
   *  the buildings / units / resources that role receives. */
  roleSections?: DisplayRoleSection[];
  /** Italic flavor / note line. */
  flavor?: string;
  /** Unicode glyph used by some variations as a faint background mark. */
  motif: string;
}

const KIND_TO_ROLE: Record<SampleCardKind, Role> = {
  domesticBuilding: 'domestic',
  domesticBuildingComplex: 'domestic',
  placedVillage: 'domestic',
  scienceCard: 'science',
  scienceAdvanced: 'science',
  foreignUnit: 'foreign',
  army: 'foreign',
  chiefTech: 'chief',
  chiefTechGrant: 'chief',
};

const KIND_TO_GLYPH: Record<SampleCardKind, string> = {
  domesticBuilding: 'D',
  domesticBuildingComplex: 'D',
  placedVillage: 'V',
  scienceCard: 'S',
  scienceAdvanced: 'S',
  foreignUnit: 'F',
  army: 'A',
  chiefTech: 'C',
  chiefTechGrant: 'C',
};

const ROLE_LABEL: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  foreign: 'Foreign',
};

const KIND_LABEL: Record<SampleCardKind, string> = {
  domesticBuilding: 'Building',
  domesticBuildingComplex: 'Building',
  placedVillage: 'Village',
  scienceCard: 'Science',
  scienceAdvanced: 'Science',
  foreignUnit: 'Unit',
  army: 'Army',
  chiefTech: 'Tech',
  chiefTechGrant: 'Tech',
};

// Faint background mark used by some variations as decorative flavour.
const KIND_MOTIF: Record<SampleCardKind, string> = {
  domesticBuilding: '🏛',
  domesticBuildingComplex: '🛠',
  placedVillage: '🏠',
  scienceCard: '⚗',
  scienceAdvanced: '🧪',
  foreignUnit: '⚔',
  army: '⚔',
  chiefTech: '👑',
  chiefTechGrant: '📜',
};

const COLOR_BY_ROLE: Record<Role, EventColor> = {
  science: 'blue',
  domestic: 'green',
  foreign: 'red',
  chief: 'gold',
};

const ROLE_BY_SCIENCE_COLOR: Record<EventColor, Role> = {
  blue: 'science',
  green: 'domestic',
  red: 'foreign',
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

const compactBagText = (
  bag: Partial<ResourceBag> | undefined,
): string => {
  const list = bagToList(bag);
  if (list.length === 0) return 'free';
  return list.map((b) => `${b.count}${b.resource[0]}`).join(' ');
};

export function toDisplayCard(card: SampleCard): DisplayCard {
  const role = KIND_TO_ROLE[card.kind];
  const base = {
    kind: card.kind,
    role,
    roleGlyph: KIND_TO_GLYPH[card.kind],
    roleLabel: ROLE_LABEL[role],
    kindLabel: KIND_LABEL[card.kind],
    motif: KIND_MOTIF[card.kind],
  };

  switch (card.kind) {
    case 'domesticBuilding':
    case 'domesticBuildingComplex':
    case 'placedVillage': {
      const def = card.def;
      const bag = def.costBag ?? { gold: def.cost };
      const result: DisplayCard = {
        ...base,
        title: def.name,
        subtitle: 'Building',
        cost: { bag: bagToList(bag), short: `${def.cost}g` },
        benefit: def.benefit,
        flavor: def.note,
      };
      if (card.kind === 'placedVillage') {
        result.count = card.count;
        result.subtitle = `Village × ${card.count}`;
      }
      if (card.kind === 'domesticBuildingComplex') {
        result.subtitle = 'Building · multi-resource';
      }
      return result;
    }
    case 'foreignUnit':
    case 'army': {
      const def = card.def;
      const bag = def.costBag ?? { gold: def.cost };
      const result: DisplayCard = {
        ...base,
        title: def.name,
        subtitle: card.kind === 'army' ? `Army × ${card.count}` : 'Unit',
        cost: { bag: bagToList(bag), short: `${def.cost}g` },
        stats: [
          { label: 'ATK', value: String(def.attack) },
          { label: 'DEF', value: String(def.defense) },
          { label: 'INI', value: String(def.initiative) },
        ],
        flavor: def.note,
      };
      if (card.kind === 'army') result.count = card.count;
      if (def.requires)
        result.benefit = `Requires: ${def.requires}`;
      return result;
    }
    case 'scienceCard':
    case 'scienceAdvanced': {
      const def = card.def;
      const recipientRole = ROLE_BY_SCIENCE_COLOR[def.color];
      const cellLabel =
        `${def.color[0]!.toUpperCase()}${def.color.slice(1)} L${def.level}`;
      // Show the first variant cost as the headline cost, plus a count
      // of additional variants in the subtitle.
      const head = def.variants[0]?.cost ?? {};
      const variantCount = def.variants.length;
      return {
        ...base,
        // Science card's "role" is its color → recipient.
        role: recipientRole,
        roleLabel: ROLE_LABEL[recipientRole],
        title: cellLabel,
        subtitle: `${def.tier} · ${variantCount} variant${variantCount === 1 ? '' : 's'} · → ${ROLE_LABEL[recipientRole]}`,
        cost: { bag: bagToList(head), short: compactBagText(head) },
        benefit: `Reward: 4 random ${def.color} techs.`,
        flavor:
          'Each match places one variant in this cell. Costs differ; rewards are identical.',
      };
    }
    case 'chiefTech':
    case 'chiefTechGrant': {
      const def = card.def;
      const myColor = COLOR_BY_ROLE.chief;
      const effects: DisplayEffect[] = [];
      const myEvent = def.goldEvent;
      if (myEvent && myEvent.trim()) {
        effects.push({
          label: 'Chief',
          text: myEvent,
          color: myColor,
          emphasized: true,
        });
      }
      const others: Array<[EventColor, string]> = [
        ['blue', def.blueEvent],
        ['green', def.greenEvent],
        ['red', def.redEvent],
      ];
      for (const [c, txt] of others) {
        if (txt && txt.trim())
          effects.push({
            label: ROLE_LABEL[ROLE_BY_SCIENCE_COLOR[c]],
            text: txt,
            color: c,
          });
      }
      // Surface buildings and units as structured DisplayGrant entries
      // so variations can render each with the matching role's color
      // (Buildings → domestic green, Units → foreign red). Resource-only
      // techs like Loot store leave this empty.
      const grants: DisplayGrant[] = [];
      if (def.buildings && def.buildings.trim()) {
        grants.push({
          role: 'domestic',
          label: 'Buildings',
          items: def.buildings,
        });
      }
      if (def.units && def.units.trim()) {
        grants.push({ role: 'foreign', label: 'Units', items: def.units });
      }
      // Per-role view: every role gets its event line; domestic also
      // receives any granted buildings; foreign also receives any
      // granted units. Order: chief → science → domestic → foreign so
      // variations can rely on a stable layout.
      const roleSections: DisplayRoleSection[] = [
        {
          role: 'chief',
          color: 'gold',
          resources: def.goldEvent && def.goldEvent.trim() ? def.goldEvent : undefined,
        },
        {
          role: 'science',
          color: 'blue',
          resources: def.blueEvent && def.blueEvent.trim() ? def.blueEvent : undefined,
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
          role: 'foreign',
          color: 'red',
          units: def.units && def.units.trim() ? def.units : undefined,
          resources:
            def.redEvent && def.redEvent.trim() ? def.redEvent : undefined,
        },
      ];
      return {
        ...base,
        title: def.name,
        subtitle:
          card.kind === 'chiefTechGrant'
            ? `${def.branch} · grants cards`
            : `${def.branch} · resource events`,
        cost: { bag: bagToList(def.costBag), short: def.cost || 'free' },
        effects,
        grants: grants.length > 0 ? grants : undefined,
        roleSections,
      };
    }
  }
}
