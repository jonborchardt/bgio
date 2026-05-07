// RequestHelpButton — small icon button that toggles a HelpRequest for
// a specific (target, slices) pair. Lives next to a disabled action
// button so the requester can ping the player(s) who can unblock them.
//
// Visibility rules:
//   - Returns null if there are no slices to send (the action isn't
//     blocked by anything another player controls — there's nothing to
//     ask for).
//   - Returns null if `playerID` is missing (spectator).
//   - Returns null if `moves.requestHelp` isn't on the move surface
//     (legacy harness without the move registered).
//
// Toggle semantics: the button reads `G.requests` to decide whether
// any of the slices are currently pending. If ANY are pending, the
// button is "on" (filled accent); a click rescinds. Otherwise the
// button is "off" (outlined); a click sends.

import { IconButton, Tooltip } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState, Role } from '../../game/types.ts';
import type {
  RequestNeed,
  RequestTargetId,
} from '../../game/requests/types.ts';
import type {
  RequestSlice,
  RequestHelpPayload,
} from '../../game/requests/move.ts';

const MailGlyph = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    aria-hidden
    style={{ display: 'block' }}
  >
    {filled ? (
      <path
        fill="currentColor"
        d="M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm10 8 9-6H3l9 6z"
      />
    ) : (
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M3 6h18v12H3zM3 6l9 7 9-7"
      />
    )}
  </svg>
);

export interface RequestHelpButtonProps {
  G: SettlementState;
  playerID: string | null | undefined;
  moves: BoardProps<SettlementState>['moves'];
  fromRole: Role;
  targetId: RequestTargetId;
  targetLabel: string;
  /** Pre-computed need slices (one per recipient). When empty, the
   *  button doesn't render. */
  slices: RequestSlice[];
}

export function RequestHelpButton({
  G,
  playerID,
  moves,
  fromRole,
  targetId,
  targetLabel,
  slices,
}: RequestHelpButtonProps) {
  if (playerID === undefined || playerID === null) return null;
  if (slices.length === 0) return null;

  const requestHelp = (moves as Record<string, ((p: RequestHelpPayload) => void) | undefined>)
    .requestHelp;
  if (requestHelp === undefined) return null;

  const pending = (G.requests ?? []).some(
    (r) =>
      r.fromSeat === playerID &&
      r.targetId === targetId &&
      slices.some((s) => s.toSeat === r.toSeat),
  );

  const handleClick = (): void => {
    requestHelp({ fromRole, targetId, targetLabel, slices });
  };

  const recipients = slices.map((s) => `P${Number(s.toSeat) + 1}`).join(', ');
  const tooltip = pending
    ? `Rescind help request to ${recipients}`
    : `Ask ${recipients} for help with ${targetLabel}`;

  // Coerce the need shape into a tiny summary for the aria-label so
  // screen readers can hear the ask without parsing JSX.
  const needSummary = (need: RequestNeed): string => {
    if (need.kind === 'resources') return 'resources';
    return `${need.kind} ${need.name}`;
  };
  const ariaLabel = pending
    ? `Rescind help request for ${targetLabel}`
    : `Ask for help with ${targetLabel}: ${slices
        .map((s) => needSummary(s.need))
        .join(', ')}`;

  return (
    <Tooltip title={tooltip} placement="top">
      <IconButton
        size="small"
        onClick={handleClick}
        aria-label={ariaLabel}
        sx={{
          width: 24,
          height: 24,
          color: (t) =>
            pending
              ? t.palette.role[fromRole].contrastText
              : t.palette.role[fromRole].main,
          bgcolor: (t) =>
            pending ? t.palette.role[fromRole].main : 'transparent',
          border: '1px solid',
          borderColor: (t) => t.palette.role[fromRole].main,
          '&:hover': {
            bgcolor: (t) =>
              pending
                ? t.palette.role[fromRole].dark
                : t.palette.role[fromRole].light,
          },
        }}
      >
        <MailGlyph filled={pending} />
      </IconButton>
    </Tooltip>
  );
}

export default RequestHelpButton;
