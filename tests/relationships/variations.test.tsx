// Smoke tests: every variation imports + exports a callable component
// without runtime errors. Mirrors the existing card-component smoke
// tests under tests/ui/cards/cards.test.tsx — `@testing-library/react`
// is not available in this repo, so render-and-assert checks would
// require a separate dep.

import { describe, expect, it } from 'vitest';

describe('ui/relationships variations smoke', () => {
  it('VARIATIONS registry contains the v6 entry as the only / default variation', async () => {
    const mod = await import('../../src/ui/relationships/variations/index.ts');
    expect(mod.VARIATIONS.length).toBe(1);
    expect(mod.VARIATIONS[0].id).toBe('relationships6');
    expect(typeof mod.VARIATIONS[0].component).toBe('function');
  });

  it('Relationships6 module exports a default function component', async () => {
    const m = await import('../../src/ui/relationships/variations/Relationships6.tsx');
    expect(typeof m.default).toBe('function');
  });

  it('RelationshipsModal + GraphControls + RelationshipsGraph + CardListPanel + CardDetailPanel import', async () => {
    const modal = await import('../../src/ui/relationships/RelationshipsModal.tsx');
    expect(typeof modal.RelationshipsModal).toBe('function');
    const controls = await import('../../src/ui/relationships/GraphControls.tsx');
    expect(typeof controls.GraphControls).toBe('function');
    const graph = await import('../../src/ui/relationships/RelationshipsGraph.tsx');
    expect(typeof graph.RelationshipsGraph).toBe('function');
    const list = await import('../../src/ui/relationships/CardListPanel.tsx');
    expect(typeof list.CardListPanel).toBe('function');
    const detail = await import('../../src/ui/relationships/CardDetailPanel.tsx');
    expect(typeof detail.CardDetailPanel).toBe('function');
  });

  it('AnyCard + size-aware card components import', async () => {
    const any = await import('../../src/ui/cards/AnyCard.tsx');
    expect(typeof any.AnyCard).toBe('function');
    const trade = await import('../../src/ui/cards/TradeCard.tsx');
    expect(typeof trade.TradeCard).toBe('function');
    const battle = await import('../../src/ui/cards/BattleCard.tsx');
    expect(typeof battle.BattleCard).toBe('function');
    const wander = await import('../../src/ui/cards/WanderCard.tsx');
    expect(typeof wander.WanderCard).toBe('function');
  });

  it('typed loaders for tradeCards / battleCards expose frozen arrays', async () => {
    const t = await import('../../src/data/tradeCards.ts');
    expect(Array.isArray(t.TRADE_CARDS)).toBe(true);
    expect(t.TRADE_CARDS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(t.TRADE_CARDS)).toBe(true);
    const b = await import('../../src/data/battleCards.ts');
    expect(Array.isArray(b.BATTLE_CARDS)).toBe(true);
    expect(b.BATTLE_CARDS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(b.BATTLE_CARDS)).toBe(true);
  });
});
