// 08.6 — Tech-card effect tests.
//
// Covers:
// - `applyTechOnAcquire` dispatches `onAcquireEffects` for the holder.
// - `techPassives(G, holder)` returns concatenated passive effects
//   from every tech-card hand the seat owns.
// - The schema rejects unknown effect kinds via the dispatcher's throw
//   (via dispatcher.test.ts level: any tech with a bogus effect kind
//   surfaces as an error when dispatched).
// - All entries in technologies.json parse without throwing.
// - `chiefPlayTech` with non-empty `onPlayEffects` fires effects;
//   `domesticPlayTech` on a tech in a different role's hand returns
//   INVALID_MOVE; tech with empty `onPlay` rejects with INVALID_MOVE.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  applyTechOnAcquire,
  techPassives,
} from '../../src/game/tech/effects.ts';
import { chiefPlayTech } from '../../src/game/roles/chief/playTech.ts';
import { domesticPlayTech } from '../../src/game/roles/domestic/playTech.ts';
import { dispatch } from '../../src/game/events/dispatcher.ts';
import {
  fromBgio,
  type BgioRandomLike,
} from '../../src/game/random.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { assignRoles } from '../../src/game/roles.ts';
import type { SettlementState } from '../../src/game/types.ts';
import type { TechnologyDef } from '../../src/data/schema.ts';
import type { EventCardDef } from '../../src/game/events/state.ts';
import { TECHNOLOGIES } from '../../src/data/index.ts';
import { validateTechnologies } from '../../src/data/schema.ts';
import { initialMats } from '../../src/game/resources/playerMat.ts';

const identityRandom: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
};

const stubCtx = (): Ctx =>
  ({
    numPlayers: 4,
    playOrder: ['0', '1', '2', '3'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'othersPhase',
    activePlayers: {},
  }) as unknown as Ctx;

const build4pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
  return {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    mats: initialMats(roleAssignments),
    ...partial,
  };
};

const baseTech = (overrides: Partial<TechnologyDef> = {}): TechnologyDef => ({
  branch: 'Exploration',
  name: 'Test Tech',
  order: '',
  cost: '',
  buildings: '',
  units: '',
  blueEvent: '',
  greenEvent: '',
  redEvent: '',
  goldEvent: '',
  ...overrides,
});

describe('applyTechOnAcquire (08.6)', () => {
  it('dispatches onAcquireEffects to credit the bank', () => {
    const G = build4pState({ bank: bagOf({ gold: 1 }) });
    const tech = baseTech({
      name: 'Loot Cache',
      onAcquireEffects: [
        { kind: 'gainResource', bag: { gold: 3 }, target: 'bank' },
      ],
    });

    applyTechOnAcquire(G, stubCtx(), fromBgio(identityRandom), '0', tech);

    expect(G.bank.gold).toBe(4);
  });

  it('no-ops when the tech has no onAcquireEffects', () => {
    const G = build4pState({ bank: bagOf({ gold: 5 }) });
    const tech = baseTech({ name: 'Boring Tech' });

    expect(() =>
      applyTechOnAcquire(G, stubCtx(), fromBgio(identityRandom), '0', tech),
    ).not.toThrow();
    expect(G.bank.gold).toBe(5);
  });

  it('no-ops with an explicit empty onAcquireEffects array', () => {
    const G = build4pState({ bank: bagOf({ gold: 0 }) });
    const tech = baseTech({
      name: 'Empty',
      onAcquireEffects: [],
    });

    applyTechOnAcquire(G, stubCtx(), fromBgio(identityRandom), '0', tech);
    expect(G.bank.gold).toBe(0);
  });
});

describe('techPassives (08.6)', () => {
  it('returns concat of every passive effect from the holder seat\'s tech hands', () => {
    const sciencePassive: TechnologyDef = baseTech({
      name: 'sci-passive-1',
      passiveEffects: [{ kind: 'doubleScience' }],
    });
    const chiefPassive: TechnologyDef = baseTech({
      name: 'chief-passive-1',
      passiveEffects: [{ kind: 'forbidBuy' }],
    });

    // 4-player: chief is seat 0, science is seat 1.
    const G = build4pState({
      chief: { workers: 0, hand: [chiefPassive] },
      science: {
        grid: [],
        underCards: {},
        paid: {},
        completed: [],
        perRoundCompletions: 0,
        hand: [sciencePassive],
      },
    });

    expect(techPassives(G, '0')).toEqual([{ kind: 'forbidBuy' }]);
    expect(techPassives(G, '1')).toEqual([{ kind: 'doubleScience' }]);
    // Seat with neither role contributes nothing.
    expect(techPassives(G, '2')).toEqual([]);
  });

  it('skips techs with no passiveEffects', () => {
    const techWith: TechnologyDef = baseTech({
      name: 'has-passive',
      passiveEffects: [{ kind: 'forbidBuy' }],
    });
    const techWithout: TechnologyDef = baseTech({ name: 'no-passive' });

    const G = build4pState({
      chief: { workers: 0, hand: [techWith, techWithout] },
    });

    expect(techPassives(G, '0')).toEqual([{ kind: 'forbidBuy' }]);
  });

  it('returns [] for a seat with no roles', () => {
    const G = build4pState();
    expect(techPassives(G, '99')).toEqual([]);
  });
});

