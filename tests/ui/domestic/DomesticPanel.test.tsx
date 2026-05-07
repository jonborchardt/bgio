// 06.7 — DomesticPanel smoke + RTL render checks. Issue 029 closed
// the it.todos here once @testing-library/react landed.
//
// Note on the original it.todos:
//   - "Produce button disables after one click" — moot post-redesign.
//     Produce auto-fires at othersPhase.turn.onBegin; there's no
//     button in the panel any more.
//   - "Once a building exists, only neighbors highlight as legal" —
//     covered by tests/ui/domestic/BuildingGridPathHighlight.test.tsx
//     and the engine-side `isPlacementLegal` tests; the panel just
//     forwards selection state to the grid.
//   - "Empty grid: clicking center fires domesticBuyBuilding" — the
//     buy dispatch lives at Board.tsx (the grid is lifted to board
//     level post-3.9). The panel's job is to surface the hand and
//     publish the armed selection.

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Ctx } from 'boardgame.io';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { DomesticPanel } from '../../../src/ui/domestic/DomesticPanel.tsx';
import { setup } from '../../../src/game/setup.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import { seatOfRole } from '../../../src/game/roles.ts';
import { CardInfoProvider } from '../../../src/ui/cards/CardInfoContext.tsx';

const buildG = (numPlayers: 1 | 2 | 3 | 4): SettlementState =>
  setup({
    ctx: { numPlayers } as unknown as Parameters<typeof setup>[0]['ctx'],
  });

const ctxFor = (
  numPlayers: number,
  domesticSeat: string,
  active = true,
): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: active ? { [domesticSeat]: 'domesticTurn' } : undefined,
    turn: 1,
    numPlayers,
    playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
    playOrderPos: 0,
    currentPlayer: domesticSeat,
    numMoves: 0,
  }) as unknown as Ctx;

const fakeMoves = () => ({
  domesticBuyBuilding: vi.fn(),
  domesticUpgradeBuilding: vi.fn(),
  domesticProduce: vi.fn(),
  domesticRepair: vi.fn(),
  domesticPlayGreenEvent: vi.fn(),
  domesticPlayTech: vi.fn(),
  domesticSeatDone: vi.fn(),
  pass: vi.fn(),
  undoLast: vi.fn(),
  requestHelp: vi.fn(),
});

const renderPanel = (props: Parameters<typeof DomesticPanel>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <CardInfoProvider>
        <DomesticPanel {...props} />
      </CardInfoProvider>
    </ThemeProvider>,
  );

describe('DomesticPanel smoke (06.7)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/DomesticPanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.DomesticPanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('Hand imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/Hand.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.Hand).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('CellSlot imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/CellSlot.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.CellSlot).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('BuildingGrid imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/BuildingGrid.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.BuildingGrid).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  for (const n of [1, 2, 4] as const) {
    it(`renders without crashing for numPlayers=${n}`, () => {
      const G = buildG(n);
      const domesticSeat = seatOfRole(G.roleAssignments, 'domestic');
      const moves = fakeMoves();
      expect(() =>
        renderPanel({
          G,
          ctx: ctxFor(n, domesticSeat),
          moves,
          playerID: domesticSeat,
        } as unknown as Parameters<typeof DomesticPanel>[0]),
      ).not.toThrow();
    });
  }

  it('returns null when the local seat does not hold the domestic role', () => {
    const G = buildG(4);
    const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
    const domesticSeat = seatOfRole(G.roleAssignments, 'domestic');
    const moves = fakeMoves();
    const { container } = renderPanel({
      G,
      ctx: ctxFor(4, domesticSeat),
      moves,
      // Viewer is the chief seat — not the domestic seat.
      playerID: chiefSeat,
    } as unknown as Parameters<typeof DomesticPanel>[0]);
    expect(container.firstChild).toBeNull();
  });
});
