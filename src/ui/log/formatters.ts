// Render-time formatters: bgio move name → `ActivityPart[]`.
//
// Each formatter reads the move's `args` (and, where stable, the current
// G state for static lookups like `BUILDINGS`/`UNITS`) and emits a single
// activity entry. There is no parallel match-state log — `client.log` is
// the source of truth, and this table is the only place narration lives.
//
// Lossy by design: information that depended on transient state at the
// moment the move ran (e.g. the exact `targetMat.in` running total after
// a distribute click, the bank balance available for a release refund,
// the drawn battle id between flip and resolve) is not recoverable from
// args alone, so those formatters render the action without it. The
// trade-off is documented at the call sites that used to `appendActivity`
// — see commit history for what dropped out.

import type { SettlementState, Role } from '../../game/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { BUILDINGS } from '../../data/index.ts';
import { idForBuilding } from '../../cards/registry.ts';
import type { ActivityPart } from './types.ts';
import { card, res } from './types.ts';

export interface FormatterResult {
  role?: Role;
  parts: ActivityPart[];
}

export type Formatter = (
  args: ReadonlyArray<unknown>,
  G: SettlementState,
) => FormatterResult | null;

const renderSignedAmounts = (
  amounts: Partial<ResourceBag> | undefined,
): ActivityPart[] => {
  const out: ActivityPart[] = [];
  if (!amounts || typeof amounts !== 'object') return out;
  for (const r of RESOURCES) {
    const v = (amounts as Record<string, unknown>)[r];
    if (typeof v !== 'number' || v === 0) continue;
    if (out.length > 0) out.push(' ');
    const sign: '+' | '-' = v > 0 ? '+' : '-';
    out.push(res(r, Math.abs(v), sign));
  }
  return out;
};

const renderPositiveAmounts = (
  amounts: Partial<ResourceBag> | undefined,
  sign: '+' | '-',
): ActivityPart[] => {
  const out: ActivityPart[] = [];
  if (!amounts || typeof amounts !== 'object') return out;
  for (const r of RESOURCES) {
    const v = (amounts as Record<string, unknown>)[r];
    if (typeof v !== 'number' || v <= 0) continue;
    if (out.length > 0) out.push(' ');
    out.push(res(r, v, sign));
  }
  return out;
};

const seatLabel = (seat: unknown): string =>
  typeof seat === 'string' ? `P${Number(seat) + 1}` : '?';

