// Defense redesign 2.5 — DefenseBot + role-local enumerator tests.
//
// Drives the bot against the live `setup()` state plus a few hand-
// shaped slices to exercise:
//   - the bot returns at least `defenseSeatDone` from any state,
//   - buy + place candidates surface when the seat has affordable
//     units and at least one placeable building tile,
//   - covering placements (units in range of the telegraphed next
//     threat's path) lead the candidate list when present.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { defenseBot } from '../../src/game/ai/defenseBot.ts';
import { enumerateDefense } from '../../src/game/roles/defense/ai.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';
import type { ThreatCard } from '../../src/data/schema.ts';
import { UNITS } from '../../src/data/index.ts';
import { cellKey } from '../../src/game/roles/domestic/grid.ts';
import { bagOf } from '../../src/game/resources/bag.ts';

const ctxFor = (
  phase: string,
  activePlayers?: Record<string, string>,
  numPlayers = 4,
): Ctx =>
  ({
    phase,
    activePlayers,
    turn: 1,
    numPlayers,
    playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
    playOrderPos: 0,
    currentPlayer: '0',
    numMoves: 0,
  }) as unknown as Ctx;

const setupG = (numPlayers: 1 | 2 | 3 | 4 = 4): SettlementState => {
  const ctx = { numPlayers } as unknown as Parameters<typeof setup>[0]['ctx'];
  return setup({ ctx });
};

const synthThreat = (
  id: string,
  direction: ThreatCard['direction'],
  offset: number,
  phase = 1,
): ThreatCard => ({
  kind: 'threat',
  id,
  name: id,
  phase,
  description: '',
  direction,
  offset,
  strength: 2,
});

describe('enumerateDefense (defense redesign 2.5)', () => {
  it('returns at least defenseSeatDone from any (in-stage) state', () => {
    const G = setupG(4);
    const cands = enumerateDefense(
      G,
      ctxFor('othersPhase', { '3': 'defenseTurn' }, 4),
      '3',
    );
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[cands.length - 1]?.move).toBe('defenseSeatDone');
  });

  it('returns empty when not in defenseTurn (caller-side gate)', () => {
    const G = setupG(4);
    const cands = enumerateDefense(
      G,
      ctxFor('chiefPhase', undefined, 4),
      '3',
    );
    expect(cands).toHaveLength(0);
  });

  it('emits buy+place candidates for affordable units on placed tiles', () => {
    const G = setupG(4);
    // Seed defense's stash with enough gold to recruit a Scout (cost 2).
    G.mats['3']!.stash = bagOf({ gold: 10 });
    // Place a building so there's a non-center tile to put a unit on.
    G.domestic!.grid[cellKey(1, 0)] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 1,
    };

    const cands = enumerateDefense(
      G,
      ctxFor('othersPhase', { '3': 'defenseTurn' }, 4),
      '3',
    );
    const buys = cands.filter((c) => c.move === 'defenseBuyAndPlace');
    expect(buys.length).toBeGreaterThan(0);
    // Each buy candidate names a unit + a cellKey.
    for (const c of buys) {
      expect(c.args).toHaveLength(2);
      expect(typeof c.args[0]).toBe('string');
      expect(typeof c.args[1]).toBe('string');
    }
  });

  it('prefers placements that cover the telegraphed next-threat path', () => {
    const G = setupG(4);
    G.mats['3']!.stash = bagOf({ gold: 10 });
    // Two tiles: (1, 0) is on the column 0 path (north → center for
    // offset 0); (3, 3) is far away. With a Scout (range 1), only the
    // tile *adjacent to* the path covers it.
    //
    // The N path with offset 0 walks (0, maxY)..(0, 0). A unit at
    // (1, 0) has Chebyshev distance 1 to (0, 0) which is on the path,
    // so it covers; (3, 3) is too far.
    G.domestic!.grid[cellKey(1, 0)] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 1,
    };
    G.domestic!.grid[cellKey(3, 3)] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 1,
    };
    // Set the upcoming card to the synthetic threat so peekNext returns it.
    G.track!.upcoming = [synthThreat('threat-N-0', 'N', 0), ...G.track!.upcoming.slice(1)];

    const cands = enumerateDefense(
      G,
      ctxFor('othersPhase', { '3': 'defenseTurn' }, 4),
      '3',
    );
    const buys = cands.filter((c) => c.move === 'defenseBuyAndPlace');
    expect(buys.length).toBeGreaterThan(0);
    // When at least one covering placement exists, *only* covering
    // placements are surfaced — the leading buy candidate must target
    // (1, 0).
    for (const c of buys) {
      const cellArg = c.args[1] as string;
      expect(cellArg).toBe(cellKey(1, 0));
    }
  });
});

