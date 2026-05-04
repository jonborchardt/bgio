// PlayerMatTile — a single per-seat tile on the CenterMat. Two
// side-by-side embossed panels under the title:
//
//   - Flow panel (left): the seat's incoming or outgoing tokens. The
//     panel's embossed glyph swaps to reflect which direction is
//     active — arrow-in for income (chief just dropped tokens here),
//     arrow-out for produced (this seat produced tokens this round),
//     twin trade-arrows when idle.
//   - Stash panel (right): the seat's working pool, with a chest
//     glyph as the embossed marker.
//
// Chief seats own no mat (`mat === null`). When `bankView` is supplied
// the chief tile renders the bank as flow (Income) + stash; during
// chiefPhase income merges into stash, the flow panel is hidden, and
// stash spans the full row.
//
// The role(s) the seat holds drive the accent color (chief priority).
// An active-turn outline replaces the normal role-tinted border when
// it's this seat's turn.

import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { PlayerID, Role, PlayerMat } from '../../game/types.ts';
import type {
  ResourceBag as ResourceBagType,
  Resource,
} from '../../game/resources/types.ts';
import { EMPTY_BAG, RESOURCES } from '../../game/resources/types.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';

const ROLE_ACCENT_PRIORITY: ReadonlyArray<Role> = [
  'chief',
  'science',
  'domestic',
  'defense',
];

const accentRoleFor = (roles: ReadonlyArray<Role>): Role | undefined =>
  ROLE_ACCENT_PRIORITY.find((r) => roles.includes(r));

const titleCase = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);

const totalOf = (bag: ResourceBagType): number => {
  let t = 0;
  for (const v of Object.values(bag)) t += v;
  return t;
};

export interface BankView {
  /** Resources that arrived in the bank this round. */
  income: ResourceBagType;
  /** Carryover from earlier rounds (or the merged total during chiefPhase). */
  stash: ResourceBagType;
  /** During chiefPhase, income has already merged into stash — hide the flow panel. */
  hideIncome?: boolean;
}

export interface CircleProps {
  seat: PlayerID;
  /** When null, the seat has no mat (chief). */
  mat: PlayerMat | null;
  roles: ReadonlyArray<Role>;
  active?: boolean;
  /** When set on a non-active seat, render a "Waiting for {label}" caption. */
  waitingFor?: string;
  /** Chief-only: bank breakdown to render in place of mat lanes. */
  bankView?: BankView;
  /** When provided, the tile becomes a button — clicking it fires the
   *  callback with this seat's id. Used by Board to make the row of
   *  Circle tiles act as the hot-seat seat picker (replacing the older
   *  SeatPicker tab strip). */
  onSelect?: (seat: PlayerID) => void;
  /** When `onSelect` is set, marks this tile as the selected tab. The
   *  selected tile gets a thicker outline + raised elevation so the
   *  row reads as a tab strip. Independent of `active` (which tracks
   *  whose turn it is in the engine). */
  selected?: boolean;
}

type FlowKind = 'income' | 'produced' | 'idle';

interface ResolvedLanes {
  flow: { kind: FlowKind; bag: ResourceBagType } | null;
  stash: ResourceBagType;
}

// A non-chief seat is never simultaneously holding income and produced
// goods (chief sweeps `out` at the start of their turn, then drops new
// income in `in` for the seat to take next; the seat's `produce` runs
// after its `in` has already drained to `stash`). Pick whichever side
// has tokens, or `idle` when both are empty.
const resolveLanes = (
  mat: PlayerMat | null,
  bankView: BankView | undefined,
): ResolvedLanes => {
  if (mat !== null) {
    if (totalOf(mat.in) > 0) {
      return { flow: { kind: 'income', bag: mat.in }, stash: mat.stash };
    }
    if (totalOf(mat.out) > 0) {
      return { flow: { kind: 'produced', bag: mat.out }, stash: mat.stash };
    }
    return { flow: { kind: 'idle', bag: mat.in }, stash: mat.stash };
  }
  if (!bankView) {
    return { flow: null, stash: EMPTY_BAG as ResourceBagType };
  }
  if (bankView.hideIncome) {
    return { flow: null, stash: bankView.stash };
  }
  return {
    flow: { kind: 'income', bag: bankView.income },
    stash: bankView.stash,
  };
};