export const FORMATTERS: Record<string, Formatter> = {
  // ---- Chief --------------------------------------------------------------
  chiefDistribute: (args) => {
    const targetSeat = args[0];
    const amounts = args[1] as Partial<ResourceBag> | undefined;
    const tokens = renderSignedAmounts(amounts);
    if (tokens.length === 0) return null;
    return {
      role: 'chief',
      parts: [`→ ${seatLabel(targetSeat)}: `, ...tokens],
    };
  },

  chiefEndPhase: () => ({ role: 'chief', parts: ['Ended chief phase'] }),

  chiefPlaceWorker: (args, G) => {
    const a = args[0] as { x?: number; y?: number } | undefined;
    if (!a || typeof a.x !== 'number' || typeof a.y !== 'number') return null;
    const key = `${a.x},${a.y}`;
    const cell = G.domestic?.grid?.[key];
    const parts: ActivityPart[] = ['Placed worker on '];
    if (cell !== undefined) {
      parts.push(card(`building:${cell.defID}`, cell.defID));
    } else {
      parts.push('building');
    }
    parts.push(` (${a.x},${a.y})`);
    return { role: 'chief', parts };
  },

  chiefPlayGoldEvent: (args) => {
    const cardID = String(args[0] ?? '');
    return {
      role: 'chief',
      parts: ['Played event: ', card(`event:${cardID}`, cardID)],
    };
  },

  // ---- Science ------------------------------------------------------------
  scienceContribute: (args) => {
    const cardID = String(args[0] ?? '');
    const amounts = args[1] as Partial<ResourceBag> | undefined;
    const tokens = renderPositiveAmounts(amounts, '+');
    const parts: ActivityPart[] = ['Contributed'];
    if (tokens.length > 0) {
      parts.push(' ', ...tokens);
    }
    parts.push(' to ', card(`science:${cardID}`, cardID));
    return { role: 'science', parts };
  },

  scienceComplete: (args, G) => {
    const cardID = String(args[0] ?? '');
    const found = G.science?.grid.flat().find((c) => c.id === cardID);
    const parts: ActivityPart[] = [
      'Completed ',
      card(`science:${cardID}`, cardID),
    ];
    if (found !== undefined) parts.push(` (${found.color})`);
    return { role: 'science', parts };
  },

  // ---- Domestic -----------------------------------------------------------
  domesticBuyBuilding: (args) => {
    const name = String(args[0] ?? '');
    const x = args[1];
    const y = args[2];
    const def = BUILDINGS.find((b) => b.name === name);
    const parts: ActivityPart[] = ['Built '];
    if (def !== undefined) parts.push(card(idForBuilding(def), name));
    else parts.push(name);
    parts.push(` at (${x},${y})`);
    return { role: 'domestic', parts };
  },

  domesticUpgradeBuilding: (args, G) => {
    const x = args[0];
    const y = args[1];
    const upgradeName = String(args[2] ?? '');
    const key = `${x},${y}`;
    const cell = G.domestic?.grid?.[key];
    const parts: ActivityPart[] = ['Upgraded '];
    if (cell !== undefined) {
      parts.push(card(`building:${cell.defID}`, cell.defID));
    } else {
      parts.push(upgradeName || 'building');
    }
    parts.push(` (${x},${y})`);
    return { role: 'domestic', parts };
  },

  domesticProduce: () => ({ role: 'domestic', parts: ['Produced'] }),

  // ---- Defense -----------------------------------------------------------
  // (Phase 1: defense ships only seatDone — log entries arrive in Phase 2.)
  // ---- Per-color event-card plays (non-chief) -----------------------------
  sciencePlayBlueEvent: (args) => {
    const cardID = String(args[0] ?? '');
    return {
      role: 'science',
      parts: ['Played event: ', card(`event:${cardID}`, cardID)],
    };
  },
  domesticPlayGreenEvent: (args) => {
    const cardID = String(args[0] ?? '');
    return {
      role: 'domestic',
      parts: ['Played event: ', card(`event:${cardID}`, cardID)],
    };
  },
  // ---- Per-role tech plays ------------------------------------------------
  chiefPlayTech: (args) => {
    const name = String(args[0] ?? '');
    return {
      role: 'chief',
      parts: ['Played tech: ', card(`tech:${name}`, name)],
    };
  },
  sciencePlayTech: (args) => {
    const name = String(args[0] ?? '');
    return {
      role: 'science',
      parts: ['Played tech: ', card(`tech:${name}`, name)],
    };
  },
  domesticPlayTech: (args) => {
    const name = String(args[0] ?? '');
    return {
      role: 'domestic',
      parts: ['Played tech: ', card(`tech:${name}`, name)],
    };
  },
  // ---- Misc ---------------------------------------------------------------
  eventResolve: () => ({ parts: ['Resolved event input'] }),

  scienceSeatDone: () => ({ role: 'science', parts: ['Done with my turn'] }),
  domesticSeatDone: () => ({ role: 'domestic', parts: ['Done with my turn'] }),
  defenseSeatDone: () => ({ role: 'defense', parts: ['Done with my turn'] }),

  requestHelp: (args) => {
    const payload = args[0] as
      | {
          fromRole?: Role;
          targetId?: string;
          targetLabel?: string;
          slices?: ReadonlyArray<{ toSeat?: string }>;
        }
      | undefined;
    if (!payload) return null;
    const recipients =
      payload.slices
        ?.map((s) => seatLabel(s.toSeat))
        .filter((s) => s !== '?') ?? [];
    const target = payload.targetLabel ?? payload.targetId ?? '';
    const targetIsCard =
      typeof payload.targetId === 'string' &&
      /^(building|tech|unit|science|event|trade|battle):/.test(
        payload.targetId,
      );
    const targetPart: ActivityPart = targetIsCard
      ? card(payload.targetId!, target)
      : target;
    const verb =
      recipients.length > 0
        ? `Toggled help request to ${recipients.join(', ')} for `
        : 'Toggled help request for ';
    return {
      role: payload.fromRole,
      parts: [verb, targetPart],
    };
  },

  undoLast: () => ({ parts: ['Undid last action'] }),

  __devGrantAllRoles: (args) => {
    const amount =
      typeof args[0] === 'number' && Number.isFinite(args[0] as number)
        ? Math.floor(args[0] as number)
        : 10;
    return { parts: [`Dev: +${amount} of each (all roles)`] };
  },
};
