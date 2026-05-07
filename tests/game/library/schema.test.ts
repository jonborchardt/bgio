// SL 1.1 smoke test — type guard accepts tagged cards, rejects untagged.

import { describe, expect, it } from 'vitest';
import {
  isLibraryCard,
  buildingToLibraryCard,
  unitToLibraryCard,
  techToLibraryCard,
  eventToLibraryCard,
} from '../../../src/game/library/types.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
} from '../../../src/data/schema.ts';
import type { EventCardDef } from '../../../src/data/events.ts';

const taggedBuilding: BuildingDef = {
  name: 'Test Hut',
  cost: 1,
  benefit: '',
  note: '',
  maxHp: 1,
  tier: 1,
  scienceColor: 'green',
};

const untaggedBuilding: BuildingDef = {
  name: 'Untagged Hut',
  cost: 1,
  benefit: '',
  note: '',
  maxHp: 1,
};

const taggedUnit: UnitDef = {
  name: 'Test Soldier',
  cost: 1,
  initiative: 1,
  attack: 1,
  hp: 1,
  altStats: '',
  requires: '',
  note: '',
  range: 1,
  regen: 0,
  firstStrike: false,
  placementBonus: [],
  tier: 2,
  scienceColor: 'red',
};

const taggedTech: TechnologyDef = {
  branch: 'Test',
  name: 'Test Tech',
  order: '1',
  cost: '',
  buildings: '',
  units: '',
  blueEvent: '',
  greenEvent: '',
  redEvent: '',
  goldEvent: '',
  tier: 3,
  scienceColor: 'blue',
};

const taggedEvent: EventCardDef = {
  id: 'test-event',
  color: 'gold',
  name: 'Test Event',
  effects: [],
  tier: 1,
  scienceColor: 'gold',
};

describe('SL 1.1 — LibraryCard schema', () => {
  it('isLibraryCard accepts a constructed library card', () => {
    const card = buildingToLibraryCard(taggedBuilding);
    expect(card).not.toBeNull();
    expect(isLibraryCard(card)).toBe(true);
  });

  it('isLibraryCard rejects an untagged building', () => {
    expect(isLibraryCard(untaggedBuilding)).toBe(false);
  });

  it('isLibraryCard rejects null / non-objects / arbitrary objects', () => {
    expect(isLibraryCard(null)).toBe(false);
    expect(isLibraryCard(undefined)).toBe(false);
    expect(isLibraryCard(42)).toBe(false);
    expect(isLibraryCard({ kind: 'building' })).toBe(false);
    expect(isLibraryCard({ kind: 'building', tier: 1 })).toBe(false);
  });

  it('all four card-kind constructors produce valid library cards', () => {
    const b = buildingToLibraryCard(taggedBuilding);
    const u = unitToLibraryCard(taggedUnit);
    const t = techToLibraryCard(taggedTech);
    const e = eventToLibraryCard(taggedEvent);
    expect(isLibraryCard(b)).toBe(true);
    expect(isLibraryCard(u)).toBe(true);
    expect(isLibraryCard(t)).toBe(true);
    expect(isLibraryCard(e)).toBe(true);
    // Discriminator narrowing works (compile + runtime).
    const all: LibraryCard[] = [b!, u!, t!, e!];
    const kinds = all.map((c) => c.kind).sort();
    expect(kinds).toEqual(['building', 'event', 'tech', 'unit']);
  });

  it('builders return null when the def is missing tags', () => {
    expect(buildingToLibraryCard(untaggedBuilding)).toBeNull();
  });
});
