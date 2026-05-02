// Shared types for the player-mat preview workshop.
// Each variation is a self-contained module under ./variations/ that
// exports a `Renderer` taking a `MatSample` (one seat's tile state).

import type { ComponentType } from 'react';
import type { Role, PlayerMat } from '../../game/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';

export interface BankView {
  income: ResourceBag;
  stash: ResourceBag;
  /** When true, suppress the income lane (chiefPhase: income merged into stash). */
  hideIncome?: boolean;
}

export interface MatSample {
  id: string;
  label: string;
  seat: string;
  roles: ReadonlyArray<Role>;
  /** null for chief (no per-seat mat). */
  mat: PlayerMat | null;
  /** Chief-only: bank breakdown to render in place of mat lanes. */
  bankView?: BankView;
  active?: boolean;
  waitingFor?: string;
}

export interface MatRendererProps {
  sample: MatSample;
}

export type MatRenderer = ComponentType<MatRendererProps>;

export interface MatVariation {
  id: string;
  name: string;
  blurb: string;
  Renderer: MatRenderer;
}