// ── Embossed glyphs ─────────────────────────────────────────────────

const ArrowIn = () => (
  <g
    stroke="currentColor"
    strokeWidth={3}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1={32} y1={6} x2={32} y2={44} />
    <polyline points="20,32 32,44 44,32" />
    <line x1={14} y1={54} x2={50} y2={54} />
  </g>
);

const ArrowOut = () => (
  <g
    stroke="currentColor"
    strokeWidth={3}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1={14} y1={10} x2={50} y2={10} />
    <line x1={32} y1={20} x2={32} y2={58} />
    <polyline points="20,32 32,20 44,32" />
  </g>
);

const TradeArrows = () => (
  <g
    stroke="currentColor"
    strokeWidth={3}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1={22} y1={10} x2={22} y2={48} />
    <polyline points="14,38 22,50 30,38" />
    <line x1={42} y1={54} x2={42} y2={16} />
    <polyline points="34,26 42,14 50,26" />
  </g>
);

const Chest = () => (
  <g
    stroke="currentColor"
    strokeWidth={2.5}
    fill="none"
    strokeLinejoin="round"
  >
    <rect x={10} y={24} width={44} height={28} rx={2} />
    <path d="M10 24 Q10 12 32 12 Q54 12 54 24" />
    <line x1={10} y1={36} x2={54} y2={36} />
    <rect x={28} y={32} width={8} height={8} />
  </g>
);

const flowGlyph = (kind: FlowKind): ReactNode => {
  if (kind === 'income') return <ArrowIn />;
  if (kind === 'produced') return <ArrowOut />;
  return <TradeArrows />;
};

// ── Slot panel ──────────────────────────────────────────────────────

function EmbossGlyph({ children }: { children: ReactNode }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        opacity: 0.2,
        p: 0.25,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 64 64"
        sx={{ width: '60%', height: '60%' }}
      >
        {children}
      </Box>
    </Box>
  );
}

function Slot({
  role,
  glyph,
  flex,
  children,
}: {
  role: Role | undefined;
  glyph: ReactNode;
  flex: number;
  children: ReactNode;
}) {
  return (
    <Box
      sx={(t: Theme) => ({
        position: 'relative',
        flex,
        minWidth: 0,
        minHeight: 44,
        px: 0.75,
        py: 0.5,
        borderLeft: `3px solid ${role ? t.palette.role[role].main : t.palette.status.muted}`,
        bgcolor: role
          ? `${t.palette.role[role].main}1f`
          : 'rgba(255,255,255,0.04)',
        borderRadius: '0 4px 4px 0',
        boxShadow: t.palette.shadow.embossInset,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        color: (tt: Theme) =>
          role ? tt.palette.role[role].light : tt.palette.status.muted,
      })}
    >
      <EmbossGlyph>{glyph}</EmbossGlyph>
      <Box sx={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

function MatTokens({ bag }: { bag: ResourceBagType }) {
  const visible = (RESOURCES as ReadonlyArray<Resource>).filter(
    (r) => bag[r] > 0,
  );
  if (visible.length === 0) return <Box sx={{ height: 18 }} />;
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        flexWrap: 'wrap',
        alignItems: 'center',
        rowGap: 0.5,
      }}
    >
      {visible.map((resource) => (
        <ResourceToken
          key={resource}
          resource={resource}
          count={bag[resource]}
        />
      ))}
    </Box>
  );
}

// ── Tile ────────────────────────────────────────────────────────────

