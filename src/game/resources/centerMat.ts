// Center mat — empty slot in 1.4.
//
// The trade-request slot was retired by the defense redesign (D14: no
// trade requests, no battle deck). Phase 2 will fill the center mat
// back up with track cards (D19) — until then `CenterMat` is a placeholder
// shape so existing code that reads `G.centerMat` doesn't have to guard
// for an absent slot. The `initialCenterMat()` factory keeps its name so
// `setup.ts` doesn't need a touch-up; the returned object is empty.
//
// Phase 2.4 will add the global event track (next-card / current-card /
// past-cards strip) under this same `centerMat` slot.

// Empty interface kept so Phase 2 can widen the shape (track-strip
// state, current / next track card, etc.) without churning every
// consumer that already references the named type. The eslint disable
// is intentional: there are no fields *yet*. `Record<string, never>`
// would be too narrow — older test fixtures still rely on the open
// shape via `as Record<string, unknown>` casts.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CenterMat {}

export const initialCenterMat = (): CenterMat => ({});
