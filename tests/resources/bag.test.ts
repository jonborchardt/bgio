import { describe, expect, it } from 'vitest';
import {
  EMPTY_BAG,
  RESOURCES,
  type ResourceBag,
} from '../../src/game/resources/types.ts';
import {
  add,
  bagOf,
  canAfford,
  eq,
  sub,
  total,
} from '../../src/game/resources/bag.ts';

describe('ResourceBag', () => {
  it('EMPTY_BAG has every resource at zero and is frozen', () => {
    for (const r of RESOURCES) {
      expect(EMPTY_BAG[r]).toBe(0);
    }
    expect(Object.isFrozen(EMPTY_BAG)).toBe(true);
  });

  it('bagOf fills missing resources with zero', () => {
    const b = bagOf({ gold: 3, wood: 2 });
    expect(b.gold).toBe(3);
    expect(b.wood).toBe(2);
    expect(b.stone).toBe(0);
    expect(b.worker).toBe(0);
  });

  it('add(EMPTY_BAG, EMPTY_BAG) deep-equals EMPTY_BAG', () => {
    const sum = add(EMPTY_BAG, EMPTY_BAG);
    expect(sum).toEqual(EMPTY_BAG);
  });

  it('add returns a new object and does not mutate inputs', () => {
    const a = bagOf({ gold: 1 });
    const b: Partial<ResourceBag> = { gold: 2, wood: 4 };
    const out = add(a, b);
    expect(out).not.toBe(a);
    expect(out.gold).toBe(3);
    expect(out.wood).toBe(4);
    // Inputs unchanged.
    expect(a.gold).toBe(1);
    expect(a.wood).toBe(0);
    expect(b.wood).toBe(4);
  });

  it('sub subtracts present resources', () => {
    expect(sub(bagOf({ gold: 3 }), { gold: 2 })).toEqual(bagOf({ gold: 1 }));
  });

  it('sub throws RangeError on underflow mentioning the resource', () => {
    expect(() => sub(bagOf({ gold: 1 }), { gold: 2 })).toThrow(RangeError);
    expect(() => sub(bagOf({ gold: 1 }), { gold: 2 })).toThrow(/gold/);
  });

  it('sub does not mutate the input bag', () => {
    const a = bagOf({ gold: 5, wood: 2 });
    const out = sub(a, { gold: 1 });
    expect(out.gold).toBe(4);
    expect(a.gold).toBe(5);
    expect(out).not.toBe(a);
  });

  it('canAfford is true when have >= cost for every resource', () => {
    expect(
      canAfford(bagOf({ gold: 5, wood: 1 }), { gold: 3, wood: 1 }),
    ).toBe(true);
  });

  it('canAfford is false when any resource is short', () => {
    expect(
      canAfford(bagOf({ gold: 5, wood: 1 }), { gold: 3, wood: 2 }),
    ).toBe(false);
  });

  it('canAfford treats missing cost entries as zero', () => {
    expect(canAfford(EMPTY_BAG, {})).toBe(true);
    expect(canAfford(bagOf({ gold: 1 }), { wood: 0 })).toBe(true);
  });

  it('total sums every resource', () => {
    expect(total(EMPTY_BAG)).toBe(0);
    expect(total(bagOf({ gold: 2, wood: 3, worker: 1 }))).toBe(6);
    const all: ResourceBag = {
      gold: 1,
      wood: 1,
      stone: 1,
      steel: 1,
      horse: 1,
      food: 1,
      production: 1,
      science: 1,
      happiness: 1,
      worker: 1,
    };
    expect(total(all)).toBe(RESOURCES.length);
  });

  it('eq compares every resource', () => {
    expect(eq(EMPTY_BAG, bagOf({}))).toBe(true);
    expect(eq(bagOf({ gold: 1 }), bagOf({ gold: 1 }))).toBe(true);
    expect(eq(bagOf({ gold: 1 }), bagOf({ gold: 2 }))).toBe(false);
    expect(eq(bagOf({ gold: 1 }), bagOf({ gold: 1, wood: 1 }))).toBe(false);
  });
});
