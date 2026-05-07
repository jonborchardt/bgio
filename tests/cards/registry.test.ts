// registry.ts smoke + invariants. The registry is the single source
// of truth for "what cards exist," so a few sanity checks go a long
// way: every entry has a unique id, the kind matches, and every
// finder roundtrips.

import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  CARD_KINDS,
  cardById,
  cardName,
  cardsOfKind,
  findBuildingId,
  findEventId,
  findTechId,
  findUnitId,
  idForBuilding,
  idForUnit,
  idForTech,
} from '../../src/cards/registry.ts';
import { BUILDINGS, UNITS, TECHNOLOGIES } from '../../src/data/index.ts';
import { EVENT_CARDS } from '../../src/data/events.ts';

describe('cards/registry', () => {
  it('exposes every kind exactly once', () => {
    expect(new Set(CARD_KINDS).size).toBe(CARD_KINDS.length);
  });

  it('has unique ids across every card', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cardById round-trips every entry', () => {
    for (const e of ALL_CARDS) {
      expect(cardById(e.id)?.id).toBe(e.id);
    }
  });

  it('cardsOfKind aggregates correctly', () => {
    const total = CARD_KINDS.reduce(
      (acc, k) => acc + cardsOfKind(k).length,
      0,
    );
    expect(total).toBe(ALL_CARDS.length);
  });

  it('cardName never returns empty string', () => {
    for (const e of ALL_CARDS) {
      expect(cardName(e).length).toBeGreaterThan(0);
    }
  });

  it('finders resolve every loader entry', () => {
    expect(findBuildingId(BUILDINGS[0].name)).toBe(idForBuilding(BUILDINGS[0]));
    expect(findUnitId(UNITS[0].name)).toBe(idForUnit(UNITS[0]));
    expect(findTechId(TECHNOLOGIES[0].name)).toBe(idForTech(TECHNOLOGIES[0]));
    expect(findEventId(EVENT_CARDS[0].color, EVENT_CARDS[0].name)).toBeTruthy();
  });

  it('finders are case-insensitive and trim whitespace', () => {
    const b = BUILDINGS[0];
    expect(findBuildingId(`  ${b.name.toUpperCase()}  `)).toBe(
      idForBuilding(b),
    );
  });

  it('finders return undefined for unknown names', () => {
    expect(findBuildingId('nonexistent-building-xyzzy')).toBeUndefined();
    expect(findUnitId('nonexistent-unit-xyzzy')).toBeUndefined();
    expect(findTechId('nonexistent-tech-xyzzy')).toBeUndefined();
  });
});
