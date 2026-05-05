// Defense redesign 2.8 — tests for the defense-owned round-end hooks
// (`defense:regen-units`, `defense:clear-modifiers`).
//
// We drive the hooks directly through `runRoundEndHooks` against a stub
// state. None of the hook bodies depend on bgio's lifecycle so booting a
// full client would just add noise; the related "all hooks fire in
// order" check is covered by tests/hooks.test.ts.
//
// Importing `roles/defense/hooks.ts` (and the science / domestic / track
// modules) registers the relevant round-end hooks against the shared
// 02.5 registry as a module-load side effect. The registry is process-
// global so the registrations persist across tests; we don't reset it
// here because (a) the hooks are idempotent under same-name re-register,
// and (b) tests in this file rely on the canonical chain order produced
// by the registrations.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import {
  runRoundEndHooks,
  type RandomAPI,
} from '../../../src/game/hooks.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import { EMPTY_BAG } from '../../../src/game/resources/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { setupScience } from '../../../src/game/roles/science/setup.ts';
import { fromBgio } from '../../../src/game/random.ts';
import type { ModifierCard, TrackCardDef } from '../../../src/data/index.ts';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';
// Pull the hook-registration side effects in. The order here matches
// the canonical order documented in
// plans/defense-redesign-2.8-end-of-round-cleanup.md.
import '../../../src/game/roles/defense/hooks.ts';
import '../../../src/game/roles/science/drill.ts';
import '../../../src/game/roles/domestic/produce.ts';
import '../../../src/game/track.ts';

const stubCtx = (): Ctx =>
  ({
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'endOfRound',
    activePlayers: null,
  }) as unknown as Ctx;

const stubRandom = (): RandomAPI => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
  D6: () => 1,
});

const buildG = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
  return {
    bank: { ...EMPTY_BAG },
    centerMat: {},
    roleAssignments,
    round: 0,
    bossResolved: false,
    hands,
    mats: initialMats(roleAssignments),
    ...partial,
  };
};

// One-off helper: build a UnitInstance with an explicit defID/hp pair.
// `Scout` has hp=1 in units.json; `Brute` has hp=2; `Cutter` has hp=3.
// Tests below pin defIDs to the JSON values to keep the stat math
// readable inline.
const makeUnit = (
  defID: string,
  hp: number,
  extras: Partial<UnitInstance> = {},
): UnitInstance => ({
  id: `u:${defID}:${extras.placementOrder ?? 1}`,
  defID,
  cellKey: '1,0',
  hp,
  placementOrder: extras.placementOrder ?? 1,
  ...extras,
});

describe('defense:regen-units round-end hook (2.8)', () => {
  it('a unit at hp 1/3 with regen 1 ends the round at hp 2/3', () => {
    // The `Cutter` unit ships with hp=3, regen=0 in units.json; we use
    // it as the chassis and add an `accelerate` taught skill (+1 regen,
    // per skills.ts) so the unit ticks +1 per round.
    const damaged = makeUnit('Cutter', 1, { taughtSkills: ['accelerate'] });
    const G = buildG({ defense: { hand: [], inPlay: [damaged] } });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.defense!.inPlay[0]!.hp).toBe(2);
  });

  it('regen does not exceed effective max HP', () => {
    // `Cutter` at hp=3 (full) with accelerate +1 regen — the cap should
    // hold at the def's max (3 here, no taught reinforce).
    const fullHp = makeUnit('Cutter', 3, { taughtSkills: ['accelerate'] });
    const G = buildG({ defense: { hand: [], inPlay: [fullHp] } });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.defense!.inPlay[0]!.hp).toBe(3);
  });

  it('reinforce skill widens the cap so regen can fill +1 above def HP', () => {
    // Reinforce bumps max HP by 1 (and bumps current at teach time, but
    // the test pre-damages the unit so we observe the regen behavior in
    // isolation). Cutter's printed hp is 3; with reinforce, effective
    // max is 4. With accelerate (+1 regen), an hp=2 unit ends at hp=3.
    const u = makeUnit('Cutter', 2, {
      taughtSkills: ['reinforce', 'accelerate'],
    });
    const G = buildG({ defense: { hand: [], inPlay: [u] } });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.defense!.inPlay[0]!.hp).toBe(3);
  });

  it('a unit with regen 0 (the JSON default) is a no-op', () => {
    // Scout ships with regen=0; even at hp=0 the hook should not heal.
    const u = makeUnit('Scout', 1);
    const G = buildG({ defense: { hand: [], inPlay: [u] } });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.defense!.inPlay[0]!.hp).toBe(1);
  });

  it('drill markers are NOT cleared by the round-end sweep (persist until consumed)', () => {
    // Spec: "drill marker on a unit that didn't fire this round
    // persists into the next round." The regen hook must not touch
    // `drillToken`.
    const u = makeUnit('Scout', 1, { drillToken: true });
    const G = buildG({ defense: { hand: [], inPlay: [u] } });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.defense!.inPlay[0]!.drillToken).toBe(true);
  });

  it('no-ops when G.defense is missing', () => {
    const G = buildG();
    expect(() => runRoundEndHooks(G, stubCtx(), stubRandom())).not.toThrow();
  });
});

