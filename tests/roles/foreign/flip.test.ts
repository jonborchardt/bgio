// Tests for foreignFlipBattle / foreignAssignDamage (07.4).
//
// Direct-call style mirroring the other 07.x tests: build a minimal
// SettlementState by hand, hand the move object the same `{ G, ctx,
// playerID, events }` it'd see at runtime, and assert against the
// post-mutation state. We don't drive these through the bgio Client
// because the stage transitions go through `events.setStage`, which we
// stub in via a tiny recording fake.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  foreignFlipBattle,
  foreignFlipTrade,
} from '../../../src/game/roles/foreign/flip.ts';
import { foreignAssignDamage } from '../../../src/game/roles/foreign/assignDamage.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { STAGES } from '../../../src/game/phases/stages.ts';
import type {
  SettlementState,
  ForeignState,
} from '../../../src/game/types.ts';
import type {
  BattleCardDef,
  TradeCardDef,
} from '../../../src/data/decks.ts';
import type { DamageAllocation } from '../../../src/game/roles/foreign/battleResolver.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const emptyForeign = (): ForeignState => ({
  hand: [],
  inPlay: [],
  battleDeck: [],
  tradeDeck: [],
  inFlight: { battle: null, committed: [] },
});

const build2pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: { tradeRequest: null },
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    mats: initialMats(roleAssignments),
    foreign: emptyForeign(),
    ...partial,
  };
};

const ctxWithStage = (seat: string, stage: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: stage },
  }) as unknown as Ctx;

interface FakeEvents {
  setStage: (stage: string) => void;
  calls: string[];
}
const fakeEvents = (): FakeEvents => {
  const calls: string[] = [];
  return {
    calls,
    setStage: (stage: string) => {
      calls.push(stage);
    },
  };
};

const callFlipBattle = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  events: FakeEvents,
): typeof INVALID_MOVE | void => {
  const mv = foreignFlipBattle as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
    events: FakeEvents;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID, events });
};

const callAssignDamage = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  events: FakeEvents,
  allocations: ReadonlyArray<DamageAllocation>,
): typeof INVALID_MOVE | void => {
  const mv = foreignAssignDamage as unknown as (
    args: {
      G: SettlementState;
      ctx: Ctx;
      playerID: string | undefined;
      events: FakeEvents;
    },
    allocations: ReadonlyArray<DamageAllocation>,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID, events }, allocations);
};

const callFlipTrade = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  events: FakeEvents,
): typeof INVALID_MOVE | void => {
  const mv = foreignFlipTrade as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
    events: FakeEvents;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID, events });
};

// Battle the player WINS handily: 1 Spearman (init5 atk3 def3) vs 1 Scout
// (init5 atk1 def1). Spearman acts first (input order), kills Scout.
const easyWinCard = (): BattleCardDef => ({
  id: 'test-bat-win',
  number: 1,
  units: [{ name: 'Scout', count: 1 }],
  reward: { gold: 2 },
  failure: { tribute: { gold: 1 } },
});

// Battle the player LOSES: 1 Spearman vs 5 Spearmen — the lone Spearman
// kills one and dies. Plenty of allocations to satisfy the resolver.
const certainLossCard = (): BattleCardDef => ({
  id: 'test-bat-lose',
  number: 1,
  units: [{ name: 'Spearman', count: 5 }],
  failure: { tribute: { gold: 2, food: 1 } },
});

describe('foreignFlipBattle (07.4)', () => {
  it('flip → sets inFlight, snapshots committed, deck size -1, sets stage', () => {
    const cardA = easyWinCard();
    const cardB: BattleCardDef = { ...easyWinCard(), id: 'test-bat-2' };
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        battleDeck: [cardA, cardB],
      },
    });
    const ev = fakeEvents();
    const result = callFlipBattle(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignTurn),
      ev,
    );

    expect(result).toBeUndefined();
    expect(G.foreign!.battleDeck).toHaveLength(1);
    expect(G.foreign!.battleDeck[0]!.id).toBe('test-bat-2');
    expect(G.foreign!.inFlight.battle).toEqual(cardA);
    expect(G.foreign!.inFlight.committed).toEqual([
      { defID: 'Spearman', count: 1 },
    ]);
    expect(ev.calls).toEqual([STAGES.foreignAwaitingDamage]);
  });

  it('rejects when a battle is already in flight', () => {
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        battleDeck: [easyWinCard()],
        inFlight: {
          battle: easyWinCard(),
          committed: [{ defID: 'Spearman', count: 1 }],
        },
      },
    });
    const ev = fakeEvents();
    const result = callFlipBattle(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignTurn),
      ev,
    );
    expect(result).toBe(INVALID_MOVE);
    expect(ev.calls).toEqual([]);
  });

  it('rejects when battleDeck is empty', () => {
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        battleDeck: [],
      },
    });
    const ev = fakeEvents();
    const result = callFlipBattle(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignTurn),
      ev,
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects when caller is not in foreignTurn stage', () => {
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        battleDeck: [easyWinCard()],
      },
    });
    const ev = fakeEvents();
    const result = callFlipBattle(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignAwaitingDamage),
      ev,
    );
    expect(result).toBe(INVALID_MOVE);
  });
});

