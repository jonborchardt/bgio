// CenterMat — central play area: row of per-seat player-mat tiles. The
// tiles double as the player roster AND as the seat-picker tab strip —
// the older `<SeatPicker>` Tabs row was retired in favor of these
// clickable tiles, so the row of Circles IS now the way the local
// viewer switches seats in hot-seat play.
//
// `CenterMat` returns the tile row alone now; the trade-request slot
// it previously rendered was retired by the defense redesign (D14:
// trade requests are gone). Phase 2 will reintroduce the center mat as
// the global event track strip (D19).
//
//   - Reads roles from `G.roleAssignments`,
//   - reads each seat's player mat from `G.mats[seat]` (in / out / stash);
//     chief seats have no mat — instead the chief tile renders the bank
//     split into Income (this round) and Stash (carryover) using the
//     bankLog audit trail.
//
// There's no longer a "pull from circle" interaction: the in→stash transfer
// runs automatically at `othersPhase.turn.onBegin`, so this component is
// pure presentation.

import { useContext } from 'react';
import { Box } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import { computeBankView } from '../../game/resources/bankLog.ts';
import { rolesAtSeat, seatOfRole } from '../../game/roles.ts';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { Circle } from './Circle.tsx';
import { CenterBurnBanner } from '../center/CenterBurnBanner.tsx';

const titleCase = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);

export function SeatTiles(props: BoardProps<SettlementState>) {
  const { G, ctx, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);
  const seats = Object.keys(G.roleAssignments).sort();
  const gameOver = ctx.gameover !== undefined;
  // During chiefPhase, this round's income is merged into what the chief
  // can distribute — collapse the two lanes so only the full bank shows
  // as Stash (everything available to push).
  const isChiefPhase = ctx.phase === 'chiefPhase';
  const rawBankView = computeBankView(G);
  const bankView = isChiefPhase
    ? { income: rawBankView.income, stash: G.bank, hideIncome: true }
    : { ...rawBankView, hideIncome: false };

  // Per-tile "Waiting for X" / active-border logic. A seat is acting
  // when bgio would accept a *phase-driving* move from it: in
  // `othersPhase`, `activePlayers` lists every non-chief seat with
  // their role-stage, and 14.2's `othersDone` flips a seat off without
  // changing the stage map, so both checks are required. In
  // `chiefPhase`, every seat is parked in `Stage.NULL` purely so
  // non-chief seats can fire the side-channel `requestHelp` move —
  // only the seat holding the chief role drives the phase.
  // (`ctx.currentPlayer` would seem like the natural pick, but bgio's
  // default turn.order rotates it across phase transitions, so after a
  // full round it can land on any seat — not the chief.)
  const chiefRoleSeat = (() => {
    try { return seatOfRole(G.roleAssignments, 'chief'); }
    catch { return undefined; }
  })();
  const isSeatActing = (seat: string): boolean => {
    if (gameOver) return false;
    if (ctx.phase === 'chiefPhase') return chiefRoleSeat === seat;
    const ap = ctx.activePlayers;
    if (ap) {
      const stage = ap[seat];
      if (stage === undefined || stage === 'done') return false;
      if (G.othersDone?.[seat]) return false;
      return true;
    }
    return ctx.currentPlayer === seat;
  };

  // Who is each seat waiting on?
  //   - science / domestic / defense can only ever wait on the chief
  //     (chiefPhase) or nobody (othersPhase — they act in parallel).
  //   - chief can wait on any subset of the other three roles
  //     (othersPhase, while non-chief seats are still acting).
  const chiefSeat = Object.keys(G.roleAssignments).find((s) =>
    (G.roleAssignments[s] ?? []).includes('chief'),
  );
  const waitingForLabelFor = (seat: string): string | undefined => {
    if (gameOver) return undefined;
    if (isSeatActing(seat)) return undefined;
    const seatRoles = G.roleAssignments[seat] ?? [];
    if (seatRoles.includes('chief')) {
      const others: Array<'science' | 'domestic' | 'defense'> = [];
      for (const otherSeat of Object.keys(G.roleAssignments)) {
        if (otherSeat === seat) continue;
        if (!isSeatActing(otherSeat)) continue;
        for (const r of G.roleAssignments[otherSeat] ?? []) {
          if (r === 'science' || r === 'domestic' || r === 'defense') {
            if (!others.includes(r)) others.push(r);
          }
        }
      }
      if (others.length === 0) return undefined;
      const order = ['science', 'domestic', 'defense'] as const;
      return order
        .filter((r) => others.includes(r))
        .map(titleCase)
        .join(' · ');
    }
    if (chiefSeat !== undefined && isSeatActing(chiefSeat)) return 'Chief';
    return undefined;
  };

  return (
    <Box
      aria-label="Seat tiles"
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
        alignItems: 'stretch',
      }}
    >
      {seats.map((seat) => {
        const seatRoles = rolesAtSeat(G.roleAssignments, seat);
        const mat = G.mats?.[seat] ?? null;
        const acting = isSeatActing(seat);
        const waitingFor = waitingForLabelFor(seat);
        const isChiefSeat = seatRoles.includes('chief');
        const isLocalSeat =
          playerID !== undefined &&
          playerID !== null &&
          playerID === seat;

        // Tab behavior is hot-seat-only: the seat-picker context is
        // only mounted by `<HotSeatShell>` in App.tsx (10.3 networked
        // mode binds the local seat through the lobby and the row
        // stays read-only).
        const tabSelect = seatCtx
          ? (s: PlayerID) => seatCtx.setSeat(s)
          : undefined;

        return (
          <Box key={seat} sx={{ minWidth: 0, display: 'flex' }}>
            <Circle
              seat={seat}
              mat={mat}
              roles={seatRoles}
              active={acting}
              waitingFor={waitingFor}
              bankView={isChiefSeat ? bankView : undefined}
              onSelect={tabSelect}
              selected={isLocalSeat}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export function CenterMat(props: BoardProps<SettlementState>) {
  // Defense redesign 3.4 — the center-burn banner floats above the seat
  // tiles. We mount it inside a relative-positioned wrapper so its
  // `position: absolute` resolves against the seat-tile row rather than
  // the page. The banner is `pointer-events: none`, so it never blocks
  // tile clicks underneath.
  return (
    <Box
      aria-label="Center mat"
      sx={{ display: 'grid', gap: 1.5, position: 'relative' }}
    >
      <CenterBurnBanner lastResolve={props.G.track?.lastResolve} />
      <SeatTiles {...props} />
    </Box>
  );
}

export default CenterMat;
