// CenterMat — central play area: per-seat player-mat tiles plus the
// single trade-request slot. The per-seat tiles double as the player
// roster so we only show one list of seats on the board.
//
//   - Reads roles from `G.roleAssignments`,
//   - reads each seat's player mat from `G.mats[seat]` (in / out / stash);
//     chief seats have no mat — instead the chief tile renders the bank
//     split into Income (this round) and Stash (carryover) using the
//     bankLog audit trail,
//   - reads tradeRequest from `G.centerMat.tradeRequest` (visible to
//     every seat — any active seat with enough in their own stash can
//     fulfill).
//
// There's no longer a "pull from circle" interaction: the in→stash transfer
// runs automatically at `othersPhase.turn.onBegin`, so this component is
// pure presentation.

import { Box } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { computeBankView } from '../../game/resources/bankLog.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { Circle } from './Circle.tsx';
import { TradeRequestSlot } from './TradeRequestSlot.tsx';

const titleCase = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);

export function CenterMat(props: BoardProps<SettlementState>) {
  const { G, ctx, playerID, moves } = props;
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
  // when bgio would accept a move from it: in `othersPhase`,
  // `activePlayers` lists every non-chief seat with their stage, and
  // 14.2's `othersDone` flips a seat off without changing the stage
  // map, so both checks are required. In `chiefPhase`, `activePlayers`
  // is null and only `currentPlayer` is acting.
  const isSeatActing = (seat: string): boolean => {
    if (gameOver) return false;
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
  //   - science / domestic / foreign can only ever wait on the chief
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
      const others: Array<'science' | 'domestic' | 'foreign'> = [];
      for (const otherSeat of Object.keys(G.roleAssignments)) {
        if (otherSeat === seat) continue;
        if (!isSeatActing(otherSeat)) continue;
        for (const r of G.roleAssignments[otherSeat] ?? []) {
          if (r === 'science' || r === 'domestic' || r === 'foreign') {
            if (!others.includes(r)) others.push(r);
          }
        }
      }
      if (others.length === 0) return undefined;
      const order = ['science', 'domestic', 'foreign'] as const;
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
      aria-label="Center mat"
      sx={{ display: 'grid', gap: 1.5 }}
    >
      <Box
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

          return (
            <Box
              key={seat}
              sx={{ minWidth: 0, display: 'flex' }}
            >
              <Circle
                seat={seat}
                mat={mat}
                roles={seatRoles}
                active={acting}
                waitingFor={waitingFor}
                bankView={isChiefSeat ? bankView : undefined}
              />
            </Box>
          );
        })}
      </Box>
      <TradeRequestSlot
        tradeRequest={G.centerMat.tradeRequest}
        G={G}
        playerID={playerID}
        onFulfill={() => moves.foreignTradeFulfill()}
      />
    </Box>
  );
}

export default CenterMat;