describe('defense:clear-modifiers round-end hook (2.8)', () => {
  it('clears track.activeModifiers at end of round', () => {
    const modifier: ModifierCard = {
      id: 'mod-1',
      kind: 'modifier',
      name: 'Test Modifier',
      phase: 1,
      description: 'A test bend.',
      durationRounds: 1,
      effect: { kind: 'doubleScience' },
    };
    const G = buildG({
      track: {
        upcoming: [],
        history: [],
        currentPhase: 1,
        activeModifiers: [modifier],
      },
    });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.track!.activeModifiers).toEqual([]);
  });

  it('no-ops when G.track is missing', () => {
    const G = buildG();
    expect(() => runRoundEndHooks(G, stubCtx(), stubRandom())).not.toThrow();
  });

  it('leaves activeModifiers undefined when never set', () => {
    const G = buildG({
      track: {
        upcoming: [] as TrackCardDef[],
        history: [],
        currentPhase: 1,
      },
    });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.track!.activeModifiers).toBeUndefined();
  });

  it('expires unconsumed track-flipped effects from G._modifiers', () => {
    // The resolver's pushModifier mirrors `card.effect` onto
    // `G._modifiers` so the dispatcher's hasModifierActive consumers
    // (e.g. scienceComplete reading `doubleScience`) see it. The hook
    // splices any unconsumed entries back out at end of round so the
    // "modifiers bend rules for one round" rule actually holds.
    const modifier: ModifierCard = {
      id: 'mod-3',
      kind: 'modifier',
      name: 'Calm Winds',
      phase: 1,
      description: '',
      durationRounds: 1,
      effect: { kind: 'doubleScience' },
    };
    const G = buildG({
      track: {
        upcoming: [],
        history: [],
        currentPhase: 1,
        activeModifiers: [modifier],
      },
      _modifiers: [{ kind: 'doubleScience' }],
    });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.track!.activeModifiers).toEqual([]);
    expect(G._modifiers).toEqual([]);
  });

  it('only removes one matching-kind entry per active card, leaving event-card residue alone', () => {
    // If an event card pushed `doubleScience` onto _modifiers earlier
    // and then a track flip pushed another, the round-end clear should
    // only remove ONE entry (the track-sourced one). The other stays.
    const modifier: ModifierCard = {
      id: 'mod-4',
      kind: 'modifier',
      name: 'Calm Winds',
      phase: 1,
      description: '',
      durationRounds: 1,
      effect: { kind: 'doubleScience' },
    };
    const G = buildG({
      track: {
        upcoming: [],
        history: [],
        currentPhase: 1,
        activeModifiers: [modifier],
      },
      _modifiers: [
        { kind: 'doubleScience' },
        { kind: 'doubleScience' },
      ],
    });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.track!.activeModifiers).toEqual([]);
    expect(G._modifiers).toEqual([{ kind: 'doubleScience' }]);
  });
});

describe('science:reset-defense-moves round-end hook (2.8)', () => {
  it('clears scienceDrillUsed and scienceTaughtUsed', () => {
    const science = setupScience(
      fromBgio({ Shuffle: <T>(a: T[]) => [...a], Number: () => 0 }),
    );
    science.scienceDrillUsed = true;
    science.scienceTaughtUsed = true;
    const G = buildG({ science });
    runRoundEndHooks(G, stubCtx(), stubRandom());
    expect(G.science!.scienceDrillUsed).toBe(false);
    expect(G.science!.scienceTaughtUsed).toBe(false);
  });
});

describe('end-of-round hook chain (2.8 — full chain executes)', () => {
  it('regen, modifier-clear, and per-round latch resets all run in one sweep', () => {
    // Wire up a state that exercises all three families simultaneously.
    const damaged = makeUnit('Cutter', 1, { taughtSkills: ['accelerate'] });
    const modifier: ModifierCard = {
      id: 'mod-2',
      kind: 'modifier',
      name: 'Order Probe Modifier',
      phase: 1,
      description: '',
      durationRounds: 1,
      effect: { kind: 'doubleScience' },
    };
    const science = setupScience(
      fromBgio({ Shuffle: <T>(a: T[]) => [...a], Number: () => 0 }),
    );
    science.scienceDrillUsed = true;
    science.scienceTaughtUsed = true;

    const G = buildG({
      defense: { hand: [], inPlay: [damaged] },
      track: {
        upcoming: [],
        history: [],
        currentPhase: 1,
        activeModifiers: [modifier],
      },
      science,
    });

    runRoundEndHooks(G, stubCtx(), stubRandom());

    expect(G.defense!.inPlay[0]!.hp).toBe(2);
    expect(G.track!.activeModifiers).toEqual([]);
    expect(G.science!.scienceDrillUsed).toBe(false);
    expect(G.science!.scienceTaughtUsed).toBe(false);
  });
});