describe('defenseBot.play (defense redesign 2.5)', () => {
  it('returns null when not in defenseTurn', () => {
    const G = setupG(4);
    const action = defenseBot.play({
      G,
      ctx: ctxFor('chiefPhase', undefined, 4),
      playerID: '3',
    });
    expect(action).toBeNull();
  });

  it('returns null when caller does not hold the defense role', () => {
    const G = setupG(4);
    const action = defenseBot.play({
      G,
      ctx: ctxFor('othersPhase', { '2': 'defenseTurn' }, 4),
      playerID: '2',
    });
    expect(action).toBeNull();
  });

  it('returns defenseSeatDone when the seat has nothing else to do', () => {
    const G = setupG(4);
    // Stash empty + no defenseHand → only seat-done remains.
    G.mats['3']!.stash = bagOf({});
    G.defense = { hand: [], inPlay: [] };
    const action = defenseBot.play({
      G,
      ctx: ctxFor('othersPhase', { '3': 'defenseTurn' }, 4),
      playerID: '3',
    });
    expect(action).toEqual({ move: 'defenseSeatDone', args: [] });
  });

  it('prefers buy+place over seat-done when a recruit is affordable', () => {
    const G = setupG(4);
    G.mats['3']!.stash = bagOf({ gold: 10 });
    G.domestic!.grid[cellKey(1, 0)] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 1,
    };
    const action = defenseBot.play({
      G,
      ctx: ctxFor('othersPhase', { '3': 'defenseTurn' }, 4),
      playerID: '3',
    });
    expect(action?.move).toBe('defenseBuyAndPlace');
  });

  it('plan checkpoint: bot decision dispatched through move function form populates inPlay', async () => {
    // Covers the plan's "scripted run completes ... defense made at
    // least one buy+place across the run" criterion: hand-build the
    // post-chief-flip + post-domestic-placement state, ask the bot
    // what it would do, dispatch through the move's function form
    // (same surface bgio uses), and assert the resulting `inPlay`
    // entry. We don't drive a full bgio client because round-progress
    // setup conflicts with vitest's parallel sandboxing on Windows.
    const G = setupG(4);
    G.mats['3']!.stash = bagOf({ gold: 20 });
    G.domestic!.grid[cellKey(1, 0)] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 1,
    };

    const ctx = ctxFor('othersPhase', { '3': 'defenseTurn' }, 4);
    const action = defenseBot.play({ G, ctx, playerID: '3' });
    expect(action?.move).toBe('defenseBuyAndPlace');

    const { defenseBuyAndPlace } = await import(
      '../../src/game/roles/defense/buyAndPlace.ts'
    );
    const mv = defenseBuyAndPlace as unknown as (
      a: { G: typeof G; ctx: typeof ctx; playerID: string },
      u: string,
      c: string,
    ) => void;
    const [unitDefID, cellKeyArg] = action!.args as [string, string];
    mv({ G, ctx, playerID: '3' }, unitDefID, cellKeyArg);
    expect(G.defense!.inPlay.length).toBeGreaterThan(0);
    expect(G.defense!.inPlay[0]?.defID).toBe(unitDefID);
    expect(G.defense!.inPlay[0]?.cellKey).toBe(cellKeyArg);
  });
});

// Sanity: the starter hand the setup wires for defense includes the
// no-`requires` units in `units.json`. If that pool ever shrinks below
// 3 the role's first round becomes unplayable; pin the lower bound here.
describe('defense starter hand (defense redesign 2.5 setup)', () => {
  it('contains at least three militia (no-`requires`) units', () => {
    const G = setupG(4);
    const handNames = G.defense!.hand.map((u) => u.name);
    const militia = UNITS.filter((u) => (u.requires ?? '').trim().length === 0);
    expect(militia.length).toBeGreaterThanOrEqual(3);
    for (const m of militia) {
      expect(handNames).toContain(m.name);
    }
  });
});
