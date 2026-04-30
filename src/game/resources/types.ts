// Resource token types and the empty bag constant.
// Pure types and a frozen constant — no runtime deps, no boardgame.io imports.

export const RESOURCES = [
  'gold',
  'wood',
  'stone',
  'steel',
  'horse',
  'food',
  'production',
  'science',
  'happiness',
  'worker',
] as const;

export type Resource = (typeof RESOURCES)[number];

export type ResourceBag = Record<Resource, number>;

export const EMPTY_BAG: Readonly<ResourceBag> = Object.freeze({
  gold: 0,
  wood: 0,
  stone: 0,
  steel: 0,
  horse: 0,
  food: 0,
  production: 0,
  science: 0,
  happiness: 0,
  worker: 0,
});
