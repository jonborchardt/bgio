// Sample seat states for the mat preview. Mix of chief / non-chief,
// idle / income / produced / active / waiting so each variation gets
// stress-tested against the real layouts the live CenterMat hits.

import type { ResourceBag } from '../../game/resources/types.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import type { MatSample } from './types.ts';

const bag = (overrides: Partial<ResourceBag>): ResourceBag => ({
  ...EMPTY_BAG,
  ...overrides,
});

export const SAMPLE_SEATS: ReadonlyArray<MatSample> = [
  {
    id: 'chief-others-phase',
    label: 'Chief — others acting (income + stash visible)',
    seat: '0',
    roles: ['chief'],
    mat: null,
    bankView: {
      income: bag({ gold: 4, food: 1 }),
      stash: bag({ gold: 2, wood: 3 }),
      hideIncome: false,
    },
    waitingFor: 'Science · Domestic · Foreign',
  },
  {
    id: 'chief-active',
    label: 'Chief — chief phase (active, income merged into stash)',
    seat: '0',
    roles: ['chief'],
    mat: null,
    bankView: {
      income: bag({ gold: 4, food: 1 }),
      stash: bag({ gold: 6, wood: 3, food: 1, stone: 2 }),
      hideIncome: true,
    },
    active: true,
  },
  {
    id: 'science-income',
    label: 'Science — income just dropped (in lane filled)',
    seat: '1',
    roles: ['science'],
    mat: {
      in: bag({ gold: 2, science: 1 }),
      out: bag({}),
      stash: bag({ science: 3 }),
    },
    waitingFor: 'Chief',
  },
  {
    id: 'domestic-produced',
    label: 'Domestic — active, produced this round (out lane filled)',
    seat: '2',
    roles: ['domestic'],
    mat: {
      in: bag({}),
      out: bag({ wood: 2, stone: 1, food: 1 }),
      stash: bag({ gold: 1, worker: 2 }),
    },
    active: true,
  },
  {
    id: 'foreign-idle',
    label: 'Foreign — idle, only stash',
    seat: '3',
    roles: ['foreign'],
    mat: {
      in: bag({}),
      out: bag({}),
      stash: bag({ gold: 1, horse: 2 }),
    },
    waitingFor: 'Chief',
  },
  {
    id: 'foreign-empty',
    label: 'Foreign — completely empty',
    seat: '3',
    roles: ['foreign'],
    mat: {
      in: bag({}),
      out: bag({}),
      stash: bag({}),
    },
    waitingFor: 'Chief',
  },
];
