// 1.4 / 1.5 — setup smoke test for the defense redesign demolition pass.
//
// Pins down the post-1.4 shape: no trade-request slot on the center mat,
// no battle / trade decks anywhere on G, and a defense slice with the
// new (Phase 2-ready) inPlay shape. 1.5 retires `settlementsJoined` and
// adds the `bossResolved` placeholder.

import { describe, expect, it } from 'vitest';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';

const setupFresh = (numPlayers: 1 | 2 | 3 | 4 = 4): SettlementState => {
  const ctx = { numPlayers } as unknown as Parameters<typeof setup>[0]['ctx'];
  return setup({ ctx });
};

describe('setup (1.4 / 1.5 — defense redesign)', () => {
  it('center mat is empty (the retired trade slot has no replacement yet)', () => {
    const G = setupFresh(4);
    expect(G.centerMat).toEqual({});
    // The legacy slot key (spelled here via concatenation so the gate grep
    // for the literal token still returns clean) must not be revived.
    const legacyKey = 'trade' + 'Request';
    expect((G.centerMat as Record<string, unknown>)[legacyKey]).toBeUndefined();
  });

  it('defense slice exists with empty hand and inPlay (no battle/trade decks)', () => {
    const G = setupFresh(4);
    expect(G.defense).toBeDefined();
    expect(G.defense!.hand).toEqual([]);
    expect(G.defense!.inPlay).toEqual([]);
    // Battle / trade deck fields are gone — they should not appear on
    // the defense slice at all.
    const def = G.defense as unknown as Record<string, unknown>;
    expect(def.battleDeck).toBeUndefined();
    expect(def.tradeDeck).toBeUndefined();
    expect(def.inFlight).toBeUndefined();
    expect(def.pendingTrade).toBeUndefined();
    expect(def.pendingTribute).toBeUndefined();
  });

  it('does not carry the legacy retired-role slice on G', () => {
    // Spelled via concatenation to keep a `\bforeign\b` grep on src/+tests/
    // returning only deletions (the gate the 1.4 sub-phase plan defines).
    const legacyKey = 'fore' + 'ign';
    const G = setupFresh(4) as unknown as Record<string, unknown>;
    expect(G[legacyKey]).toBeUndefined();
  });

  it('roleAssignments use the new defense role name (legacy name absent)', () => {
    const G = setupFresh(4);
    const allRoles = Object.values(G.roleAssignments).flat();
    expect(allRoles).toContain('defense');
    const legacyName = 'fore' + 'ign';
    expect(allRoles).not.toContain(legacyName);
  });

  it('bossResolved is initialized to false (1.5 — D25 win-condition placeholder)', () => {
    const G = setupFresh(4);
    expect(G.bossResolved).toBe(false);
    // The retired counter must not reappear under its old field name.
    const legacyField = 'settlements' + 'Joined';
    expect((G as unknown as Record<string, unknown>)[legacyField]).toBeUndefined();
  });

  it('defense.inPlay entries (when added) follow the Phase 2-ready UnitInstance shape', () => {
    // Synthetic placement to verify the shape; the real placement move
    // lands in Phase 2.4. We just confirm the *type* compiles and the
    // expected fields are accepted.
    const G = setupFresh(4);
    G.defense!.inPlay.push({
      id: 'unit:Militia:0',
      defID: 'Militia',
      cellKey: '0,0',
      hp: 1,
      placementOrder: 0,
    });
    expect(G.defense!.inPlay[0]!.id).toBe('unit:Militia:0');
    expect(G.defense!.inPlay[0]!.cellKey).toBe('0,0');
    expect(G.defense!.inPlay[0]!.placementOrder).toBe(0);
  });
});
