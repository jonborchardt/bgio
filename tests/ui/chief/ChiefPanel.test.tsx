// ChiefPanel smoke + RTL render checks. Issue 029 closed the it.todos
// here once @testing-library/react landed. The chief panel's flip /
// end-turn slot is a unified <ChiefActionButton> — see
// ChiefActionButton.test.tsx for its own render assertions; the cases
// below cover the panel's render-mounted-and-not-crashing contract
// plus its dispatch wiring.

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Ctx } from 'boardgame.io';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { ChiefPanel } from '../../../src/ui/chief/ChiefPanel.tsx';
import { setup } from '../../../src/game/setup.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import { seatOfRole } from '../../../src/game/roles.ts';
import { CardInfoProvider } from '../../../src/ui/cards/CardInfoContext.tsx';

const buildG = (numPlayers: 1 | 2 | 3 | 4): SettlementState =>
  setup({
    ctx: { numPlayers } as unknown as Parameters<typeof setup>[0]['ctx'],
  });

const ctxFor = (
  phase: string,
  numPlayers: number,
  chiefSeat: string,
): Ctx =>
  ({
    phase,
    activePlayers: undefined,
    turn: 1,
    numPlayers,
    playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
    playOrderPos: 0,
    currentPlayer: chiefSeat,
    numMoves: 0,
  }) as unknown as Ctx;

const fakeMoves = () => ({
  chiefDistribute: vi.fn(),
  chiefEndPhase: vi.fn(),
  chiefFlipTrack: vi.fn(),
  chiefTax: vi.fn(),
  chiefPlayGoldEvent: vi.fn(),
  chiefPlaceWorker: vi.fn(),
  chiefPlayTech: vi.fn(),
  pass: vi.fn(),
  undoLast: vi.fn(),
  requestHelp: vi.fn(),
});

const renderPanel = (props: Parameters<typeof ChiefPanel>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <CardInfoProvider>
        <ChiefPanel {...props} />
      </CardInfoProvider>
    </ThemeProvider>,
  );

describe('ChiefPanel smoke', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chief/ChiefPanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ChiefPanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('CircleEditor imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chief/CircleEditor.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.CircleEditor).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('ChiefActionButton imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chief/ChiefActionButton.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ChiefActionButton).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  for (const n of [1, 2, 4] as const) {
    it(`renders without crashing for numPlayers=${n}`, () => {
      const G = buildG(n);
      const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
      const moves = fakeMoves();
      expect(() =>
        renderPanel({
          G,
          ctx: ctxFor('chiefPhase', n, chiefSeat),
          moves,
          playerID: chiefSeat,
        } as unknown as Parameters<typeof ChiefPanel>[0]),
      ).not.toThrow();
    });
  }

  it('clicking "End my turn" (track flipped) calls chiefEndPhase', () => {
    const G = buildG(4);
    const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
    // Mark the track as already flipped so the action button shows
    // "End my turn" rather than "Flip Track".
    if (G.track) {
      G.track.flippedThisRound = true;
    }
    const moves = fakeMoves();
    renderPanel({
      G,
      ctx: ctxFor('chiefPhase', 4, chiefSeat),
      moves,
      playerID: chiefSeat,
    } as unknown as Parameters<typeof ChiefPanel>[0]);
    const button = screen.getByRole('button', { name: /End my turn/i });
    fireEvent.click(button);
    expect(moves.chiefEndPhase).toHaveBeenCalledOnce();
  });
});
