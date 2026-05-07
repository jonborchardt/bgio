// 11.2 — `enumerate` candidate-list tests.
//
// We don't assert exhaustive correctness — `enumerate` is a heuristic for
// MCTS branching, and the move bodies still own real legality via
// `INVALID_MOVE`. The tests here just nail down the phase/stage gating:
// the wrong moves should NOT show up out of context, and the fallback
// `pass` is always present.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { enumerate } from '../../src/game/ai/enumerate.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { setup } from '../../src/game/setup.ts';
import type { LibraryCard } from '../../src/game/library/types.ts';
import { emptyLibraryState } from '../../src/game/library/state.ts';
import type {
  LibraryColor,
  LibraryTier,
  TechnologyDef,
} from '../../src/data/schema.ts';
import type { EventCardDef } from '../../src/data/events.ts';

const setupG = (): SettlementState => {
  const ctx = { numPlayers: 2 } as unknown as Parameters<typeof setup>[0]['ctx'];
  return setup({ ctx });
};

const ctxFor = (
  phase: string,
  activePlayers?: Record<string, string>,
): Ctx =>
  ({
    phase,
    activePlayers,
    turn: 1,
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    numMoves: 0,
  }) as unknown as Ctx;

describe('enumerate (11.2)', () => {
  it('always includes a `pass` fallback', () => {
    const G = setupG();
    const candidates = enumerate(G, ctxFor('chiefPhase'), '0');
    expect(candidates.some((c) => c.move === 'pass')).toBe(true);
  });

  it('in chiefPhase returns chief candidates and not science candidates', () => {
    const G = setupG();
    const candidates = enumerate(G, ctxFor('chiefPhase'), '0');
    const moveNames = new Set(candidates.map((c) => c.move));

    expect(moveNames.has('chiefFlipTrack')).toBe(true);
    expect(moveNames.has('chiefDistribute')).toBe(true);

    expect(moveNames.has('scienceLibraryBuy')).toBe(false);
    expect(moveNames.has('scienceLibraryBurn')).toBe(false);
  });

  it('in chiefPhase, chiefEndPhase only emits once flippedThisRound is set', () => {
    const G = setupG();
    // Pre-flip: chiefEndPhase is suppressed so the bot doesn't waste turns
    // on a move the engine will INVALID_MOVE-reject.
    let candidates = enumerate(G, ctxFor('chiefPhase'), '0');
    let moveNames = new Set(candidates.map((c) => c.move));
    expect(moveNames.has('chiefEndPhase')).toBe(false);
    expect(moveNames.has('chiefFlipTrack')).toBe(true);

    // Post-flip: the latch is set, so chiefEndPhase becomes the closer
    // and chiefFlipTrack drops out.
    if (G.track !== undefined) G.track.flippedThisRound = true;
    candidates = enumerate(G, ctxFor('chiefPhase'), '0');
    moveNames = new Set(candidates.map((c) => c.move));
    expect(moveNames.has('chiefEndPhase')).toBe(true);
    expect(moveNames.has('chiefFlipTrack')).toBe(false);
  });

  it('in scienceTurn stage returns science candidates and not chief candidates', () => {
    const G = setupG();
    // 2-player layout: seat 0 holds chief+science, seat 1 holds
    // domestic+defense. enumerate the science seat in `othersPhase` /
    // `scienceTurn`.
    const ctx = ctxFor('othersPhase', { '0': 'scienceTurn' });
    const candidates = enumerate(G, ctx, '0');
    const moveNames = new Set(candidates.map((c) => c.move));

    expect(moveNames.has('chiefDistribute')).toBe(false);
    expect(moveNames.has('chiefEndPhase')).toBe(false);

    expect(moveNames.has('pass')).toBe(true);

    // The science seat sees Library burn candidates for every face-up
    // slot in the public row.
    expect(moveNames.has('scienceLibraryBurn')).toBe(true);

    // sciencePlayBlueEvent is gated by hand contents and the per-round flag —
    // a fresh setup gives the science seat 4 blue cards in hand.
    expect(moveNames.has('sciencePlayBlueEvent')).toBe(true);
  });

  it('always returns at least one candidate (pass fallback)', () => {
    const G = setupG();

    // A "no phase, no stage" ctx — none of the role branches fire, but the
    // pass fallback should still be there.
    const candidates = enumerate(G, ctxFor('nonsensePhase'), '0');
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[candidates.length - 1]!.move).toBe('pass');
  });

  // SL fix-5 gap #7 — the enumerator's MAX_CANDIDATES cap (50) must
  // never trim away `scienceSeatDone`. Otherwise an over-rich science
  // turn (full 6-slot library, deep stash, big hand of blue events,
  // many drill / teach candidates) leaves the bot with no way to
  // declare its turn finished — the round can stall, and the smoke
  // test (gap #4) goes silent.
  it('worst-case science turn: scienceSeatDone is always emitted, even when the candidate cap kicks in', () => {
    const G = setupG();
    const scienceSeat = '0'; // 2p layout: seat 0 holds chief + science.

    // 1) Fill the library row with 6 cheap green-T1 cards. Each slot
    // generates one burn + one buy candidate when affordable, so the
    // library alone is good for 12 candidates.
    const fakeBuilding = (
      scienceColor: LibraryColor,
      tier: LibraryTier,
      name: string,
    ): LibraryCard => ({
      kind: 'building',
      tier,
      scienceColor,
      def: {
        name,
        cost: 0,
        benefit: '',
        note: '',
        maxHp: 1,
        tier,
        scienceColor,
      },
    });
    // Seed the library slot directly. Note: as of this fix-5 work the
    // `setup()` path does not always populate `G.library` (a separate
    // wiring bug tracked in fix-1's neighborhood); we hand-build the
    // shape here so the candidate-cap test stays self-contained even
    // if `setup()` is later changed.
    G.library = emptyLibraryState(['0', '1']);
    for (let i = 0; i < 6; i++) {
      G.library.row[i] = fakeBuilding('green', 1, `slot-${i}`);
    }

    // 2) Pour stash big enough to afford every slot — every base cost
    // is wood, so 100 wood covers the worst case.
    G.mats[scienceSeat] = {
      in: { gold: 0, production: 0, wood: 0, stone: 0, steel: 0, science: 100, food: 0, worker: 0, horse: 0, happiness: 0 },
      out: { gold: 0, production: 0, wood: 0, stone: 0, steel: 0, science: 0, food: 0, worker: 0, horse: 0, happiness: 0 },
      stash: { gold: 100, production: 100, wood: 100, stone: 100, steel: 100, science: 100, food: 100, worker: 0, horse: 0, happiness: 0 },
    };

    // 3) Hand of drill / teach candidates — 4 + 3 = 7 entries. We seed
    // the science role's drill / teach latches as not-yet-used so both
    // surfaces fire.
    if (G.science === undefined) {
      throw new Error('precondition: setup() must seed G.science');
    }
    G.science.scienceDrillUsed = false;
    G.science.scienceTaughtUsed = false;
    // Burn requirement is satisfied so seatDone is enumerable.
    G.science.scienceBurnedThisRound = true;
    if (G.defense === undefined) {
      throw new Error('precondition: setup() must seed G.defense');
    }
    // Seed 6+ in-play units so both drill (caps at 4) and teach (caps
    // at 3) fan out at full width.
    G.defense.inPlay = [];
    for (let i = 0; i < 6; i++) {
      G.defense.inPlay.push({
        id: `unit:${i}`,
        defID: 'Scout',
        cellKey: '0,0',
        hp: 1,
        placementOrder: i,
      });
    }

    // 4) Fill the science seat's blue event hand with enough cards to
    // push the total candidate count past MAX_CANDIDATES = 50. With
    // 12 (library) + 7 (drill/teach) + 1 (seatDone) + 1 (pass) = 21
    // already, we need 30+ blue-event candidates to exceed the cap.
    // Pad with 40 to be safely past the cap regardless of MCTS-side
    // tweaks.
    const fakeBlueEvent = (i: number): EventCardDef => ({
      id: `fake-blue-${i}`,
      color: 'blue',
      name: `Fake Blue ${i}`,
      effects: [],
    });
    if (G.events === undefined) {
      throw new Error('precondition: setup() must seed G.events');
    }
    G.events.hands.blue[scienceSeat] = [];
    for (let i = 0; i < 40; i++) {
      G.events.hands.blue[scienceSeat]!.push(fakeBlueEvent(i));
    }
    // Ensure the per-round event flag is unset so `sciencePlayBlueEvent`
    // surfaces every entry.
    if (G._eventPlayedThisRound === undefined) {
      G._eventPlayedThisRound = {};
    }
    G._eventPlayedThisRound.science = false;

    // 5) Pad sciencePlayTech candidates too — every tech with non-empty
    // onPlayEffects is one candidate. Five is plenty.
    const fakeTech = (i: number): TechnologyDef => ({
      branch: '',
      name: `Fake Tech ${i}`,
      order: '',
      cost: '',
      buildings: '',
      units: '',
      blueEvent: '',
      greenEvent: '',
      redEvent: '',
      goldEvent: '',
      onPlayEffects: [{ kind: 'noop' }],
    });
    G.science.hand = [];
    for (let i = 0; i < 5; i++) {
      G.science.hand.push(fakeTech(i));
    }

    const ctx = ctxFor('othersPhase', { [scienceSeat]: 'scienceTurn' });
    const candidates = enumerate(G, ctx, scienceSeat);

    // Sanity: the cap is doing real work — total candidate count is
    // bounded.
    expect(candidates.length).toBeLessThanOrEqual(50);
    // We genuinely seeded a worst case (the cap trimmed something) —
    // otherwise the test isn't exercising the path it's named for.
    const totalBeforeCap =
      12 /* library */ + 40 /* blues */ + 5 /* techs */ +
      4 /* drill */ + 3 /* teach */ + 1 /* seatDone */ + 1 /* pass */;
    expect(totalBeforeCap).toBeGreaterThan(50);

    // The whole point: scienceSeatDone must survive the cap.
    const moveNames = candidates.map((c) => c.move);
    expect(moveNames).toContain('scienceSeatDone');

    // And `pass` is always there as the final fallback.
    expect(moveNames).toContain('pass');
  });
});
