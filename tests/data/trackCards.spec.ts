// Defense redesign 2.1 — track-card schema + loader tests.
//
// Asserts that `trackCards.json` parses cleanly through the loader (so the
// per-card validators in schema.ts and the cross-card invariants in
// trackCards.ts both pass), and that the resulting TRACK_CARDS list satisfies
// the spec's structural constraints (D19, D21).
//
// The placeholder content shipped in 2.1 is *not* balanced — these tests
// guard the *shape* of the data path so 2.2 (track state on G) and 2.3
// (the resolve algorithm) can read TRACK_CARDS without further plumbing.

import { describe, expect, it } from 'vitest';
import { TRACK_CARDS } from '../../src/data/index.ts';
import type { TrackCardDef } from '../../src/data/index.ts';
import { validateTrackCards } from '../../src/data/schema.ts';

describe('Track Card Schema (D19, D20, D21)', () => {
  describe('loader', () => {
    it('parses trackCards.json without throwing', () => {
      // The mere act of importing TRACK_CARDS already runs validation;
      // this assertion documents the expectation.
      expect(TRACK_CARDS.length).toBeGreaterThan(0);
    });

    it('returns a frozen array', () => {
      expect(Object.isFrozen(TRACK_CARDS)).toBe(true);
    });

    it('freezes each card entry so mutation throws in strict module code', () => {
      for (const card of TRACK_CARDS) {
        expect(Object.isFrozen(card), `card ${card.id} should be frozen`).toBe(
          true,
        );
      }
    });
  });

  describe('per-card schema', () => {
    it('every card has id, name, phase, description, kind', () => {
      for (const card of TRACK_CARDS) {
        expect(typeof card.id).toBe('string');
        expect(card.id.length).toBeGreaterThan(0);
        expect(typeof card.name).toBe('string');
        expect(card.name.length).toBeGreaterThan(0);
        expect(typeof card.description).toBe('string');
        expect(typeof card.phase).toBe('number');
        expect(Number.isInteger(card.phase)).toBe(true);
        expect(card.phase).toBeGreaterThanOrEqual(1);
        expect(card.phase).toBeLessThanOrEqual(10);
        expect(['threat', 'boon', 'modifier', 'boss']).toContain(card.kind);
      }
    });

    it('every threat card has direction in {N,E,S,W}, integer offset, strength >= 1', () => {
      const threats = TRACK_CARDS.filter(
        (c): c is Extract<TrackCardDef, { kind: 'threat' }> => c.kind === 'threat',
      );
      expect(threats.length).toBeGreaterThan(0);
      for (const t of threats) {
        expect(['N', 'E', 'S', 'W']).toContain(t.direction);
        expect(Number.isInteger(t.offset), `${t.id} offset`).toBe(true);
        expect(Number.isInteger(t.strength), `${t.id} strength integer`).toBe(
          true,
        );
        expect(t.strength, `${t.id} strength >= 1`).toBeGreaterThanOrEqual(1);
      }
    });

    it('every modifier card carries durationRounds >= 1 and an effect', () => {
      const modifiers = TRACK_CARDS.filter(
        (c): c is Extract<TrackCardDef, { kind: 'modifier' }> => c.kind === 'modifier',
      );
      for (const m of modifiers) {
        expect(Number.isInteger(m.durationRounds)).toBe(true);
        expect(m.durationRounds).toBeGreaterThanOrEqual(1);
        expect(m.effect).toBeDefined();
      }
    });

    it('every boon card carries an effect', () => {
      const boons = TRACK_CARDS.filter(
        (c): c is Extract<TrackCardDef, { kind: 'boon' }> => c.kind === 'boon',
      );
      for (const b of boons) {
        expect(b.effect).toBeDefined();
      }
    });

    it('IDs are unique', () => {
      const seen = new Set<string>();
      for (const card of TRACK_CARDS) {
        expect(seen.has(card.id), `duplicate id ${card.id}`).toBe(false);
        seen.add(card.id);
      }
    });
  });

  describe('phase coverage', () => {
    it('every phase 1..10 has at least one card', () => {
      const byPhase = new Map<number, TrackCardDef[]>();
      for (const c of TRACK_CARDS) {
        const arr = byPhase.get(c.phase) ?? [];
        arr.push(c);
        byPhase.set(c.phase, arr);
      }
      for (let p = 1; p <= 10; p++) {
        expect(byPhase.get(p)?.length ?? 0, `phase ${p} card count`).toBeGreaterThan(
          0,
        );
      }
    });

    it('phases 1..9 each ship at least 3 cards (the spec minimum)', () => {
      const byPhase = new Map<number, number>();
      for (const c of TRACK_CARDS) {
        byPhase.set(c.phase, (byPhase.get(c.phase) ?? 0) + 1);
      }
      for (let p = 1; p <= 9; p++) {
        expect(byPhase.get(p) ?? 0, `phase ${p} should ship >= 3 cards`).toBeGreaterThanOrEqual(
          3,
        );
      }
    });
  });

  describe('boss card (D21)', () => {
    it('exactly one boss card exists', () => {
      const bosses = TRACK_CARDS.filter((c) => c.kind === 'boss');
      expect(bosses.length).toBe(1);
    });

    it('the boss is in phase 10', () => {
      const boss = TRACK_CARDS.find((c) => c.kind === 'boss');
      expect(boss).toBeDefined();
      expect(boss!.phase).toBe(10);
    });

    it('boss thresholds are non-negative integers', () => {
      const boss = TRACK_CARDS.find((c) => c.kind === 'boss')!;
      expect(boss.kind).toBe('boss');
      if (boss.kind !== 'boss') return;
      const { science, economy } = boss.thresholds;
      for (const [name, value] of [
        ['science', science],
        ['economy', economy],
      ] as const) {
        expect(Number.isInteger(value), `${name} threshold integer`).toBe(true);
        expect(value, `${name} threshold non-negative`).toBeGreaterThanOrEqual(
          0,
        );
      }
    });

    it('boss baseAttacks is >= 1 and attackPattern has at least baseAttacks entries', () => {
      const boss = TRACK_CARDS.find((c) => c.kind === 'boss')!;
      if (boss.kind !== 'boss') return;
      expect(boss.baseAttacks).toBeGreaterThanOrEqual(1);
      // Resolver in 2.7 walks attackPattern as the boss fires; entries
      // beyond the computed attack count are ignored, but the pattern
      // shouldn't *underflow* the base attack count either.
      expect(boss.attackPattern.length).toBeGreaterThanOrEqual(boss.baseAttacks);
      for (const ap of boss.attackPattern) {
        expect(['N', 'E', 'S', 'W']).toContain(ap.direction);
        expect(Number.isInteger(ap.offset)).toBe(true);
        expect(Number.isInteger(ap.strength)).toBe(true);
        expect(ap.strength).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('validateTrackCards (negative cases)', () => {
    // Direct validator unit tests — the loader's invariant layer is exercised
    // implicitly via TRACK_CARDS above. These call validateTrackCards on
    // hand-built fragments so a future schema regression surfaces here.
    it('rejects a non-array payload', () => {
      expect(() => validateTrackCards({})).toThrow();
    });

    it('rejects a card with phase out of range', () => {
      expect(() =>
        validateTrackCards([
          {
            id: 'x',
            kind: 'threat',
            name: 'x',
            phase: 11,
            description: 'x',
            direction: 'N',
            offset: 0,
            strength: 1,
          },
        ]),
      ).toThrow(/phase/);
    });

    it('rejects a threat with an unknown direction', () => {
      expect(() =>
        validateTrackCards([
          {
            id: 'x',
            kind: 'threat',
            name: 'x',
            phase: 1,
            description: 'x',
            direction: 'Q',
            offset: 0,
            strength: 1,
          },
        ]),
      ).toThrow(/direction/);
    });

    it('rejects a threat with strength 0', () => {
      expect(() =>
        validateTrackCards([
          {
            id: 'x',
            kind: 'threat',
            name: 'x',
            phase: 1,
            description: 'x',
            direction: 'N',
            offset: 0,
            strength: 0,
          },
        ]),
      ).toThrow(/strength/);
    });

    it('rejects a threat with non-integer offset', () => {
      expect(() =>
        validateTrackCards([
          {
            id: 'x',
            kind: 'threat',
            name: 'x',
            phase: 1,
            description: 'x',
            direction: 'N',
            offset: 1.5,
            strength: 1,
          },
        ]),
      ).toThrow(/offset/);
    });

    it('rejects a card with an unknown kind', () => {
      expect(() =>
        validateTrackCards([
          {
            id: 'x',
            kind: 'mystery',
            name: 'x',
            phase: 1,
            description: 'x',
          },
        ]),
      ).toThrow(/kind/);
    });

    it('rejects a boss card with a negative threshold', () => {
      expect(() =>
        validateTrackCards([
          {
            id: 'x',
            kind: 'boss',
            name: 'x',
            phase: 10,
            description: 'x',
            baseAttacks: 4,
            thresholds: { science: -1, economy: 0 },
            attackPattern: [{ direction: 'N', offset: 0, strength: 4 }],
          },
        ]),
      ).toThrow(/non-negative/);
    });
  });
});