describe('schema / dispatcher rejects unknown effect kind (08.6)', () => {
  it('dispatch throws when a tech onAcquire references an unknown effect kind', () => {
    const G = build4pState();
    const tech = baseTech({
      name: 'Bogus',
      onAcquireEffects: [{ kind: 'totallyMadeUpKind' } as unknown],
    });

    expect(() =>
      applyTechOnAcquire(
        G,
        stubCtx(),
        fromBgio(identityRandom),
        '0',
        tech,
      ),
    ).toThrow(/unknown effect kind/);
  });

  it('the same throw fires for any bogus card payload via dispatch', () => {
    const G = build4pState();
    const card: EventCardDef = {
      id: 'evt-bogus',
      color: 'gold',
      name: 'Bogus',
      effects: [{ kind: 'somethingNew' } as unknown],
    };

    expect(() =>
      dispatch(G, stubCtx(), fromBgio(identityRandom), card),
    ).toThrow(/unknown effect kind/);
  });
});

describe('technologies.json parses without throwing (08.6)', () => {
  it('TECHNOLOGIES is loaded and frozen with all entries', () => {
    expect(TECHNOLOGIES.length).toBeGreaterThan(0);
    // Every entry has the required base fields.
    for (const t of TECHNOLOGIES) {
      expect(typeof t.branch).toBe('string');
      expect(typeof t.name).toBe('string');
    }
  });

  it('validateTechnologies accepts the optional 08.6 fields', () => {
    expect(() =>
      validateTechnologies([
        {
          branch: 'Exploration',
          name: 'Test',
          order: '',
          cost: '',
          buildings: '',
          units: '',
          blueEvent: '',
          greenEvent: '',
          redEvent: '',
          goldEvent: '',
          costBag: { gold: 2 },
          onAcquireEffects: [
            { kind: 'gainResource', bag: { gold: 1 }, target: 'bank' },
          ],
          onPlayEffects: [{ kind: 'doubleScience' }],
          passiveEffects: [{ kind: 'forbidBuy' }],
        },
      ]),
    ).not.toThrow();
  });

  it('validateTechnologies rejects a malformed costBag', () => {
    expect(() =>
      validateTechnologies([
        {
          branch: 'Exploration',
          name: 'BadCost',
          order: '',
          cost: '',
          buildings: '',
          units: '',
          blueEvent: '',
          greenEvent: '',
          redEvent: '',
          goldEvent: '',
          costBag: { glomph: 2 },
        },
      ]),
    ).toThrow(/glomph/);
  });

  it('validateTechnologies rejects a non-array onPlayEffects', () => {
    expect(() =>
      validateTechnologies([
        {
          branch: 'Exploration',
          name: 'BadEffects',
          order: '',
          cost: '',
          buildings: '',
          units: '',
          blueEvent: '',
          greenEvent: '',
          redEvent: '',
          goldEvent: '',
          onPlayEffects: 'not-an-array',
        },
      ]),
    ).toThrow(/onPlayEffects/);
  });
});

// --- PlayTech move tests ---------------------------------------------------

const callMove = (
  move: typeof chiefPlayTech,
  G: SettlementState,
  playerID: string | undefined,
  cardID: string,
): typeof INVALID_MOVE | void => {
  const mv = move as unknown as (
    a: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: stubCtx(), playerID }, cardID);
};

describe('chiefPlayTech (08.6)', () => {
  it('fires onPlayEffects when the chief plays a tech in their hand', () => {
    const tech = baseTech({
      name: 'Tax Collector',
      onPlayEffects: [
        { kind: 'gainResource', bag: { gold: 4 }, target: 'bank' },
      ],
    });
    const G = build4pState({
      bank: bagOf({ gold: 0 }),
      chief: { workers: 0, hand: [tech] },
    });

    const result = callMove(chiefPlayTech, G, '0', 'Tax Collector');
    expect(result).toBeUndefined();
    expect(G.bank.gold).toBe(4);
    // Played techs are consumed: removed from the seat's hand.
    expect(G.chief!.hand!.length).toBe(0);
  });

  it('still resolves and consumes a tech with empty onPlayEffects (no-op effect, card is removed)', () => {
    // Cards like Compass have no engine-level play effect — their value
    // lives in the per-color event reactions. Playing them must still
    // resolve the card (charge cost, remove from hand) so the player
    // gets visible feedback when they click.
    const tech = baseTech({
      name: 'Idle',
      onPlayEffects: [],
    });
    const G = build4pState({
      chief: { workers: 0, hand: [tech] },
    });

    const result = callMove(chiefPlayTech, G, '0', 'Idle');
    expect(result).toBeUndefined();
    expect(G.chief!.hand!.length).toBe(0);
  });

  it('still resolves a tech missing onPlayEffects entirely (no unlocks either)', () => {
    const tech = baseTech({ name: 'NoPlay' });
    const G = build4pState({
      chief: { workers: 0, hand: [tech] },
    });

    const result = callMove(chiefPlayTech, G, '0', 'NoPlay');
    expect(result).toBeUndefined();
    expect(G.chief!.hand!.length).toBe(0);
  });

  it('returns INVALID_MOVE when caller does not hold chief role', () => {
    const tech = baseTech({
      name: 'Tax Collector',
      onPlayEffects: [
        { kind: 'gainResource', bag: { gold: 4 }, target: 'bank' },
      ],
    });
    const G = build4pState({
      chief: { workers: 0, hand: [tech] },
    });

    // Seat 1 is science, not chief.
    const result = callMove(chiefPlayTech, G, '1', 'Tax Collector');
    expect(result).toBe(INVALID_MOVE);
  });

  it('returns INVALID_MOVE when card is not in chief hand', () => {
    const G = build4pState({
      chief: { workers: 0, hand: [] },
    });

    const result = callMove(chiefPlayTech, G, '0', 'Nothere');
    expect(result).toBe(INVALID_MOVE);
  });
});

