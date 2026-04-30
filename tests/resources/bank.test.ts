import { describe, expect, it } from 'vitest';
import { RESOURCES } from '../../src/game/resources/types.ts';
import { bagOf, eq, total } from '../../src/game/resources/bag.ts';
import {
  initialBank,
  totalResources,
  transfer,
} from '../../src/game/resources/bank.ts';
import type { SettlementState } from '../../src/game/types.ts';

describe('bank', () => {
  describe('transfer', () => {
    it('moves resources from one bag to another', () => {
      const from = bagOf({ gold: 5 });
      const to = bagOf({});
      transfer(from, to, { gold: 3 });
      expect(from.gold).toBe(2);
      expect(to.gold).toBe(3);
      // Other resources untouched on both bags.
      for (const r of RESOURCES) {
        if (r === 'gold') continue;
        expect(from[r]).toBe(0);
        expect(to[r]).toBe(0);
      }
    });

    it('throws RangeError naming the offending resource on underflow', () => {
      const from = bagOf({ gold: 1 });
      const to = bagOf({});
      expect(() => transfer(from, to, { gold: 2 })).toThrow(RangeError);
      expect(() => transfer(bagOf({ gold: 1 }), bagOf({}), { gold: 2 })).toThrow(
        /gold/,
      );
    });
  });

  describe('totalResources', () => {
    it('is invariant across a sequence of transfers between holders on G', () => {
      // Park a second bag on a per-seat mat (as a stash) so we have two
      // holders to swap between. totalResources walks G.mats, so the
      // stash's contents are summed in.
      const sideBag = bagOf({ wood: 4, stone: 1 });
      const G: SettlementState = {
        bank: bagOf({ gold: 3, wood: 2 }),
        centerMat: { tradeRequest: null },
        roleAssignments: {},
        round: 0,
        settlementsJoined: 0,
        hands: {},
        mats: {
          '1': { in: bagOf({}), out: bagOf({}), stash: sideBag },
        },
      };

      const before = totalResources(G);
      expect(before).toBe(3 + 2 + 4 + 1);

      transfer(G.bank, sideBag, { gold: 2 });
      expect(totalResources(G)).toBe(before);

      transfer(sideBag, G.bank, { wood: 3 });
      expect(totalResources(G)).toBe(before);

      transfer(G.bank, sideBag, { wood: 1, gold: 1 });
      expect(totalResources(G)).toBe(before);
    });
  });

  describe('initialBank', () => {
    it('defaults to 3 gold', () => {
      expect(eq(initialBank(), bagOf({ gold: 3 }))).toBe(true);
      expect(total(initialBank())).toBe(3);
    });

    it('override replaces the default gold value', () => {
      const b = initialBank({ gold: 5 });
      expect(b.gold).toBe(5);
      expect(total(b)).toBe(5);
    });

    it('override fully replaces — does not merge with default 3 gold', () => {
      const b = initialBank({ wood: 2 });
      expect(b.gold).toBe(0);
      expect(b.wood).toBe(2);
      // Every other slot is zero.
      for (const r of RESOURCES) {
        if (r === 'wood') continue;
        expect(b[r]).toBe(0);
      }
    });
  });
});
