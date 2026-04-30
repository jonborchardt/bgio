// Bank audit trail (14.x — chief-tooltip provenance).
//
// Every mutation site that touches `G.bank` calls `appendBankLog` so the
// ChiefPanel tooltip can answer "where did the bank's current balance
// come from?" Entries are signed (positive = inflow, negative = outflow)
// and tagged with the round they happened in so the tooltip can group them
// chronologically.
//
// The log is intentionally not trimmed at round end — match length is
// bounded by `turnCap` (default 80) and per-round mutations are well under
// 50, so the unbounded log fits in tens of KB at worst.

import type { SettlementState } from '../types.ts';
import type { Resource, ResourceBag } from './types.ts';
import { RESOURCES } from './types.ts';

export type BankLogSource =
  | 'setup'
  | 'stipend'
  | 'sweep'
  | 'eventCard'
  | 'battleReward'
  | 'scienceSweep'
  | 'stashPayment'
  | 'distribute'
  | 'release';

export interface BankLogEntry {
  /** `G.round` at the time the mutation happened. */
  round: number;
  /** Which subsystem moved the resources. */
  source: BankLogSource;
  /** Signed per-resource delta. Positive = inflow into the bank. */
  delta: Partial<ResourceBag>;
  /** Optional human-readable note (building name, target seat, card id, …). */
  detail?: string;
}

/**
 * Push a signed bank delta onto `G.bankLog`, lazily initializing the slot.
 * No-op when `delta` is empty (no resource entry is non-zero) so callers
 * don't need to gate the call.
 */
export const appendBankLog = (
  G: SettlementState,
  source: BankLogSource,
  delta: Partial<ResourceBag>,
  detail?: string,
): void => {
  let nonZero = false;
  const trimmed: Partial<ResourceBag> = {};
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = delta[r];
    if (v === undefined || v === 0) continue;
    trimmed[r] = v;
    nonZero = true;
  }
  if (!nonZero) return;

  if (G.bankLog === undefined) G.bankLog = [];
  G.bankLog.push({
    round: G.round,
    source,
    delta: trimmed,
    ...(detail !== undefined ? { detail } : {}),
  });
};

/** Negate a bag for outflow logging. Pure helper. */
export const negateBag = (bag: Partial<ResourceBag>): Partial<ResourceBag> => {
  const out: Partial<ResourceBag> = {};
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = bag[r];
    if (v === undefined || v === 0) continue;
    out[r] = -v;
  }
  return out;
};

/**
 * Split the chief's bank into the round's gross income and the carryover
 * stash (balance at the start of the round). Income sums positive deltas
 * for the current round; stash = current bank − net round delta, clamped
 * at zero per resource. Both are returned as full ResourceBags (zeros
 * filled in) so callers can index by Resource without extra guards.
 */
export const computeBankView = (
  G: SettlementState,
): { income: ResourceBag; stash: ResourceBag } => {
  const log = G.bankLog ?? [];
  const round = G.round;
  const incomePartial: Partial<ResourceBag> = {};
  const netPartial: Partial<ResourceBag> = {};
  for (const e of log) {
    if (e.round !== round) continue;
    for (const r of RESOURCES as ReadonlyArray<Resource>) {
      const v = e.delta[r];
      if (v === undefined || v === 0) continue;
      netPartial[r] = (netPartial[r] ?? 0) + v;
      if (v > 0) incomePartial[r] = (incomePartial[r] ?? 0) + v;
    }
  }
  const income = {} as ResourceBag;
  const stash = {} as ResourceBag;
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    income[r] = incomePartial[r] ?? 0;
    const cur = G.bank[r] ?? 0;
    const delta = netPartial[r] ?? 0;
    const s = cur - delta;
    stash[r] = s > 0 ? s : 0;
  }
  return { income, stash };
};