describe('playTechStub cost-charging', () => {
  it('chief play debits the bank by costBag and resolves', () => {
    const tech = baseTech({
      name: 'Costly Plan',
      costBag: { gold: 3 },
      onPlayEffects: [
        { kind: 'gainResource', bag: { gold: 1 }, target: 'bank' },
      ],
    });
    const G = build4pState({
      bank: bagOf({ gold: 5 }),
      chief: { workers: 0, hand: [tech] },
    });

    const result = callMove(chiefPlayTech, G, '0', 'Costly Plan');
    expect(result).toBeUndefined();
    // Spent 3, then onPlayEffects credited 1 → net -2 from initial 5.
    expect(G.bank.gold).toBe(3);
    expect(G.chief!.hand!.length).toBe(0);
  });

  it('chief play returns INVALID_MOVE when bank cannot afford the costBag', () => {
    const tech = baseTech({
      name: 'Too Expensive',
      costBag: { gold: 10 },
      onPlayEffects: [{ kind: 'gainResource', bag: { gold: 1 }, target: 'bank' }],
    });
    const G = build4pState({
      bank: bagOf({ gold: 2 }),
      chief: { workers: 0, hand: [tech] },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callMove(chiefPlayTech, G, '0', 'Too Expensive');
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  // Non-chief play paths covered by domesticPlayTech tests above. The
  // defense play-tech move was retired in 1.4 (D14); Phase 2.5 will
  // reintroduce it with the new defense card economy.
});

describe('applyTechOnPlay grants unlocks', () => {
  it('pushes named building unlocks into G.domestic.hand and named units into G.defense.hand', () => {
    // Use real building / unit names so the registry lookup in
    // grantTechUnlocks resolves them.
    const tech = baseTech({
      branch: 'Civic',
      name: 'Bartering',
      buildings: 'Trading Post',
      units: 'Scout',
    });
    const G = build4pState({
      domestic: { hand: [], grid: {}, techHand: [tech] },
      defense: {
        hand: [],
        inPlay: [],
      },
    });
    // Seat 2 is domestic in 4-player.
    const result = callMove(domesticPlayTech, G, '2', 'Bartering');
    expect(result).toBeUndefined();
    expect(G.domestic!.hand.map((b) => b.name)).toContain('Trading Post');
    expect(G.defense!.hand.map((u) => u.name)).toContain('Scout');
    // Tech is consumed.
    expect(G.domestic!.techHand!.length).toBe(0);
  });

  it('does not duplicate an unlock that is already in the hand', () => {
    const trader = { name: 'Trading Post' } as unknown as { name: string };
    const tech = baseTech({
      branch: 'Civic',
      name: 'Bartering',
      buildings: 'Trading Post',
    });
    const G = build4pState({
      // Pre-seed the hand with a Trading-Post-named entry.
      domestic: {
        hand: [trader as never],
        grid: {},
        techHand: [tech],
      },
    });
    callMove(domesticPlayTech, G, '2', 'Bartering');
    // Still only one Trading Post — grant skipped the dupe.
    const tps = G.domestic!.hand.filter((b) => b.name === 'Trading Post');
    expect(tps.length).toBe(1);
  });
});

describe('domesticPlayTech wrong-role rejection (08.6)', () => {
  it('domesticPlayTech on a red tech (in defense techHand) returns INVALID_MOVE', () => {
    // Place the red tech in defense.techHand — it never reaches
    // domestic.techHand.
    const redTech = baseTech({
      branch: 'Fighting',
      name: 'Big Guns',
      onPlayEffects: [
        { kind: 'gainResource', bag: { gold: 1 }, target: 'bank' },
      ],
    });
    const G = build4pState({
      defense: {
        hand: [],
        techHand: [redTech],
        inPlay: [],
      },
      domestic: { hand: [], grid: {}, techHand: [] },
    });

    // Seat 2 is domestic in 4-player layout. Try to play "Big Guns" via
    // domesticPlayTech — it's not in domestic.techHand, so the move
    // rejects.
    const result = callMove(domesticPlayTech, G, '2', 'Big Guns');
    expect(result).toBe(INVALID_MOVE);
  });
});