describe('foreignAssignDamage (07.4)', () => {
  it('win: Spearman vs Scout — reward credited, settlementsJoined++, inFlight cleared, stage→foreignTurn', () => {
    const card = easyWinCard();
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        inFlight: {
          battle: card,
          committed: [{ defID: 'Spearman', count: 1 }],
        },
      },
    });
    const ev = fakeEvents();
    const result = callAssignDamage(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignAwaitingDamage),
      ev,
      // Scout never gets a chance to attack — Spearman kills it on tick 1.
      // No allocations needed.
      [],
    );

    expect(result).toBeUndefined();
    expect(G.bank.gold).toBe(2);
    expect(G.settlementsJoined).toBe(1);
    expect(G.foreign!.inFlight.battle).toBeNull();
    expect(G.foreign!.inFlight.committed).toEqual([]);
    expect(G.foreign!.inPlay).toEqual([{ defID: 'Spearman', count: 1 }]);
    expect(G.foreign!.lastBattleOutcome).toBe('win');
    expect(ev.calls).toEqual([STAGES.foreignTurn]);
  });

  it('mid (insufficient allocations) → INVALID_MOVE, state unchanged', () => {
    // 1 Spearman vs 1 Cutter (also init5 atk3 def3). Both swing on tick 1
    // but Spearman is first by input order so Cutter never attacks. Force
    // a 'mid' by giving the player an UNDERPOWERED unit: Scout (atk 1, def 1)
    // vs a Spearman — the Spearman kills the Scout on tick 1; player loses,
    // not 'mid'. To force 'mid' we need allocations to be wrong.
    //
    // Easier: use Spearman vs Spearman (5 enemy spears, only 1 player) and
    // pass empty allocations — the resolver's first incoming-damage event
    // immediately returns 'mid' due to missing allocations.
    const card = certainLossCard();
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        inFlight: {
          battle: card,
          committed: [{ defID: 'Spearman', count: 1 }],
        },
      },
    });
    const before = JSON.parse(JSON.stringify(G));
    const ev = fakeEvents();
    const result = callAssignDamage(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignAwaitingDamage),
      ev,
      [], // missing allocations → resolver returns 'mid' + validation error
    );

    expect(result).toBe(INVALID_MOVE);
    // State left untouched (we returned early; Immer will roll back any
    // accidental writes the move attempted).
    expect(G).toEqual(before);
    expect(ev.calls).toEqual([]);
  });

  it('lose: schedules pendingTribute, marks othersDone, stage→done', () => {
    const card = certainLossCard();
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        inPlay: [{ defID: 'Spearman', count: 1 }],
        inFlight: {
          battle: card,
          committed: [{ defID: 'Spearman', count: 1 }],
        },
      },
    });
    const ev = fakeEvents();

    // Enough allocations to satisfy the resolver: each enemy Spearman
    // hit on the player Spearman is 3 damage. Spearman has 3 HP, so the
    // first allocation kills it. After that the resolver calls 'lose'
    // and stops asking for allocations.
    const allocations: DamageAllocation[] = [{ byUnit: { Spearman: 3 } }];

    const result = callAssignDamage(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignAwaitingDamage),
      ev,
      allocations,
    );

    expect(result).toBeUndefined();
    expect(G.foreign!.lastBattleOutcome).toBe('lose');
    expect(G.foreign!.inFlight.battle).toBeNull();
    expect(G.foreign!.pendingTribute).toEqual({ gold: 2, food: 1 });
    expect(G.othersDone).toEqual({ '1': true });
    expect(ev.calls).toEqual([STAGES.done]);
    // settlementsJoined did NOT increment.
    expect(G.settlementsJoined).toBe(0);
  });

  it('rejects when no battle is in flight', () => {
    const G = build2pState({
      foreign: emptyForeign(),
    });
    const ev = fakeEvents();
    const result = callAssignDamage(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignAwaitingDamage),
      ev,
      [],
    );
    expect(result).toBe(INVALID_MOVE);
  });
});

describe('foreignFlipTrade (07.4) — gating', () => {
  it('rejects when last battle was not a win', () => {
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        tradeDeck: [
          {
            id: 'tt-1',
            number: 1,
            required: { wood: 1 },
            reward: { gold: 2 },
          },
        ],
      },
    });
    const ev = fakeEvents();
    const result = callFlipTrade(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignTurn),
      ev,
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects when tradeDeck is empty (even after a win)', () => {
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        tradeDeck: [],
        lastBattleOutcome: 'win',
      },
    });
    const ev = fakeEvents();
    const result = callFlipTrade(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignTurn),
      ev,
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('happy: places drawn card into empty mat slot and consumes the win', () => {
    const trade: TradeCardDef = {
      id: 'tt-9',
      number: 1,
      required: { wood: 1 },
      reward: { gold: 2 },
    };
    const G = build2pState({
      foreign: {
        ...emptyForeign(),
        tradeDeck: [trade],
        lastBattleOutcome: 'win',
      },
    });
    const ev = fakeEvents();
    const result = callFlipTrade(
      G,
      '1',
      ctxWithStage('1', STAGES.foreignTurn),
      ev,
    );
    expect(result).toBeUndefined();
    expect(G.centerMat.tradeRequest).not.toBeNull();
    expect(G.centerMat.tradeRequest!.id).toBe('tt-9');
    expect(G.foreign!.tradeDeck).toEqual([]);
    expect(G.foreign!.lastBattleOutcome).toBeUndefined();
  });
});