export function Circle({
  seat,
  mat,
  roles,
  active,
  waitingFor,
  bankView,
  onSelect,
  selected,
}: CircleProps) {
  const accent = accentRoleFor(roles);
  const label = roles.length > 0 ? roles.map(titleCase).join(' · ') : '—';
  const ariaLabel = `${label} mat (Player ${Number(seat) + 1})`;
  const lanes = resolveLanes(mat, bankView);
  const isTab = onSelect !== undefined;

  // Tab visuals — selected tile uses the ROLE accent color so it
  // matches the role panel's border underneath (they fuse into one
  // shape). The active-turn inset glow is suppressed on the selected
  // tile so the role color stays clean (no competing blue rim
  // inside the gold border).
  const borderColor = (t: Theme): string =>
    accent
      ? t.palette.role[accent].main
      : selected && isTab
        ? t.palette.status.active
        : t.palette.card.surface;
  const borderWidth = selected && isTab ? 2 : 1;
  // No shadow — active-turn indication is the pulsing dot next to the
  // role title, and the selected tab/panel fusion is conveyed by the
  // shared role-accent border alone. A floating shadow under the
  // selected tile read as visual noise once the rail-and-tab seam
  // was clean.
  const tileShadow = (): string => 'none';

  // All tiles drop their bottom border so they read as tabs sitting
  // on the role panel's top "rail". The selected tile additionally
  // squares its bottom corners and overlaps the panel by 1px so its
  // bg punches out the rail's accent color directly under itself —
  // i.e. the rail color shows under unselected tiles but is hidden
  // under the selected tile, giving the classic tabbed-UI gap.
  const isSelectedTab = (selected ?? false) && isTab;
  const surfaceSx = {
    px: 1.5,
    py: 1,
    width: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    bgcolor: (t: Theme) => t.palette.card.surface,
    borderTop: `${borderWidth}px solid`,
    borderLeft: `${borderWidth}px solid`,
    borderRight: `${borderWidth}px solid`,
    borderBottom: 'none',
    borderColor,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: isSelectedTab ? 0 : 4,
    borderBottomRightRadius: isSelectedTab ? 0 : 4,
    // Keep inner content vertical position stable across selected/
    // unselected since neither branch carries a bottom border.
    pb: 1,
    // Selected tile pulls down by the panel's full border width (2px)
    // so its background fully covers the rail directly beneath it —
    // pulling only 1px would leave a hairline of role color showing.
    mb: isSelectedTab ? '-2px' : 0,
    zIndex: isSelectedTab ? 1 : 0,
    boxShadow: tileShadow,
    transition: 'box-shadow 120ms ease, border-color 120ms ease',
    position: 'relative' as const,
    cursor: isTab ? 'pointer' : 'default',
    '&:hover': isTab
      ? {
          borderColor: (t: Theme) =>
            accent
              ? t.palette.role[accent].light
              : t.palette.status.active,
        }
      : undefined,
  };

  const inner = (
      <Stack spacing={0.75} sx={{ width: '100%', flex: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center', minWidth: 0 }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '0.02em',
                color: (t) =>
                  accent ? t.palette.role[accent].main : t.palette.card.text,
              }}
            >
              {label}
            </Typography>
            {active ? (
              <Box
                aria-label="Acting now"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: (t) => t.palette.status.active,
                  boxShadow: (t) => `0 0 6px ${t.palette.status.active}`,
                  animation: 'circleActingPulse 1.4s ease-in-out infinite',
                  '@keyframes circleActingPulse': {
                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.55, transform: 'scale(0.85)' },
                  },
                }}
              />
            ) : null}
          </Stack>
          {!active && waitingFor !== undefined ? (
            <Stack
              spacing={0}
              sx={{ alignItems: 'flex-end', lineHeight: 1.1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  lineHeight: 1.1,
                }}
              >
                Waiting for
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  lineHeight: 1.1,
                  textAlign: 'right',
                }}
              >
                {waitingFor}
              </Typography>
            </Stack>
          ) : null}
        </Stack>

        <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
          {lanes.flow !== null ? (
            <Slot role={accent} glyph={flowGlyph(lanes.flow.kind)} flex={1}>
              <MatTokens bag={lanes.flow.bag} />
            </Slot>
          ) : null}
          <Slot
            role={accent}
            glyph={<Chest />}
            flex={lanes.flow === null ? 2 : 1}
          >
            <MatTokens bag={lanes.stash} />
          </Slot>
        </Box>
      </Stack>
  );

  if (isTab) {
    return (
      <ButtonBase
        onClick={() => onSelect!(seat)}
        focusRipple
        aria-label={ariaLabel}
        aria-pressed={selected ?? false}
        sx={surfaceSx}
      >
        {inner}
      </ButtonBase>
    );
  }

  return (
    <Paper elevation={0} aria-label={ariaLabel} sx={surfaceSx}>
      {inner}
    </Paper>
  );
}

export default Circle;
